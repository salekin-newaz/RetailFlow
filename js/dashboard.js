let dashboardChartInstance = null;
let expenseChartInstance = null;
let salesCategoryChartInstance = null;
let topSellingChartInstance = null;
let weeklySalesTrendChartInstance = null;

window.initDashboard = function() {
    renderDashboard();
    window.store.subscribe(() => renderDashboard());
}

function renderDashboard() {
    const f = window.store.getFinancials();

    setText('dash-today-sales', `৳ ${f.todaySales.toLocaleString()}`);
    setText('dash-total-sales', `৳ ${f.effectiveSales.toLocaleString()}`);
    setText('dash-investment', `৳ ${f.effectiveInvestment.toLocaleString()}`);
    setText('dash-expenses', `৳ ${f.totalExpenses.toLocaleString()}`);
    setText('dash-outstanding-dues', `৳ ${f.outstandingDues.toLocaleString()}`);
    setText('dash-profit', `৳ ${f.netProfit.toLocaleString()}`);
    setText('dash-total-customers', f.totalUniqueCustomers.toLocaleString());
    setText('dash-total-suppliers', f.totalSuppliers.toLocaleString());

    // Today vs Yesterday Comparison Badge
    const delta = f.todaySales - f.yesterdaySales;
    let pct = 0;
    if (f.yesterdaySales > 0) {
        pct = (delta / f.yesterdaySales) * 100;
    } else if (f.todaySales > 0) {
        pct = 100;
    }
    const pctSign = pct >= 0 ? '+' : '';
    const pctColor = pct >= 0 ? 'var(--success)' : 'var(--danger)';
    const deltaText = `vs yesterday: <span style="color:${pctColor}; font-weight:700;">${pctSign}${pct.toFixed(0)}% (৳ ${delta.toLocaleString()})</span>`;
    const vsEl = document.getElementById('dash-today-vs-yesterday');
    if (vsEl) vsEl.innerHTML = deltaText;

    // Color profit based on positive/negative
    const profitEl = document.getElementById('dash-profit');
    if (profitEl) {
        profitEl.style.color = f.netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    renderBusinessChart(f);
    renderExpensePieChart();
    renderSalesCategoryChart();
    renderTopSellingChart(f);
    renderWeeklySalesTrendChart(f);
    renderDueCustomersPanel();
    renderLowStockPanel();
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function renderBusinessChart(f) {
    const canvas = document.getElementById('businessChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (dashboardChartInstance) dashboardChartInstance.destroy();

    dashboardChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Investment', 'Sales Revenue', 'Expenses', 'Net Profit'],
            datasets: [{
                label: 'Amount (৳)',
                data: [f.effectiveInvestment, f.effectiveSales, f.totalExpenses, f.netProfit],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.65)',
                    'rgba(99, 102, 241, 0.65)',
                    'rgba(245, 158, 11, 0.65)',
                    f.netProfit >= 0 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 68, 68, 0.65)'
                ],
                borderColor: ['#ef4444', '#6366f1', '#f59e0b', f.netProfit >= 0 ? '#10b981' : '#ef4444'],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ৳ ${ctx.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 12, weight: '500' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        callback: v => '৳' + v.toLocaleString()
                    }
                }
            }
        }
    });
}

function renderExpensePieChart() {
    const canvas = document.getElementById('expensePieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const categories = window.store.getExpensesByCategory();
    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (expenseChartInstance) expenseChartInstance.destroy();

    if (labels.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No expenses recorded yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    const colors = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#0d1117',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 16,
                        font: { family: 'Inter', size: 12 },
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ৳ ${ctx.raw.toLocaleString()}`
                    }
                }
            }
        }
    });
}

function renderSalesCategoryChart() {
    const canvas = document.getElementById('salesCategoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const categories = window.store.getSalesByCategory();
    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (salesCategoryChartInstance) salesCategoryChartInstance.destroy();

    if (labels.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No sales recorded yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    const colors = ['#a855f7', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

    salesCategoryChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#0d1117',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 16,
                        font: { family: 'Inter', size: 12 },
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ৳ ${ctx.raw.toLocaleString()}`
                    }
                }
            }
        }
    });
}

