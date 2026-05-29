/**
 * suppliers.js - Suppliers Management module v2.0
 */

window.initSuppliers = function() {
    renderSuppliers();
    updateSupplierSelects();

    const addBtn = document.getElementById('btn-add-supplier');
    if (addBtn) addBtn.addEventListener('click', handleAddSupplier);

    const searchInput = document.getElementById('sup-search');
    if (searchInput) searchInput.addEventListener('input', renderSuppliers);

    const historySelect = document.getElementById('sup-history-select');
    if (historySelect) historySelect.addEventListener('change', renderSupplierPurchases);

    window.store.subscribe(() => {
        renderSuppliers();
        updateSupplierSelects();
        renderSupplierPurchases();
    });
}

function updateSupplierSelects() {
    const selectIds = ['pur-supplier', 'sup-history-select'];
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        const options = window.store.suppliers.map(s => 
            `<option value="${s.id}">${s.name} (${s.phone || 'No Phone'})</option>`
        );
        select.innerHTML = `<option value="">${id === 'pur-supplier' ? '-- ' + window.t('direct-supplier') + ' --' : '-- ' + window.t('sup-select-label') + ' --'}</option>` + options.join('');
        if (window.store.suppliers.some(s => s.id === currentVal)) {
            select.value = currentVal;
        }
    });
}

function getFilteredSuppliers() {
    let items = window.store.suppliers;
    const search = (document.getElementById('sup-search')?.value || '').toLowerCase().trim();
    if (search) {
        items = items.filter(s => 
            s.name.toLowerCase().includes(search) || 
            (s.phone && s.phone.includes(search)) || 
            (s.notes && s.notes.toLowerCase().includes(search))
        );
    }
    return items;
}

function renderSuppliers() {
    const tableBody = document.getElementById('suppliers-table');
    const statsCount = document.getElementById('sup-stat-count');
    const statsOutstanding = document.getElementById('sup-stat-outstanding');
    if (!tableBody) return;

    const items = getFilteredSuppliers();
    
    // Calculate total outstanding payments across all suppliers
    let totalOutstanding = 0;
    window.store.suppliers.forEach(s => {
        totalOutstanding += window.store.getSupplierOutstanding(s.id);
    });

    if (statsCount) statsCount.innerText = `${window.store.suppliers.length} ${window.currentLanguage === 'bn' ? 'সরবরাহকারী' : 'Suppliers'}`;
    if (statsOutstanding) statsOutstanding.innerText = `৳ ${totalOutstanding.toLocaleString()}`;

    if (items.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    tableBody.innerHTML = items.map((item) => {
        const origIndex = window.store.suppliers.indexOf(item);
        const outstanding = window.store.getSupplierOutstanding(item.id);
        const viewLabel = window.currentLanguage === 'bn' ? '👁 ক্রয়সমূহ দেখুন' : '👁 View Purchases';
        return `<tr>
            <td class="td-name" style="font-weight:600; color:var(--text-primary);">${item.name}</td>
            <td>${item.phone || '—'}</td>
            <td>${item.address || '—'}</td>
            <td><span style="font-style:italic;color:var(--text-secondary);">${item.notes || '—'}</span></td>
            <td style="color:var(--danger); font-weight:600;">৳ ${outstanding.toLocaleString()}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn-receipt" style="background:var(--primary-glow); color:var(--primary-light); border:1px solid rgba(124,58,237,0.3);" onclick="selectSupplierForHistory('${item.id}')">${viewLabel}</button>
                    <button class="btn-delete" onclick="deleteSupplierItem(${origIndex})">${window.t('delete')}</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

window.selectSupplierForHistory = function(supId) {
    const historySelect = document.getElementById('sup-history-select');
    if (historySelect) {
        historySelect.value = supId;
        renderSupplierPurchases();
        // Smooth scroll to history panel
        historySelect.scrollIntoView({ behavior: 'smooth' });
    }
}

function renderSupplierPurchases() {
    const tableBody = document.getElementById('supplier-purchases-table');
    const select = document.getElementById('sup-history-select');
    if (!tableBody || !select) return;

    const supplierId = select.value;
    if (!supplierId) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    const supplier = window.store.suppliers.find(s => s.id === supplierId);
    const purchases = window.store.getSupplierPurchases(supplierId);

    if (purchases.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    tableBody.innerHTML = purchases.map(p => {
        const product = window.store.inventory.find(item => item.id === p.id);
        const unit = product ? (product.unit || 'pcs') : 'pcs';
        return `<tr>
            <td class="td-date">${formatDate(p.date)}</td>
            <td class="td-id">${p.id}</td>
            <td class="td-name">${p.name}</td>
            <td class="td-qty">${p.qty} ${unit}</td>
            <td>৳ ${p.unitCost.toLocaleString()}</td>
            <td style="font-weight:600; color:var(--text-primary);">৳ ${p.totalCost.toLocaleString()}</td>
        </tr>`;
    }).join('');
}

async function handleAddSupplier() {
    const nameEl = document.getElementById('sup-name');
    const phoneEl = document.getElementById('sup-phone');
    const addressEl = document.getElementById('sup-address');
    const notesEl = document.getElementById('sup-notes');

    if (!nameEl) return;

    const addBtn = document.getElementById('btn-add-supplier');
    if (addBtn) {
        addBtn.innerText = "Adding...";
        addBtn.disabled = true;
    }

    try {
        await window.store.addSupplier(nameEl.value, phoneEl.value, addressEl.value, notesEl.value);
        if (window.playBeep) window.playBeep('double');
        if (window.showToast) window.showToast('Supplier added successfully!', 'success');
        
        nameEl.value = '';
        phoneEl.value = '';
        addressEl.value = '';
        notesEl.value = '';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (addBtn) {
            addBtn.innerText = "+ Add Supplier";
            addBtn.disabled = false;
        }
    }
}

window.deleteSupplierItem = async function(index) {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
        await window.store.deleteSupplier(index);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Supplier deleted.', 'success');
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
