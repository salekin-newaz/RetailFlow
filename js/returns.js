/**
 * returns.js - Returns Ledger Page Controller
 */

window.initReturns = function() {
    renderReturnsPage();

    // Hook forms
    const btnSalesRet = document.getElementById('btn-log-sales-return');
    const btnPurRet = document.getElementById('btn-log-purchase-return');

    if (btnSalesRet) btnSalesRet.addEventListener('click', handleSalesReturnSubmit);
    if (btnPurRet) btnPurRet.addEventListener('click', handlePurchaseReturnSubmit);

    // Subscribe to store updates
    window.store.subscribe(() => {
        renderReturnsPage();
        updateReturnProductSelectors();
    });

    // On boot
    updateReturnProductSelectors();
}

function updateReturnProductSelectors() {
    const sSel = document.getElementById('ret-sale-product');
    const pSel = document.getElementById('ret-pur-product');
    if (!sSel || !pSel) return;

    const currentSalesVal = sSel.value;
    const currentPurVal = pSel.value;

    const optHtml = '<option value="">-- Choose Product --</option>' +
        window.store.inventory.map(p => `<option value="${p.id}">${p.name} (${p.id})</option>`).join('');

    sSel.innerHTML = optHtml;
    pSel.innerHTML = optHtml;

    sSel.value = currentSalesVal;
    pSel.value = currentPurVal;
}

function renderReturnsPage() {
    const tableBody = document.getElementById('returns-ledger-table');
    if (!tableBody) return;

    const allReturns = [];
    window.store.salesReturns.forEach(r => {
        allReturns.push({ ...r, type: 'sales_return' });
    });
    window.store.purchaseReturns.forEach(r => {
        allReturns.push({ ...r, type: 'purchase_return' });
    });

    // Sort by date desc
    allReturns.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allReturns.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No returns logged in your ledger yet.</td></tr>`;
        return;
    }

    tableBody.innerHTML = allReturns.map(r => {
        const typeBadge = r.type === 'sales_return' 
            ? `<span class="badge badge-success" data-i18n="badge-sales-return">Sales Return</span>` 
            : `<span class="badge badge-danger" data-i18n="badge-pur-return">Purchase Return</span>`;

        const amountVal = r.type === 'sales_return' ? r.totalRefund : r.totalCost;

        return `<tr>
            <td class="td-date">${r.date}</td>
            <td>${typeBadge}</td>
            <td class="td-name">${r.name} <span class="text-muted">(${r.id})</span></td>
            <td class="td-qty">${r.qty}</td>
            <td class="${r.type === 'sales_return' ? 'td-refund' : 'td-total-cost'}">৳ ${amountVal.toLocaleString()}</td>
            <td class="td-note">${r.reason || 'N/A'}</td>
            <td>
                <button class="btn-delete" onclick="deleteReturnItem('${r.uuid}', '${r.type}', '${r.productId}', ${r.qty})">
                    Delete
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function handleSalesReturnSubmit() {
    const dateEl = document.getElementById('ret-sale-date');
    const prodEl = document.getElementById('ret-sale-product');
    const qtyEl = document.getElementById('ret-sale-qty');
    const amtEl = document.getElementById('ret-sale-amount');
    const reasonEl = document.getElementById('ret-sale-reason');

    if (!dateEl.value || !prodEl.value || qtyEl.value <= 0 || amtEl.value < 0) {
        window.showToast("All fields are required. Qty and Refund must be positive.", "error");
        if (window.playBeep) window.playBeep('error');
        return;
    }

    try {
        await window.store.addGeneralReturn(
            dateEl.value,
            'sales_return',
            prodEl.value,
            Number(qtyEl.value),
            Number(amtEl.value),
            reasonEl.value.trim()
        );
        window.showToast("Customer Sales Return processed successfully!", "success");
        if (window.playBeep) window.playBeep('double');

        // Reset
        qtyEl.value = '';
        amtEl.value = '';
        reasonEl.value = '';
    } catch (err) {
        window.showToast("Return failed: " + err.message, "error");
        if (window.playBeep) window.playBeep('error');
    }
}

async function handlePurchaseReturnSubmit() {
    const dateEl = document.getElementById('ret-pur-date');
    const prodEl = document.getElementById('ret-pur-product');
    const qtyEl = document.getElementById('ret-pur-qty');
    const amtEl = document.getElementById('ret-pur-amount');
    const reasonEl = document.getElementById('ret-pur-reason');

    if (!dateEl.value || !prodEl.value || qtyEl.value <= 0 || amtEl.value < 0) {
        window.showToast("All fields are required. Qty and Credit value must be positive.", "error");
        if (window.playBeep) window.playBeep('error');
        return;
    }

    try {
        await window.store.addGeneralReturn(
            dateEl.value,
            'purchase_return',
            prodEl.value,
            Number(qtyEl.value),
            Number(amtEl.value),
            reasonEl.value.trim()
        );
        window.showToast("Supplier Purchase Return processed successfully!", "success");
        if (window.playBeep) window.playBeep('double');

        // Reset
        qtyEl.value = '';
        amtEl.value = '';
        reasonEl.value = '';
    } catch (err) {
        window.showToast("Return failed: " + err.message, "error");
        if (window.playBeep) window.playBeep('error');
    }
}

window.deleteReturnItem = async function(uuid, type, productId, qty) {
    if (!confirm("Remove this return record? Product stocks will adjust automatically.")) return;
    try {
        await window.store.deleteGeneralReturn(uuid, type, productId, qty);
        window.showToast("Return record removed.", "success");
        if (window.playBeep) window.playBeep('success');
    } catch (err) {
        window.showToast("Delete failed: " + err.message, "error");
        if (window.playBeep) window.playBeep('error');
    }
}
