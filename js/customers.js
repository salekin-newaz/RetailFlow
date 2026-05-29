/**
 * customers.js - Customers Management & Due Collections module v2.0
 */

window.initCustomers = function() {
    const payDateInput = document.getElementById('pay-date');
    if (payDateInput) payDateInput.value = new Date().toISOString().split('T')[0];

    renderCustomers();
    renderPayments();
    updateCustomerSelects();

    const addBtn = document.getElementById('btn-add-customer');
    if (addBtn) addBtn.addEventListener('click', handleAddCustomer);

    const collectBtn = document.getElementById('btn-add-payment');
    if (collectBtn) collectBtn.addEventListener('click', handleCollectPayment);

    const searchInput = document.getElementById('cust-search');
    if (searchInput) searchInput.addEventListener('input', renderCustomers);

    window.store.subscribe(() => {
        renderCustomers();
        renderPayments();
        updateCustomerSelects();
    });
}

function updateCustomerSelects() {
    const selectIds = ['sale-customer', 'pay-customer'];
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        const options = window.store.customers.map(c => {
            const due = window.store.getCustomerDue(c.id);
            return `<option value="${c.id}">${c.name} (${c.phone || 'No Phone'}${due > 0 ? ' · ' + (window.currentLanguage === 'bn' ? 'বাকি: ৳' : 'Due: ৳') + due.toLocaleString() : ''})</option>`;
        });
        select.innerHTML = `<option value="">${id === 'sale-customer' ? '-- ' + window.t('walk-in-customer') + ' --' : '-- ' + window.t('pay-customer') + ' --'}</option>` + options.join('');
        if (window.store.customers.some(c => c.id === currentVal)) {
            select.value = currentVal;
        }
    });
}

function getFilteredCustomers() {
    let items = window.store.customers;
    const search = (document.getElementById('cust-search')?.value || '').toLowerCase().trim();
    if (search) {
        items = items.filter(c => 
            c.name.toLowerCase().includes(search) || 
            (c.phone && c.phone.includes(search)) || 
            (c.address && c.address.toLowerCase().includes(search))
        );
    }
    return items;
}

function renderCustomers() {
    const tableBody = document.getElementById('customers-table');
    const statsCount = document.getElementById('cust-stat-count');
    const statsDues = document.getElementById('cust-stat-dues');
    const statsCollected = document.getElementById('cust-stat-collected');
    if (!tableBody) return;

    const items = getFilteredCustomers();

    // Dues totals
    let totalDues = window.store.getTotalOutstandingDues();
    let totalCollected = window.store.payments.reduce((sum, p) => sum + p.amount, 0);

    if (statsCount) statsCount.innerText = `${window.store.customers.length} ${window.currentLanguage === 'bn' ? 'গ্রাহক' : 'Customers'}`;
    if (statsDues) statsDues.innerText = `৳ ${totalDues.toLocaleString()}`;
    if (statsCollected) statsCollected.innerText = `৳ ${totalCollected.toLocaleString()}`;

    if (items.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    tableBody.innerHTML = items.map((item) => {
        const origIndex = window.store.customers.indexOf(item);
        const due = window.store.getCustomerDue(item.id);
        const dueBadge = due > 0 
            ? `<span style="color:var(--danger); font-weight:700;">৳ ${due.toLocaleString()}</span>` 
            : `<span style="color:var(--success);">${window.currentLanguage === 'bn' ? '৳ ০ (পরিশোধিত)' : '৳ 0 (Paid)'}</span>`;
        const collectLabel = window.currentLanguage === 'bn' ? '💵 বাকি আদায়' : '💵 Collect Due';
        return `<tr>
            <td class="td-name" style="font-weight:600; color:var(--text-primary);">${item.name}</td>
            <td>${item.phone || '—'}</td>
            <td>${item.address || '—'}</td>
            <td>${dueBadge}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    ${due > 0 ? `<button class="btn-receipt" style="background:var(--success-glow); color:var(--success); border:1px solid rgba(16,185,129,0.3);" onclick="quickCollectDue('${item.id}')">${collectLabel}</button>` : ''}
                    <button class="btn-delete" onclick="deleteCustomerItem(${origIndex})">${window.t('delete')}</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

window.quickCollectDue = function(customerId) {
    const payCustomer = document.getElementById('pay-customer');
    if (payCustomer) {
        payCustomer.value = customerId;
        const due = window.store.getCustomerDue(customerId);
        const payAmount = document.getElementById('pay-amount');
        if (payAmount) payAmount.value = due;
        payCustomer.scrollIntoView({ behavior: 'smooth' });
    }
}

function renderPayments() {
    const tableBody = document.getElementById('payments-table');
    if (!tableBody) return;

    if (window.store.payments.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    // Sort by latest payment
    const sorted = [...window.store.payments].sort((a,b) => b.timestamp - a.timestamp);

    tableBody.innerHTML = sorted.map((item) => {
        const origIndex = window.store.payments.indexOf(item);
        return `<tr>
            <td class="td-date">${formatDate(item.date)}</td>
            <td class="td-name">${item.customerName}</td>
            <td style="color:var(--success); font-weight:600;">৳ ${item.amount.toLocaleString()}</td>
            <td><span style="font-style:italic;color:var(--text-secondary);">${item.note || '—'}</span></td>
            <td><button class="btn-delete" onclick="deletePaymentLog(${origIndex})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');
}

async function handleAddCustomer() {
    const nameEl = document.getElementById('cust-name');
    const phoneEl = document.getElementById('cust-phone');
    const addressEl = document.getElementById('cust-address');

    if (!nameEl) return;

    const addBtn = document.getElementById('btn-add-customer');
    if (addBtn) {
        addBtn.innerText = "Adding...";
        addBtn.disabled = true;
    }

    try {
        await window.store.addCustomer(nameEl.value, phoneEl.value, addressEl.value);
        if (window.playBeep) window.playBeep('double');
        if (window.showToast) window.showToast('Customer added successfully!', 'success');
        
        nameEl.value = '';
        phoneEl.value = '';
        addressEl.value = '';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (addBtn) {
            addBtn.innerText = "+ Add Customer";
            addBtn.disabled = false;
        }
    }
}

async function handleCollectPayment() {
    const dateEl = document.getElementById('pay-date');
    const customerEl = document.getElementById('pay-customer');
    const amountEl = document.getElementById('pay-amount');
    const noteEl = document.getElementById('pay-note');

    if (!customerEl || !amountEl) return;

    const date = dateEl?.value;
    const customerId = customerEl.value;
    const amount = Number(amountEl.value);
    const note = noteEl?.value || '';

    const collectBtn = document.getElementById('btn-add-payment');
    if (collectBtn) {
        collectBtn.innerText = "Collecting...";
        collectBtn.disabled = true;
    }

    try {
        await window.store.addPayment(date, customerId, amount, note);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Payment collected and logged!', 'success');
        
        amountEl.value = '';
        noteEl.value = '';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (collectBtn) {
            collectBtn.innerText = "💵 Collect";
            collectBtn.disabled = false;
        }
    }
}

window.deleteCustomerItem = async function(index) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
        await window.store.deleteCustomer(index);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Customer deleted.', 'success');
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    }
}

window.deletePaymentLog = async function(index) {
    if (!confirm("Are you sure you want to delete this payment log? Credit due will be restored.")) return;
    try {
        await window.store.deletePayment(index);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Payment log deleted. Credit dues restored.', 'success');
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}
