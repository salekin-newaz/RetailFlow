/**
 * app.js - Main SPA Coordinator & Routing Orchestrator
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Dark/Light mode theme
    initTheme();

    // Language select setup
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = window.currentLanguage || 'en';
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            window.currentLanguage = lang;
            localStorage.setItem('rf_lang', lang);
            if (window.translateDOM) window.translateDOM();
            if (window.playBeep) window.playBeep('click');
            window.store.notify();
        });
    }
    if (window.translateDOM) window.translateDOM();

    // 1. Auth Page Toggles & Submission handlers
    initAuthUiHandlers();

    // Initialize all modules with error isolation
    const modules = [
        ['Dashboard', window.initDashboard],
        ['Inventory', window.initInventory],
        ['Purchases', window.initPurchases],
        ['Sales', window.initSales],
        ['Expenses', window.initExpenses],
        ['Suppliers', window.initSuppliers],
        ['Customers', window.initCustomers],
        ['Returns', window.initReturns],
        ['Reports', window.initReports],
        ['Settings', window.initSettings]
    ];

    modules.forEach(([name, init]) => {
        try {
            if (init) init();
        } catch (e) {
            console.error(`${name} failed to initialize:`, e);
        }
    });

    // Wire up sidebar navigation with role-based checks
    const navItems = document.querySelectorAll('.nav-links li[data-tab]');
    const pages = document.querySelectorAll('.page');
    const topBarTitle = document.getElementById('topbar-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            if (!targetTab) return;

            // Role blockage checks
            if (window.store.profile) {
                const role = window.store.profile.role;
                if (role === 'cashier') {
                    const allowed = ['sales', 'inventory', 'purchases', 'customers'];
                    if (!allowed.includes(targetTab)) {
                        window.showToast("Access Denied: Cashiers cannot view this tab.", "warning");
                        if (window.playBeep) window.playBeep('error');
                        return;
                    }
                } else if (role === 'viewer') {
                    const allowed = ['dashboard', 'reports'];
                    if (!allowed.includes(targetTab)) {
                        window.showToast("Access Denied: Read-only Viewers cannot view this tab.", "warning");
                        if (window.playBeep) window.playBeep('error');
                        return;
                    }
                }
            }

            if (window.playBeep) window.playBeep('click');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(page => {
                page.classList.toggle('active', page.id === targetTab);
            });

            if (topBarTitle) {
                topBarTitle.innerText = item.querySelector('span').innerText;
            }
        });
    });

    // PDF Export
    initPdfExporter();

    // Date display
    updateCurrentDate();

    // Low stock checks notification bell count
    window.store.subscribe(() => {
        const lowItems = window.store.getLowStockItems();
        const bellCountEl = document.getElementById('bell-count');
        if (bellCountEl) {
            if (lowItems.length > 0 && window.store.profile && window.store.profile.role !== 'cashier') {
                bellCountEl.innerText = lowItems.length;
                bellCountEl.style.display = 'flex';
            } else {
                bellCountEl.style.display = 'none';
            }
        }
    });
});

function initAuthUiHandlers() {
    const btnToggleSignup = document.getElementById('btn-toggle-signup');
    const btnToggleLogin = document.getElementById('btn-toggle-login');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const btnLogout = document.getElementById('btn-logout');

    const diagOfflineBtn = document.getElementById('btn-diagnostics-run-offline');
    if (diagOfflineBtn) {
        diagOfflineBtn.addEventListener('click', () => {
            localStorage.setItem('rf_supabase_url', 'local_mock');
            localStorage.setItem('rf_supabase_key', 'local_mock');
            window.location.reload();
        });
    }

    if (btnToggleSignup && loginForm && signupForm) {
        btnToggleSignup.addEventListener('click', () => {
            loginForm.style.display = 'none';
            signupForm.style.display = 'flex';
        });
    }

    if (btnToggleLogin && loginForm && signupForm) {
        btnToggleLogin.addEventListener('click', () => {
            signupForm.style.display = 'none';
            loginForm.style.display = 'flex';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.innerText = "Signing In...";
            submitBtn.disabled = true;

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                window.showToast("Signed in successfully!", "success");
                if (window.playBeep) window.playBeep('success');
                
                // Clear fields
                document.getElementById('login-email').value = '';
                document.getElementById('login-password').value = '';

                // Bootstrap
                window.store.user = data.user;
                await window.store.loadUserProfileAndBootstrap();

            } catch (err) {
                window.showToast("Sign in failed: " + err.message, "error");
                if (window.playBeep) window.playBeep('error');
                
                const diagPanel = document.getElementById('diagnostics-panel');
                const diagError = document.getElementById('diagnostics-error');
                if (diagPanel && diagError) {
                    diagPanel.style.display = 'block';
                    diagError.innerText = "SignIn Error: " + err.message + 
                        "\nStatus: " + (err.status || "Unknown") + 
                        "\nHint: If you see 'Invalid login credentials', please double-check your email/password. If you see 'relation public.profiles does not exist', you must run schema.sql in Supabase SQL Editor.";
                }

                const isFetchError = err.message && (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('cors') || err.message.toLowerCase().includes('network'));
                const offlineTrigger = document.getElementById('diagnostics-offline-trigger');
                if (offlineTrigger && isFetchError) {
                    offlineTrigger.style.display = 'block';
                }
            } finally {
                submitBtn.innerText = "Sign In 🔑";
                submitBtn.disabled = false;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            submitBtn.innerText = "Registering...";
            submitBtn.disabled = true;

            try {
                const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) throw error;

                if (!data.user) {
                    window.showToast("Sign up completed! Please check your email for confirmation.", "info");
                    return;
                }

                if (!data.session) {
                    window.showToast("Sign up completed! Verification email sent.", "warning");
                    alert("📧 Account created successfully, but Email Verification is enabled on your Supabase project!\n\n1. Please check your email inbox and click the verification link before logging in.\n\n2. Tip: You can disable this requirement by going to your Supabase Dashboard > Authentication > Providers > Email and toggling OFF 'Confirm email'.");
                    
                    // Clear fields
                    document.getElementById('signup-name').value = '';
                    document.getElementById('signup-email').value = '';
                    document.getElementById('signup-password').value = '';

                    // Switch back to login view smoothly
                    signupForm.style.display = 'none';
                    loginForm.style.display = 'flex';
                    return;
                }

                window.showToast("Account registered! Opening onboarding...", "success");
                if (window.playBeep) window.playBeep('double');

                // Clear fields
                document.getElementById('signup-name').value = '';
                document.getElementById('signup-email').value = '';
                document.getElementById('signup-password').value = '';

                // Save temporary profile name & bootstrap onboarding wizard
                window.store.user = data.user;
                window.store.renderOnboardingWizard();
                
                // Prefill name in onboarding
                setTimeout(() => {
                    const onbName = document.getElementById('onb-name');
                    if (onbName) onbName.value = fullName;
                }, 100);

            } catch (err) {
                window.showToast("Registration failed: " + err.message, "error");
                if (window.playBeep) window.playBeep('error');

                const diagPanel = document.getElementById('diagnostics-panel');
                const diagError = document.getElementById('diagnostics-error');
                if (diagPanel && diagError) {
                    diagPanel.style.display = 'block';
                    diagError.innerText = "SignUp Error: " + err.message + 
                        "\nStatus: " + (err.status || "Unknown") + 
                        "\nHint: If you see 'Signup is disabled', go to Supabase Dashboard > Auth > Providers > Email and enable both 'Enable Signup' and disable 'Confirm email' for an instant local login experience.";
                }

                const isFetchError = err.message && (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('cors') || err.message.toLowerCase().includes('network'));
                const offlineTrigger = document.getElementById('diagnostics-offline-trigger');
                if (offlineTrigger && isFetchError) {
                    offlineTrigger.style.display = 'block';
                }
            } finally {
                submitBtn.innerText = "Create Account 🚀";
                submitBtn.disabled = false;
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (confirm("Are you sure you want to logout?")) {
                await window.store.logout();
            }
        });
    }
}

// ==========================================================================
// WEB AUDIO SOUND EFFECTS
// ==========================================================================
window.playBeep = function(type = 'success') {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, ac.currentTime);
            gain.gain.setValueAtTime(0.15, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.12);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.12);
        } else if (type === 'double') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ac.currentTime);
            gain.gain.setValueAtTime(0.12, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.08);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.08);
            setTimeout(() => {
                const osc2 = ac.createOscillator();
                const gain2 = ac.createGain();
                osc2.connect(gain2);
                gain2.connect(ac.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1174.66, ac.currentTime);
                gain2.gain.setValueAtTime(0.12, ac.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.12);
                osc2.start(ac.currentTime);
                osc2.stop(ac.currentTime + 0.12);
            }, 80);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, ac.currentTime);
            gain.gain.setValueAtTime(0.15, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.3);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.3);
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, ac.currentTime);
            gain.gain.setValueAtTime(0.04, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.03);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.03);
        }
    } catch (e) { /* Web Audio not supported */ }
}

