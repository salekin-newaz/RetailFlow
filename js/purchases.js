window.initPurchases = function() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('pur-date');
    if (dateInput) dateInput.value = today;
    const retDateInput = document.getElementById('pur-ret-date');
    if (retDateInput) retDateInput.value = today;

    renderPurchases();
    renderPurchaseReturns();
    updatePurProductSelect();

    const addBtn = document.getElementById('btn-add-purchase');
    if (addBtn) addBtn.addEventListener('click', handleAddPurchase);

    const addRetBtn = document.getElementById('btn-add-purchase-return');
    if (addRetBtn) addRetBtn.addEventListener('click', handleAddPurchaseReturn);

    const csvBtn = document.getElementById('btn-export-csv-purchases');
    if (csvBtn) csvBtn.addEventListener('click', handleExportCSVPurchases);

    // Search/filter
    const searchInput = document.getElementById('pur-search');
    const dateFrom = document.getElementById('pur-date-from');
    const dateTo = document.getElementById('pur-date-to');
    if (searchInput) searchInput.addEventListener('input', renderPurchases);
    if (dateFrom) dateFrom.addEventListener('change', renderPurchases);
    if (dateTo) dateTo.addEventListener('change', renderPurchases);

    window.store.subscribe(() => {
        renderPurchases();
        renderPurchaseReturns();
        updatePurProductSelect();
    });
}

function handleExportCSVPurchases() {
    const items = getFilteredPurchases();
    const headers = ["Date", "Product ID", "Product Name", "Supplier", "Quantity", "Unit Cost", "Total Cost"];
    const rows = items.map(p => [
        p.date,
        p.id,
        p.name,
        p.supplierName || 'Walk-in Supplier',
        p.qty,
        p.unitCost || (p.totalCost / p.qty),
        p.totalCost
    ]);
    window.downloadCSV(rows, headers, `RetailFlow_Purchases_${new Date().toISOString().split('T')[0]}.csv`);
}

function updatePurProductSelect() {
    ['pur-product', 'pur-ret-product'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Product --</option>' +
            window.store.inventory.map(p =>
                `<option value="${p.id}">${p.name} (${p.id} · Stock: ${p.stock} ${p.unit || 'pcs'})</option>`
            ).join('');
        if (window.store.inventory.some(p => p.id === currentVal)) select.value = currentVal;
    });
}

function getFilteredPurchases() {
    let items = window.store.purchases;
    const search = (document.getElementById('pur-search')?.value || '').toLowerCase().trim();
    const dateFrom = document.getElementById('pur-date-from')?.value || '';
    const dateTo = document.getElementById('pur-date-to')?.value || '';

    if (search) {
        items = items.filter(p => p.name.toLowerCase().includes(search) || p.id.toLowerCase().includes(search));
    }
    if (dateFrom) items = items.filter(p => p.date >= dateFrom);
    if (dateTo) items = items.filter(p => p.date <= dateTo);
    return items;
}

function renderPurchases() {
    const tableBody = document.getElementById('purchases-table');
    if (!tableBody) return;

    const items = getFilteredPurchases();

    if (items.length === 0) {
        tableBody.innerHTML = window.getEmptyStateHTML(
            'purchases',
            window.store.purchases.length === 0 ? 'No Purchases Logged' : 'No Matching Purchases',
            window.store.purchases.length === 0 ? 'Log your first product stock arrival above!' : 'Try adjusting your search query or date range filters.',
            7
        );
        return;
    }

    tableBody.innerHTML = items.map((item) => {
        const origIndex = window.store.purchases.indexOf(item);
        const product = window.store.inventory.find(p => p.id === item.id);
        const unit = product ? (product.unit || 'pcs') : 'pcs';
        return `<tr>
            <td class="td-date">${formatDate(item.date)}</td>
            <td class="td-name">${item.name} <span class="text-muted">(${item.id})</span></td>
            <td><span style="font-weight:500;color:var(--text-primary);">${item.supplierName || window.t('walk-in-customer')}</span></td>
            <td class="td-qty">${item.qty} ${unit}</td>
            <td>৳ ${(item.unitCost || (item.totalCost / item.qty)).toLocaleString()}</td>
            <td class="td-total-cost">৳ ${item.totalCost.toLocaleString()}</td>
            <td><button class="btn-delete" onclick="deletePurchaseItem(${origIndex})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');
}

function renderPurchaseReturns() {
    const tableBody = document.getElementById('purchase-returns-table');
    if (!tableBody) return;

    if (window.store.purchaseReturns.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    tableBody.innerHTML = window.store.purchaseReturns.map((item, index) => {
        const product = window.store.inventory.find(p => p.id === item.id);
        const unit = product ? (product.unit || 'pcs') : 'pcs';
        return `<tr>
            <td class="td-date">${formatDate(item.date)}</td>
            <td class="td-name">${item.name} <span class="text-muted">(${item.id})</span></td>
            <td class="td-qty">${item.qty} ${unit}</td>
            <td class="td-total-cost">৳ ${item.totalCost.toLocaleString()}</td>
            <td>${item.reason}</td>
            <td><button class="btn-delete" onclick="deletePurchaseReturnItem(${index})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');
}

async function handleAddPurchase() {
    const date = document.getElementById('pur-date')?.value;
    const prodId = document.getElementById('pur-product')?.value;
    const supplierId = document.getElementById('pur-supplier')?.value;
    const qty = parseInt(document.getElementById('pur-qty')?.value);

    const addBtn = document.getElementById('btn-add-purchase');
    if (addBtn) {
        addBtn.innerText = "Logging...";
        addBtn.disabled = true;
    }

    try {
        await window.store.addPurchase(date, prodId, qty, supplierId);
        if (window.playBeep) window.playBeep('double');
        if (window.showToast) window.showToast('Purchase logged successfully!', 'success');
        document.getElementById('pur-qty').value = '';
        if (document.getElementById('pur-supplier')) document.getElementById('pur-supplier').value = '';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (addBtn) {
            addBtn.innerText = "+ Log Purchase";
            addBtn.disabled = false;
        }
    }
}

async function handleAddPurchaseReturn() {
    const date = document.getElementById('pur-ret-date')?.value;
    const prodId = document.getElementById('pur-ret-product')?.value;
    const qty = parseInt(document.getElementById('pur-ret-qty')?.value);
    const reason = document.getElementById('pur-ret-reason')?.value || 'N/A';

    try {
        await window.store.addPurchaseReturn(date, prodId, qty, reason);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Purchase return recorded.', 'success');
        document.getElementById('pur-ret-qty').value = '';
        document.getElementById('pur-ret-reason').value = '';
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

window.deletePurchaseItem = async function(index) {
    if (!confirm("Delete this purchase? Stock will be adjusted.")) return;
    try {
        await window.store.deletePurchase(index);
        if (window.showToast) window.showToast('Purchase deleted.', 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message, 'error');
    }
}

window.deletePurchaseReturnItem = async function(index) {
    if (!confirm("Delete this purchase return? Stock will be adjusted.")) return;
    try {
        await window.store.deletePurchaseReturn(index);
        if (window.showToast) window.showToast('Purchase return deleted.', 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message, 'error');
    }
}
