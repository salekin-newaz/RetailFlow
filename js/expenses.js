let monthlyExpenseChartInstance = null;

window.initExpenses = function() {
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    renderExpenses();
    renderExpenseStats();
    renderMonthlyExpenseChart();

    const addBtn = document.getElementById('btn-add-expense');
    if (addBtn) addBtn.addEventListener('click', handleAddExpense);

    const csvBtn = document.getElementById('btn-export-csv-expenses');
    if (csvBtn) csvBtn.addEventListener('click', handleExportCSVExpenses);

    // Search/filter
    const searchInput = document.getElementById('exp-search');
    const catFilter = document.getElementById('exp-filter-category');
    const dateFrom = document.getElementById('exp-date-from');
    const dateTo = document.getElementById('exp-date-to');
    if (searchInput) searchInput.addEventListener('input', renderExpenses);
    if (catFilter) catFilter.addEventListener('change', renderExpenses);
    if (dateFrom) dateFrom.addEventListener('change', renderExpenses);
    if (dateTo) dateTo.addEventListener('change', renderExpenses);

    window.store.subscribe(() => {
        renderExpenses();
        renderExpenseStats();
        renderMonthlyExpenseChart();
    });
}

function handleExportCSVExpenses() {
    const items = getFilteredExpenses();
    const headers = ["Date", "Category", "Amount", "Note"];
    const rows = items.map(e => [
        e.date,
        e.category,
        e.amount,
        e.note || ''
    ]);
    window.downloadCSV(rows, headers, `RetailFlow_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
}

function getFilteredExpenses() {
    let items = window.store.expenses;
    const search = (document.getElementById('exp-search')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('exp-filter-category')?.value || '';
    const dateFrom = document.getElementById('exp-date-from')?.value || '';
    const dateTo = document.getElementById('exp-date-to')?.value || '';

    if (search) {
        items = items.filter(e => e.note.toLowerCase().includes(search) || e.category.toLowerCase().includes(search));
    }
    if (catFilter) items = items.filter(e => e.category === catFilter);
    if (dateFrom) items = items.filter(e => e.date >= dateFrom);
    if (dateTo) items = items.filter(e => e.date <= dateTo);
    return items;
}

function renderExpenses() {
    const tableBody = document.getElementById('expenses-table');
    if (!tableBody) return;

    const items = getFilteredExpenses();

    if (items.length === 0) {
        tableBody.innerHTML = window.getEmptyStateHTML(
            'expenses',
            window.store.expenses.length === 0 ? 'No Expenses Logged' : 'No Matching Expenses',
            window.store.expenses.length === 0 ? 'Log your shop utility bills, rents, or other expenses above!' : 'Try adjusting your search query, category, or date range filters.',
            5
        );
        return;
    }

    tableBody.innerHTML = items.map((item) => {
        const origIndex = window.store.expenses.indexOf(item);
        return `<tr>
            <td class="td-date">${formatExpDate(item.date)}</td>
            <td><span class="expense-category-tag cat-${item.category.toLowerCase().replace(/\s+/g,'-')}">${item.category}</span></td>
            <td class="td-amount" style="color:var(--danger);font-weight:600;">৳ ${item.amount.toLocaleString()}</td>
            <td class="td-note">${item.note || '—'}</td>
            <td><button class="btn-delete" onclick="deleteExpenseItem(${origIndex})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');
}

function renderExpenseStats() {
    const totalEl = document.getElementById('exp-stat-total');
    const monthEl = document.getElementById('exp-stat-month');
    const countEl = document.getElementById('exp-stat-count');
    if (!totalEl) return;

    const total = window.store.expenses.reduce((sum, e) => sum + e.amount, 0);
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthTotal = window.store.expenses
        .filter(e => e.date.startsWith(currentMonth))
        .reduce((sum, e) => sum + e.amount, 0);

    totalEl.innerText = `৳ ${total.toLocaleString()}`;
    if (monthEl) monthEl.innerText = `৳ ${monthTotal.toLocaleString()}`;
    if (countEl) countEl.innerText = `${window.store.expenses.length} Records`;
}

function renderMonthlyExpenseChart() {
    const canvas = document.getElementById('monthlyExpenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const monthly = window.store.getMonthlyExpenses();
    const labels = Object.keys(monthly).sort();
    const data = labels.map(k => monthly[k]);

    if (monthlyExpenseChartInstance) monthlyExpenseChartInstance.destroy();

    if (labels.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No expense data to chart', canvas.width / 2, canvas.height / 2);
        return;
    }

    monthlyExpenseChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => {
                const [y, m] = l.split('-');
                const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return monthNames[parseInt(m) - 1] + ' ' + y;
            }),
            datasets: [{
                label: 'Monthly Expenses (৳)',
                data: data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#0d1117',
                pointBorderWidth: 2,
                pointRadius: 5
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
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11 },
                        callback: v => '৳' + v.toLocaleString()
                    }
                }
            }
        }
    });
}

async function handleAddExpense() {
    const date = document.getElementById('exp-date')?.value;
    const category = document.getElementById('exp-category')?.value;
    const amount = parseFloat(document.getElementById('exp-amount')?.value);
    const note = document.getElementById('exp-note')?.value || '';

    const addBtn = document.getElementById('btn-add-expense');
    if (addBtn) {
        addBtn.innerText = "Adding...";
        addBtn.disabled = true;
    }

    try {
        await window.store.addExpense(date, category, amount, note);
        if (window.playBeep) window.playBeep('double');
        if (window.showToast) window.showToast('Expense recorded!', 'success');
        document.getElementById('exp-amount').value = '';
        document.getElementById('exp-note').value = '';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (addBtn) {
            addBtn.innerText = "+ Add Expense";
            addBtn.disabled = false;
        }
    }
}

function formatExpDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

window.deleteExpenseItem = async function(index) {
    if (!confirm("Delete this expense record?")) return;
    try {
        await window.store.deleteExpense(index);
        if (window.showToast) window.showToast('Expense deleted.', 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message, 'error');
    }
}