// ==========================================================================
// TOAST NOTIFICATION SYSTEM
// ==========================================================================
window.showToast = function(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const colors = {
        success: 'var(--success)',
        error: 'var(--danger)',
        warning: 'var(--warning)',
        info: 'var(--primary)'
    };

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = colors[type] || colors.info;
    toast.innerHTML = `
        <span class="toast-icon" style="color:${colors[type] || colors.info};font-size:1.1rem;font-weight:700;">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1) reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// DATE DISPLAY
// ==========================================================================
function updateCurrentDate() {
    const el = document.getElementById('current-date');
    if (!el) return;
    el.innerText = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
}

// ==========================================================================
// PDF EXPORT
// ==========================================================================
function initPdfExporter() {
    const btn = document.getElementById('btn-export-pdf');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const activeTabEl = document.querySelector('.nav-links li.active');
        if (!activeTabEl) return;
        const activeTab = activeTabEl.getAttribute('data-tab');
        const section = document.getElementById(activeTab);
        if (!section) return;

        const clone = section.cloneNode(true);
        // Remove interactive elements
        clone.querySelectorAll('.form-container, .return-form-container, button, .btn-pdf, .btn-delete, .btn-receipt, .search-filter-bar, select, input, .filter-row').forEach(el => el.remove());

        // Convert chart to image if dashboard
        if (activeTab === 'dashboard') {
            ['businessChart', 'expensePieChart', 'salesCategoryChart'].forEach(chartId => {
                const origCanvas = document.getElementById(chartId);
                const cloneContainer = clone.querySelector(`#${chartId}`)?.parentElement;
                if (origCanvas && cloneContainer) {
                    cloneContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = origCanvas.toDataURL('image/png');
                    img.style.width = '100%';
                    img.style.maxHeight = '260px';
                    img.style.borderRadius = '10px';
                    cloneContainer.appendChild(img);
                }
            });
        }

        if (activeTab === 'expenses') {
            const origCanvas = document.getElementById('monthlyExpenseChart');
            const cloneContainer = clone.querySelector('#monthlyExpenseChart')?.parentElement;
            if (origCanvas && cloneContainer) {
                cloneContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = origCanvas.toDataURL('image/png');
                img.style.width = '100%';
                img.style.maxHeight = '260px';
                img.style.borderRadius = '10px';
                cloneContainer.appendChild(img);
            }
        }

        // Build print document
        const doc = document.createElement('div');
        doc.style.cssText = 'padding:35px;background:#fff;color:#000;font-family:Inter,sans-serif;';

        const dateStr = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        doc.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #6366f1;padding-bottom:18px;margin-bottom:24px;">
                <div>
                    <h1 style="font-family:Outfit,sans-serif;font-size:2rem;color:#6366f1;margin:0;font-weight:800;">RetailFlow</h1>
                    <p style="color:#64748b;font-size:0.85rem;margin:2px 0 0 0;">Premium Business Ledger</p>
                </div>
                <div style="text-align:right;">
                    <p style="margin:0;font-weight:700;font-size:1rem;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">${activeTab} Report</p>
                    <p style="margin:3px 0 0 0;color:#64748b;font-size:0.8rem;">Generated: ${dateStr}</p>
                </div>
            </div>`;

        const formatted = document.createElement('div');
        formatted.innerHTML = clone.innerHTML;

        // Style for print
        formatted.querySelectorAll('.card, .panel, .table-container, .stat-card, .section-block').forEach(el => {
            el.style.background = '#fff';
            el.style.border = '1px solid #e2e8f0';
            el.style.color = '#000';
            el.style.boxShadow = 'none';
            el.style.padding = '16px';
            el.style.marginBottom = '16px';
        });

        formatted.querySelectorAll('th').forEach(el => {
            el.style.background = '#f8fafc';
            el.style.color = '#475569';
            el.style.borderBottom = '2px solid #cbd5e1';
            el.style.padding = '10px 14px';
        });

        formatted.querySelectorAll('td').forEach(el => {
            el.style.color = '#1e293b';
            el.style.borderBottom = '1px solid #e2e8f0';
            el.style.padding = '10px 14px';
        });

        // Hide Actions columns
        formatted.querySelectorAll('th, td').forEach(el => {
            if (el.innerText.toLowerCase().includes('actions') ||
                el.querySelector('.btn-delete') ||
                el.querySelector('.btn-receipt')) {
                el.style.display = 'none';
            }
        });

        doc.appendChild(formatted);
        doc.innerHTML += `<div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:12px;text-align:center;color:#94a3b8;font-size:0.75rem;">
            <p>Generated by RetailFlow — Confidential Business Document</p></div>`;

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `RetailFlow_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: (activeTab === 'sales' || activeTab === 'inventory') ? 'landscape' : 'portrait' }
        };

        html2pdf().set(opt).from(doc).save().catch(e => {
            console.error("PDF error:", e);
            window.showToast("Export failed: " + e.message, "error");
        });
    });
}

