window.initInventory = function() {
    renderInventory();

    const addBtn = document.getElementById('btn-add-inventory');
    if (addBtn) addBtn.addEventListener('click', handleAddInventory);

    const csvBtn = document.getElementById('btn-export-csv-inventory');
    if (csvBtn) csvBtn.addEventListener('click', handleExportCSVInventory);

    // Search and filter listeners
    const searchInput = document.getElementById('inv-search');
    const catFilter = document.getElementById('inv-filter-category');
    const unitFilter = document.getElementById('inv-filter-unit');

    if (searchInput) searchInput.addEventListener('input', renderInventory);
    if (catFilter) catFilter.addEventListener('change', renderInventory);
    if (unitFilter) unitFilter.addEventListener('change', renderInventory);

    window.store.subscribe(() => {
        renderInventory();
        updateCategoryFilterOptions();
    });

    updateCategoryFilterOptions();
}

function updateCategoryFilterOptions() {
    const catFilter = document.getElementById('inv-filter-category');
    if (!catFilter) return;
    const categories = [...new Set(window.store.inventory.map(p => p.category || 'General'))];
    const currentVal = catFilter.value;
    catFilter.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    if (categories.includes(currentVal)) catFilter.value = currentVal;
}

function getFilteredInventory() {
    let items = window.store.inventory;
    const search = (document.getElementById('inv-search')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('inv-filter-category')?.value || '';
    const unitFilter = document.getElementById('inv-filter-unit')?.value || '';

    if (search) {
        items = items.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search)
        );
    }
    if (catFilter) items = items.filter(p => (p.category || 'General') === catFilter);
    if (unitFilter) items = items.filter(p => (p.unit || 'pcs') === unitFilter);
    return items;
}

function renderInventory() {
    const tableBody = document.getElementById('inventory-table');
    if (!tableBody) return;

    updateInventoryStats();
    renderLowStockBanner();

    const items = getFilteredInventory();

    if (items.length === 0) {
        tableBody.innerHTML = window.getEmptyStateHTML(
            'inventory',
            window.store.inventory.length === 0 ? 'No Products Registered' : 'No Matching Products',
            window.store.inventory.length === 0 ? 'Start adding products above to populate your inventory!' : 'Try adjusting your search query or filters.',
            10
        );
        return;
    }

    tableBody.innerHTML = items.map((item) => {
        const origIndex = window.store.inventory.indexOf(item);
        const unit = item.unit || 'pcs';
        const stockQty = item.stock || 0;
        const minStock = item.minStock || 5;
        let stockBadge;
        if (stockQty === 0) {
            stockBadge = `<span class="badge badge-danger">OUT: 0 ${unit}</span>`;
        } else if (stockQty <= minStock) {
            stockBadge = `<span class="badge badge-warning">LOW: ${stockQty} ${unit}</span>`;
        } else {
            stockBadge = `<span class="badge badge-success">${stockQty} ${unit}</span>`;
        }
        const totalVal = stockQty * item.sell;
        const margin = item.sell > 0 ? (((item.sell - item.cost) / item.sell) * 100).toFixed(1) : '0.0';

        return `<tr>
            <td class="td-id">${item.id}</td>
            <td class="td-name">${item.name}</td>
            <td class="td-category"><span class="category-tag">${item.category || 'General'}</span></td>
            <td class="owner-only">৳ ${item.cost.toLocaleString()}</td>
            <td>৳ ${item.sell.toLocaleString()}</td>
            <td class="owner-only">${margin}%</td>
            <td>${stockBadge}</td>
            <td class="td-minstock">${minStock} ${unit}</td>
            <td class="td-total-value">৳ ${totalVal.toLocaleString()}</td>
            <td><button class="btn-delete" onclick="deleteInventoryItem(${origIndex})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');
}

function handleExportCSVInventory() {
    const items = getFilteredInventory();
    const headers = ["Product ID", "Product Name", "Category", "Cost Price", "Sell Price", "Profit Margin", "Stock", "Min Stock", "Total Value"];
    const rows = items.map(p => {
        const margin = p.sell > 0 ? (((p.sell - p.cost) / p.sell) * 100).toFixed(1) : '0.0';
        return [
            p.id,
            p.name,
            p.category || 'General',
            p.cost,
            p.sell,
            `${margin}%`,
            p.stock,
            p.minStock || 5,
            (p.stock * p.sell)
        ];
    });
    window.downloadCSV(rows, headers, `RetailFlow_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
}

function renderLowStockBanner() {
    const banner = document.getElementById('inv-low-stock-banner');
    if (!banner) return;
    const lowItems = window.store.getLowStockItems();
    if (lowItems.length === 0) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'flex';
    const names = lowItems.map(p => `<strong>${p.name}</strong> (${p.stock} ${p.unit})`).join(', ');
    banner.innerHTML = `
        <svg style="width:20px;height:20px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <span>⚠️ Low Stock Alert: ${names}</span>`;
}

function updateInventoryStats() {
    const f = window.store.getFinancials();
    const itemsEl = document.getElementById('inv-stat-items');
    const qtyEl = document.getElementById('inv-stat-qty');
    const valuationEl = document.getElementById('inv-stat-valuation');

    if (itemsEl) itemsEl.innerText = `${window.store.inventory.length} Products`;
    if (qtyEl) qtyEl.innerText = `${f.totalInventoryQuantity.toLocaleString()} Units`;
    if (valuationEl) valuationEl.innerText = `৳ ${f.totalInventoryValuation.toLocaleString()}`;
}

async function handleAddInventory() {
    const fields = {
        id: document.getElementById('inv-id'),
        name: document.getElementById('inv-name'),
        cost: document.getElementById('inv-cost'),
        sell: document.getElementById('inv-sell'),
        unit: document.getElementById('inv-unit'),
        stock: document.getElementById('inv-stock'),
        category: document.getElementById('inv-category'),
        minStock: document.getElementById('inv-min-stock')
    };

    const addBtn = document.getElementById('btn-add-inventory');
    if (addBtn) {
        addBtn.innerText = "Adding...";
        addBtn.disabled = true;
    }

    try {
        await window.store.addInventory(
            fields.id.value, fields.name.value,
            Number(fields.cost.value), Number(fields.sell.value),
            fields.unit.value, Number(fields.stock.value) || 0,
            fields.category.value || 'General',
            Number(fields.minStock.value) || 5
        );
        if (window.playBeep) window.playBeep('double');
        if (window.showToast) window.showToast('Product added successfully!', 'success');

        // Clear fields
        fields.id.value = '';
        fields.name.value = '';
        fields.cost.value = '';
        fields.sell.value = '';
        fields.unit.value = 'pcs';
        fields.stock.value = '0';
        fields.category.value = 'General';
        fields.minStock.value = '5';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (addBtn) {
            addBtn.innerText = "+ Add Product";
            addBtn.disabled = false;
        }
    }
}

// Global delete function for onclick
window.deleteInventoryItem = async function(index) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
        await window.store.deleteInventory(index);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Product deleted.', 'success');
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    }
}
