/**
 * supabase-config.js - Supabase Client Initializer & Connection Wizard
 */

(function() {
    const storedUrl = localStorage.getItem('rf_supabase_url');
    const storedKey = localStorage.getItem('rf_supabase_key');

    window.supabaseUrl = storedUrl || '';
    window.supabaseKey = storedKey || '';
    window.supabaseClient = null;

    if (window.supabaseUrl && window.supabaseKey && window.supabase) {
        try {
            window.supabaseClient = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.supabaseClient) {
            renderSetupWizard();
            
            // Hide connection widget if there's no client yet
            const connWidget = document.getElementById('connection-status-widget');
            if (connWidget) connWidget.style.display = 'none';
        } else {
            // Update labels and add reset click listener
            const urlLabel = document.getElementById('connected-url-label');
            if (urlLabel) urlLabel.innerText = window.supabaseUrl || 'Connected';

            const resetBtn = document.getElementById('btn-reset-connection');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (confirm("⚠️ Are you sure you want to reset your Supabase project connection?\n\nThis will clear your local connection settings and allow you to reconfigure the URL and API key.")) {
                        localStorage.removeItem('rf_supabase_url');
                        localStorage.removeItem('rf_supabase_key');
                        window.location.reload();
                    }
                });
            }
        }
    });

    function renderSetupWizard() {
        const wizard = document.createElement('div');
        wizard.id = 'rf-setup-wizard';
        wizard.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(13, 17, 23, 0.95);
            backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999;
            color: #f1f5f9;
            font-family: 'Inter', sans-serif;
            overflow-y: auto;
            padding: 20px;
        `;

        wizard.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #161b22, #0d1117);
                border: 1px solid rgba(124, 58, 237, 0.3);
                border-radius: 16px;
                padding: 40px;
                max-width: 580px;
                width: 100%;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.1);
                animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            ">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="
                        width: 60px; height: 60px;
                        background: linear-gradient(135deg, #7c3aed, #a855f7);
                        border-radius: 14px;
                        display: flex; align-items: center; justify-content: center;
                        margin: 0 auto 16px;
                        box-shadow: 0 8px 24px rgba(124, 58, 237, 0.3);
                    ">
                        <svg style="width: 32px; height: 32px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                    </div>
                    <h2 style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 800; background: linear-gradient(to right, #ffffff, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        Welcome to RetailFlow
                    </h2>
                    <p style="color: #94a3b8; font-size: 0.95rem; margin-top: 8px;">
                        Connect your Supabase Backend to unlock the premium ledger, roles, and real-time synchronization.
                    </p>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 18px; border-radius: 12px; margin-bottom: 24px;">
                    <h4 style="font-size: 0.85rem; font-weight: 700; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                        🛠️ First Step: Initialize Database
                    </h4>
                    <p style="font-size: 0.82rem; color: #94a3b8; line-height: 1.4; margin-bottom: 12px;">
                        Ensure you have created the required tables by copying the SQL script in <code>schema.sql</code> and executing it inside the <strong>SQL Editor</strong> of your Supabase dashboard.
                    </p>
                    <button id="btn-copy-sql" type="button" style="
                        background: rgba(167, 139, 250, 0.1);
                        border: 1px dashed rgba(167, 139, 250, 0.4);
                        color: #a78bfa;
                        font-weight: 600;
                        font-size: 0.78rem;
                        padding: 8px 14px;
                        border-radius: 6px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: background 0.2s;
                    ">
                        Copy SQL Script 📋
                    </button>
                </div>

                <form id="rf-setup-form" style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                            Supabase Project URL
                        </label>
                        <input type="url" id="wizard-url" required value="https://pxgkqcajhcimybrzerfa.supabase.co" placeholder="https://your-project.supabase.co" style="
                            background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);
                            padding: 12px; border-radius: 8px; color: white; outline: none; transition: border-color 0.2s;
                        ">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                            Supabase Anonymous API Key
                        </label>
                        <input type="text" id="wizard-key" required value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4Z2txY2FqaGNpbXlicnplcmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTAwNTYsImV4cCI6MjA5NTQ2NjA1Nn0.zPok6wm3SQVmTpUTqgM3UCE2tx_MaNdoq_wp0r1B_pA" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." style="
                            background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);
                            padding: 12px; border-radius: 8px; color: white; outline: none; transition: border-color 0.2s; font-size: 0.7rem;
                        ">
                    </div>

                    <button type="submit" style="
                        background: linear-gradient(135deg, #7c3aed, #6d28d9);
                        color: white; font-weight: 700; font-size: 0.95rem;
                        padding: 14px; border: none; border-radius: 8px; cursor: pointer;
                        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3); margin-top: 10px;
                        transition: transform 0.2s;
                        width: 100%;
                    ">
                        Connect Backend 🚀
                    </button>
                    <div style="text-align: center; margin-top: 12px; color: #94a3b8; font-size: 0.75rem; font-weight: 600;">
                        OR
                    </div>
                    <button id="btn-run-offline" type="button" style="
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #f1f5f9;
                        font-weight: 700;
                        font-size: 0.95rem;
                        padding: 14px;
                        border-radius: 8px;
                        cursor: pointer;
                        margin-top: 10px;
                        transition: background 0.2s;
                        width: 100%;
                    ">
                        Run Offline in Demo Mode 💻
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(wizard);

        // Copy SQL to clipboard logic
        const copyBtn = document.getElementById('btn-copy-sql');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('schema.sql');
                    if (!response.ok) throw new Error("Could not fetch schema.sql");
                    const sqlText = await response.text();
                    await navigator.clipboard.writeText(sqlText);
                    copyBtn.innerText = "Copied! ✅";
                    setTimeout(() => { copyBtn.innerText = "Copy SQL Script 📋"; }, 2000);
                } catch (err) {
                    alert("Could not automatically copy. Please open the 'schema.sql' file in your project folder manually to copy the SQL script.");
                }
            });
        }

        // Run Offline click logic
        const runOfflineBtn = document.getElementById('btn-run-offline');
        if (runOfflineBtn) {
            runOfflineBtn.addEventListener('click', () => {
                localStorage.setItem('rf_supabase_url', 'local_mock');
                localStorage.setItem('rf_supabase_key', 'local_mock');
                window.location.reload();
            });
        }

        const form = document.getElementById('rf-setup-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlVal = document.getElementById('wizard-url').value.trim();
            const keyVal = document.getElementById('wizard-key').value.trim();

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerText = "Testing Connection...";
            submitBtn.disabled = true;

            try {
                // Initialize client temporarily to test
                const tempClient = window.supabase.createClient(urlVal, keyVal);
                
                // Perform a simple mock query to test connection
                const { error } = await tempClient.from('shops').select('id').limit(1);
                
                // If there's an error and it's a network error or client error
                if (error && error.message && error.message.includes('fetch')) {
                    throw new Error("Cannot reach Supabase server. Please verify your Project URL.");
                }

                // Save successful connection
                localStorage.setItem('rf_supabase_url', urlVal);
                localStorage.setItem('rf_supabase_key', keyVal);
                
                if (window.showToast) {
                    window.showToast("Connection saved! Reloading...", "success");
                } else {
                    alert("Connection saved! Reloading...");
                }
                setTimeout(() => window.location.reload(), 1000);

            } catch (err) {
                alert("❌ Connection Test Failed!\n\n" + err.message + "\n\nPlease verify that your Project URL and Anon API Key are correct and that your database schema has been initialized.");
                submitBtn.innerText = "Connect Backend 🚀";
                submitBtn.disabled = false;
            }
        });
    }
})();