function renderDueCustomersPanel() {
    const panel = document.getElementById('due-customers-panel');
    if (!panel) return;

    // Get customers who have due > 0
    const list = window.store.customers
        .map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || 'No Phone',
            due: window.store.getCustomerDue(c.id)
        }))
        .filter(c => c.due > 0)
        // Sort descending by due amount
        .sort((a,b) => b.due - a.due);

    if (list.length === 0) {
        panel.innerHTML = `
            <div style="text-align:center; padding: 30px; color: var(--text-muted); width: 100%;">
                <svg style="width:40px;height:40px;margin-bottom:10px;color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p style="font-weight:500;">No outstanding dues!</p>
            </div>`;
        return;
    }

    panel.innerHTML = list.map(c => {
        return `
            <div class="low-stock-item" style="border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div class="low-stock-info">
                    <span class="low-stock-name" style="font-weight:600; color:var(--text-primary);">${c.name}</span>
                    <span class="low-stock-meta" style="font-size:0.75rem; color:var(--text-secondary);">${c.phone}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="color:var(--danger); font-weight:700; font-size:0.9rem;">৳ ${c.due.toLocaleString()}</span>
                    <button class="btn-receipt" style="font-size:0.75rem; padding: 4px 8px; background:var(--success-glow); color:var(--success); border:1px solid rgba(16,185,129,0.3);" onclick="goToCustomersAndCollect('${c.id}')">💵 Collect</button>
                </div>
            </div>`;
    }).join('');
}

window.goToCustomersAndCollect = function(customerId) {
    // Switch to customers tab
    const customersTab = document.querySelector('.nav-links li[data-tab="customers"]');
    if (customersTab) {
        customersTab.click();
        // Wait and perform select
        setTimeout(() => {
            if (window.quickCollectDue) window.quickCollectDue(customerId);
        }, 150);
    }
}

function renderLowStockPanel() {
    const panel = document.getElementById('low-stock-panel');
    const bellCount = document.getElementById('bell-count');
    if (!panel) return;

    const lowItems = window.store.getLowStockItems();

    if (bellCount) {
        bellCount.innerText = lowItems.length;
        bellCount.style.display = lowItems.length > 0 ? 'flex' : 'none';
    }

    if (lowItems.length === 0) {
        panel.innerHTML = `
            <div style="text-align:center; padding: 30px; color: var(--text-muted);">
                <svg style="width:40px;height:40px;margin-bottom:10px;color:var(--success);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p style="font-weight:500;">All stock levels are healthy!</p>
            </div>`;
        return;
    }

    panel.innerHTML = lowItems.map(p => {
        const isOut = p.stock === 0;
        const badgeClass = isOut ? 'badge-danger' : 'badge-warning';
        const label = isOut ? 'OUT' : 'LOW';
        return `
            <div class="low-stock-item">
                <div class="low-stock-info">
                    <span class="low-stock-name">${p.name}</span>
                    <span class="low-stock-meta">${p.id} · Min: ${p.minStock} ${p.unit}</span>
                </div>
                <span class="badge ${badgeClass}">${label}: ${p.stock} ${p.unit}</span>
            </div>`;
    }).join('');
}

function renderTopSellingChart(f) {
    const canvas = document.getElementById('topSellingChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (topSellingChartInstance) topSellingChartInstance.destroy();

    const labels = f.top5Selling.map(x => x.name);
    const data = f.top5Selling.map(x => x.totalQty);

    if (labels.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No sales logged yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    topSellingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantity Sold',
                data: data,
                backgroundColor: 'rgba(124, 58, 237, 0.65)',
                borderColor: '#7c3aed',
                borderWidth: 2,
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 12, weight: '500' },
                        callback: function(val, index) {
                            const label = this.getLabelForValue(val);
                            return label.length > 15 ? label.substring(0, 12) + '...' : label;
                        }
                    }
                }
            }
        }
    });
}

function renderWeeklySalesTrendChart(f) {
    const canvas = document.getElementById('weeklySalesTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (weeklySalesTrendChartInstance) weeklySalesTrendChartInstance.destroy();

    const labels = f.weeklyTrend.map(x => {
        const parts = x.date.split('-');
        return `${parts[2]}/${parts[1]}`;
    });
    const data = f.weeklyTrend.map(x => x.amount);

    weeklySalesTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales Revenue (৳)',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ৳ ${ctx.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        callback: v => '৳' + v.toLocaleString()
                    }
                }
            }
        }
    });
}