window.downloadCSV = function(data, headers, filename) {
    if (!Array.isArray(data) || data.length === 0) {
        window.showToast("No data to export.", "warning");
        return;
    }

    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    for (const row of data) {
        csvRows.push(row.map(val => {
            const strVal = val === null || val === undefined ? '' : String(val);
            return `"${strVal.replace(/"/g, '""')}"`;
        }).join(','));
    }

    const csvContent = "\ufeff" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    const currentTheme = localStorage.getItem('rf_theme') || 'dark';

    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcons(currentTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const target = current === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', target);
            localStorage.setItem('rf_theme', target);
            updateThemeIcons(target);
            if (window.playBeep) window.playBeep('click');
        });
    }

    function updateThemeIcons(theme) {
        if (!darkIcon || !lightIcon) return;
        if (theme === 'light') {
            darkIcon.style.display = 'block';
            lightIcon.style.display = 'none';
        } else {
            darkIcon.style.display = 'none';
            lightIcon.style.display = 'block';
        }
    }
}

window.getEmptyStateHTML = function(type, title, subtitle, colspan = 8) {
    let svg = '';
    if (type === 'inventory') {
        svg = `<svg style="width:64px;height:64px;color:var(--text-muted);margin-bottom:12px;opacity:0.6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>`;
    } else if (type === 'purchases') {
        svg = `<svg style="width:64px;height:64px;color:var(--text-muted);margin-bottom:12px;opacity:0.6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>`;
    } else if (type === 'sales') {
        svg = `<svg style="width:64px;height:64px;color:var(--text-muted);margin-bottom:12px;opacity:0.6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>`;
    } else if (type === 'expenses') {
        svg = `<svg style="width:64px;height:64px;color:var(--text-muted);margin-bottom:12px;opacity:0.6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else {
        svg = `<svg style="width:64px;height:64px;color:var(--text-muted);margin-bottom:12px;opacity:0.6;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }
    return `<tr><td colspan="${colspan}" style="padding:40px 20px;text-align:center;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
            ${svg}
            <div style="font-weight:600;color:var(--text-primary);font-size:0.95rem;margin-bottom:4px;">${title}</div>
            <div style="color:var(--text-secondary);font-size:0.8rem;">${subtitle}</div>
        </div>
    </td></tr>`;
};


