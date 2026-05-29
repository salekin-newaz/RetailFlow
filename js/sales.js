/**
 * sales.js - Point of Sale (POS) & Invoice Checkout module v2.0
 */

// Cart state
window.posCart = [];

window.initSales = function() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('sale-date');
    if (dateInput) dateInput.value = today;
    const retDateInput = document.getElementById('sale-ret-date');
    if (retDateInput) retDateInput.value = today;

    renderSales();
    renderSalesReturns();
    renderPosCart();
    updateSaleProductSelect();

    // POS Cart Events
    const addToCartBtn = document.getElementById('btn-add-to-cart');
    if (addToCartBtn) addToCartBtn.addEventListener('click', handleAddToCart);

    const checkoutBtn = document.getElementById('btn-complete-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCompleteCheckout);

    const addRetBtn = document.getElementById('btn-add-sale-return');
    if (addRetBtn) addRetBtn.addEventListener('click', handleAddSaleReturn);

    // Discount changes updates POS cart totals
    const discType = document.getElementById('sale-discount-type');
    const discVal = document.getElementById('sale-discount-value');
    if (discType) discType.addEventListener('change', renderPosCart);
    if (discVal) discVal.addEventListener('input', renderPosCart);

    const csvBtn = document.getElementById('btn-export-csv-sales');
    if (csvBtn) csvBtn.addEventListener('click', handleExportCSVSales);

    // Search/filter
    const searchInput = document.getElementById('sale-search');
    const dateFrom = document.getElementById('sale-date-from');
    const dateTo = document.getElementById('sale-date-to');
    if (searchInput) searchInput.addEventListener('input', renderSales);
    if (dateFrom) dateFrom.addEventListener('change', renderSales);
    if (dateTo) dateTo.addEventListener('change', renderSales);

    window.store.subscribe(() => {
        renderSales();
        renderSalesReturns();
        updateSaleProductSelect();
    });
}

function handleExportCSVSales() {
    const items = getFilteredSales();
    const headers = ["Date", "Invoice No", "Products", "Customer", "Sale Type", "Total Revenue", "Profit", "Seasonal Tag"];
    const rows = items.map(s => {
        const productsLabel = s.items ? s.items.map(x => `${x.name} (x${x.qty})`).join('; ') : `${s.name} (x${s.qty})`;
        const typeLabel = s.isCredit ? 'Due' : 'Cash';
        return [
            s.date,
            s.invoiceNo || 'Legacy',
            productsLabel,
            s.customerName || 'Walk-in Customer',
            typeLabel,
            s.totalSales,
            s.profit,
            s.seasonalOffer || ''
        ];
    });
    window.downloadCSV(rows, headers, `RetailFlow_Sales_${new Date().toISOString().split('T')[0]}.csv`);
}

function updateSaleProductSelect() {
    ['sale-product', 'sale-ret-product'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- ' + (window.currentLanguage === 'bn' ? 'পণ্য নির্বাচন করুন' : 'Select Product') + ' --</option>' +
            window.store.inventory.map(p =>
                `<option value="${p.id}">${p.name} (${p.id} · Stock: ${p.stock} ${p.unit || 'pcs'})</option>`
            ).join('');
        if (window.store.inventory.some(p => p.id === currentVal)) select.value = currentVal;
    });
}

// POS Cart Operations
function handleAddToCart() {
    const prodId = document.getElementById('sale-product')?.value;
    const qtyInput = document.getElementById('sale-qty');
    const qty = parseInt(qtyInput?.value || 1);

    if (!prodId) {
        if (window.showToast) window.showToast('Please select a product first.', 'error');
        return;
    }
    if (qty <= 0) {
        if (window.showToast) window.showToast('Quantity must be greater than zero.', 'error');
        return;
    }

    const product = window.store.inventory.find(p => p.id === prodId);
    if (!product) return;

    // Check if item already exists in cart
    const existingIndex = window.posCart.findIndex(item => item.id === prodId);
    const existingQty = existingIndex >= 0 ? window.posCart[existingIndex].qty : 0;
    const newQty = existingQty + qty;

    if (product.stock < newQty) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(`Not enough stock! Available: ${product.stock} ${product.unit}`, 'error');
        return;
    }

    if (existingIndex >= 0) {
        window.posCart[existingIndex].qty = newQty;
    } else {
        window.posCart.push({
            id: product.id,
            name: product.name,
            qty: qty,
            price: product.sell,
            unit: product.unit || 'pcs'
        });
    }

    if (window.playBeep) window.playBeep('click');
    renderPosCart();
    
    // Clear product select & qty
    document.getElementById('sale-product').value = '';
    if (qtyInput) qtyInput.value = 1;
}

window.removeFromCart = function(index) {
    window.posCart.splice(index, 1);
    if (window.playBeep) window.playBeep('click');
    renderPosCart();
}

function renderPosCart() {
    const tableBody = document.getElementById('cart-table-body');
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount-total');
    const grandTotalEl = document.getElementById('cart-grand-total');
    if (!tableBody) return;

    if (window.posCart.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">${window.t('empty-state')}</td></tr>`;
        if (subtotalEl) subtotalEl.innerText = '৳ 0';
        if (discountEl) discountEl.innerText = '-৳ 0';
        if (grandTotalEl) grandTotalEl.innerText = '৳ 0';
        return;
    }

    let subtotal = 0;
    tableBody.innerHTML = window.posCart.map((item, index) => {
        const total = item.qty * item.price;
        subtotal += total;
        return `<tr>
            <td style="font-weight:500; color:var(--text-primary);">${item.name}</td>
            <td style="text-align:center;">${item.qty} ${item.unit}</td>
            <td>৳ ${item.price.toLocaleString()}</td>
            <td style="font-weight:600; color:var(--text-primary);">৳ ${total.toLocaleString()}</td>
            <td><button class="btn-delete" style="padding: 2px 8px; font-size:0.75rem;" onclick="removeFromCart(${index})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');

    const discType = document.getElementById('sale-discount-type')?.value || 'none';
    const discVal = Number(document.getElementById('sale-discount-value')?.value || 0);

    let discountApplied = 0;
    if (discType === 'percent') {
        discountApplied = subtotal * (discVal / 100);
    } else if (discType === 'flat') {
        discountApplied = discVal;
    }
    if (discountApplied < 0) discountApplied = 0;
    if (discountApplied > subtotal) discountApplied = subtotal;

    const netGrandTotal = subtotal - discountApplied;

    if (subtotalEl) subtotalEl.innerText = `৳ ${subtotal.toLocaleString()}`;
    if (discountEl) discountEl.innerText = `-৳ ${discountApplied.toLocaleString()}`;
    if (grandTotalEl) grandTotalEl.innerText = `৳ ${netGrandTotal.toLocaleString()}`;
}

async function handleCompleteCheckout() {
    const date = document.getElementById('sale-date')?.value;
    const customerId = document.getElementById('sale-customer')?.value;
    const isCredit = document.getElementById('sale-is-credit')?.checked;
    const discountType = document.getElementById('sale-discount-type')?.value || 'none';
    const discountValue = Number(document.getElementById('sale-discount-value')?.value || 0);
    const seasonalTag = document.getElementById('sale-seasonal-offer')?.value || '';

    if (window.posCart.length === 0) {
        if (window.showToast) window.showToast('Your billing cart is empty.', 'error');
        return;
    }

    const checkoutBtn = document.getElementById('btn-complete-checkout');
    if (checkoutBtn) {
        checkoutBtn.innerText = "Processing checkout...";
        checkoutBtn.disabled = true;
    }

    try {
        const invoiceNo = await window.store.addSale(date, window.posCart, isCredit, customerId, discountType, discountValue, seasonalTag);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Sale logged successfully!', 'success');

        // Reload data to ensure latest index is available
        await window.store.loadAllData();

        // Capture newly added invoice index
        const newInvoiceIndex = window.store.sales.findIndex(s => s.invoiceNo === invoiceNo);
        if (newInvoiceIndex >= 0) {
            printSaleReceipt(newInvoiceIndex);
        }

        // Reset POS Cart & inputs
        window.posCart = [];
        if (document.getElementById('sale-discount-type')) document.getElementById('sale-discount-type').value = 'none';
        if (document.getElementById('sale-discount-value')) document.getElementById('sale-discount-value').value = '0';
        if (document.getElementById('sale-seasonal-offer')) document.getElementById('sale-seasonal-offer').value = '';
        renderPosCart();

        // Clear forms
        if (document.getElementById('sale-customer')) document.getElementById('sale-customer').value = '';
        if (document.getElementById('sale-is-credit')) document.getElementById('sale-is-credit').checked = false;
        
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    } finally {
        if (checkoutBtn) {
            checkoutBtn.innerText = "Complete Checkout 🧾";
            checkoutBtn.disabled = false;
        }
    }
}

function getFilteredSales() {
    let items = window.store.sales;
    const search = (document.getElementById('sale-search')?.value || '').toLowerCase().trim();
    const dateFrom = document.getElementById('sale-date-from')?.value || '';
    const dateTo = document.getElementById('sale-date-to')?.value || '';

    if (search) {
        items = items.filter(s => 
            (s.invoiceNo && s.invoiceNo.toLowerCase().includes(search)) || 
            (s.customerName && s.customerName.toLowerCase().includes(search)) ||
            (s.items && s.items.some(item => item.name.toLowerCase().includes(search))) ||
            (s.name && s.name.toLowerCase().includes(search))
        );
    }
    if (dateFrom) items = items.filter(s => s.date >= dateFrom);
    if (dateTo) items = items.filter(s => s.date <= dateTo);
    return items;
}

function renderSales() {
    const tableBody = document.getElementById('sales-table');
    if (!tableBody) return;

    const items = getFilteredSales();

    if (items.length === 0) {
        tableBody.innerHTML = window.getEmptyStateHTML(
            'sales',
            window.store.sales.length === 0 ? 'No Sales Logged' : 'No Matching Transactions',
            window.store.sales.length === 0 ? 'Start scanning/adding products in POS checkout above to log sales!' : 'Try adjusting your search query or date range filters.',
            8
        );
        return;
    }

    // Sort descending by latest transaction
    const sorted = [...items].sort((a,b) => b.timestamp - a.timestamp);

    tableBody.innerHTML = sorted.map((item) => {
        const origIndex = window.store.sales.indexOf(item);
        
        // Build products summary label
        let productsLabel = '';
        if (item.items) {
            productsLabel = item.items.map(x => `${x.name} (x${x.qty})`).join(', ');
            if (productsLabel.length > 50) productsLabel = productsLabel.substring(0, 47) + '...';
        } else {
            productsLabel = `${item.name} (x${item.qty})`;
        }

        const invoiceLabel = item.invoiceNo || `Legacy (${origIndex})`;

        const typeLabel = item.isCredit 
            ? `<span class="badge badge-warning" style="font-size:0.7rem; padding: 2px 6px;">${window.currentLanguage === 'bn' ? 'বাকি' : 'DUE'} · ${item.customerName || window.t('walk-in-customer')}</span>`
            : `<span class="badge badge-success" style="font-size:0.7rem; padding: 2px 6px;">${window.currentLanguage === 'bn' ? 'নগদ' : 'CASH'} ${item.customerName ? '· ' + item.customerName : ''}</span>`;
        
        return `<tr>
            <td class="td-date">${formatDateSales(item.date)}</td>
            <td class="td-name" style="font-weight:600; color:var(--text-primary);">${invoiceLabel}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${productsLabel}</td>
            <td>${typeLabel}</td>
            <td style="font-weight:600; color:var(--text-primary);">৳ ${item.totalSales.toLocaleString()}</td>
            <td class="td-profit owner-only" style="color:var(--success);">৳ ${item.profit.toLocaleString()}</td>
            <td>
                <button class="btn-receipt" onclick="printSaleReceipt(${origIndex})">${window.t('receipt')}</button>
            </td>
            <td>
                <button class="btn-delete" onclick="deleteSaleItem(${origIndex})">${window.t('delete')}</button>
            </td>
        </tr>`;
    }).join('');
}

function renderSalesReturns() {
    const tableBody = document.getElementById('sales-returns-table');
    if (!tableBody) return;

    if (window.store.salesReturns.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">${window.t('empty-state')}</td></tr>`;
        return;
    }

    tableBody.innerHTML = window.store.salesReturns.map((item, index) => {
        const product = window.store.inventory.find(p => p.id === item.id);
        const unit = product ? (product.unit || 'pcs') : 'pcs';
        return `<tr>
            <td class="td-date">${formatDateSales(item.date)}</td>
            <td class="td-name">${item.name} <span class="text-muted">(${item.id})</span></td>
            <td class="td-qty">${item.qty} ${unit}</td>
            <td class="td-refund" style="color:var(--danger);">৳ ${item.totalRefund.toLocaleString()}</td>
            <td>${item.reason}</td>
            <td><button class="btn-delete" onclick="deleteSaleReturnItem(${index})">${window.t('delete')}</button></td>
        </tr>`;
    }).join('');
}

async function handleAddSaleReturn() {
    const date = document.getElementById('sale-ret-date')?.value;
    const prodId = document.getElementById('sale-ret-product')?.value;
    const qty = parseInt(document.getElementById('sale-ret-qty')?.value);
    const reason = document.getElementById('sale-ret-reason')?.value || 'N/A';

    try {
        await window.store.addSaleReturn(date, prodId, qty, reason);
        if (window.playBeep) window.playBeep('success');
        if (window.showToast) window.showToast('Sales return recorded. Stock adjusted.', 'success');
        document.getElementById('sale-ret-qty').value = '';
        document.getElementById('sale-ret-reason').value = '';
    } catch (err) {
        if (window.playBeep) window.playBeep('error');
        if (window.showToast) window.showToast(err.message, 'error');
    }
}

function formatDateSales(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

window.deleteSaleItem = async function(index) {
    if (!confirm("Delete this sale? Stock will be adjusted.")) return;
    try {
        await window.store.deleteSale(index);
        if (window.showToast) window.showToast('Sale deleted.', 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message, 'error');
    }
}

window.deleteSaleReturnItem = async function(index) {
    if (!confirm("Delete this return? Stock will be adjusted.")) return;
    try {
        await window.store.deleteSaleReturn(index);
        if (window.showToast) window.showToast('Sale return deleted.', 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message, 'error');
    }
}

// ============================================
// BATA / APEX STYLE THERMAL RECEIPT PRINTER
// ============================================
window.printSaleReceipt = function(index) {
    const item = window.store.sales[index];
    if (!item) return;

    if (window.playBeep) window.playBeep('success');
    const receiptNo = item.invoiceNo || 'INV-' + Math.floor(100000 + Math.random() * 900000);
    const time = new Date(item.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    let customerDetailsHTML = `<tr><td>Customer: Walk-in</td><td class="right">Type: CASH</td></tr>`;
    let paymentBreakdownHTML = `
        <tr class="total"><td>NET TOTAL:</td><td class="right">৳${item.totalSales.toLocaleString()}</td></tr>
        <tr style="font-size:0.8rem;color:#555"><td>VAT (0%):</td><td class="right">৳0</td></tr>
        <tr class="total"><td>TOTAL PAID:</td><td class="right">৳${item.totalSales.toLocaleString()}</td></tr>
    `;

    if (item.customerId) {
        const customer = window.store.customers.find(c => c.id === item.customerId);
        const due = window.store.getCustomerDue(item.customerId);
        customerDetailsHTML = `
            <tr><td>Customer: ${customer ? customer.name : item.customerName}</td><td class="right">Type: ${item.isCredit ? 'CREDIT / DUE' : 'CASH'}</td></tr>
            ${customer && customer.phone ? `<tr><td colspan="2">Phone: ${customer.phone}</td></tr>` : ''}
        `;

        if (item.isCredit) {
            paymentBreakdownHTML = `
                <tr class="total"><td>NET TOTAL:</td><td class="right">৳${item.totalSales.toLocaleString()}</td></tr>
                <tr style="font-size:0.8rem;color:#555"><td>PAID AMOUNT:</td><td class="right">৳0</td></tr>
                <tr class="total" style="color:#ef4444"><td>DUE CHARGED:</td><td class="right">৳${item.totalSales.toLocaleString()}</td></tr>
                <tr style="font-size:0.85rem;font-weight:bold;color:#000"><td style="padding-top:4px;">CUST. OUTSTANDING:</td><td class="right" style="padding-top:4px;">৳${due.toLocaleString()}</td></tr>
            `;
        } else {
            paymentBreakdownHTML = `
                <tr class="total"><td>NET TOTAL:</td><td class="right">৳${item.totalSales.toLocaleString()}</td></tr>
                <tr style="font-size:0.8rem;color:#555"><td>TOTAL PAID:</td><td class="right">৳${item.totalSales.toLocaleString()}</td></tr>
                <tr style="font-size:0.85rem;font-weight:bold;color:#000"><td style="padding-top:4px;">CUST. OUTSTANDING:</td><td class="right" style="padding-top:4px;">৳${due.toLocaleString()}</td></tr>
            `;
        }
    }

    // Build itemized products list rows
    let productRows = '';
    if (item.items) {
        productRows = item.items.map(x => {
            const product = window.store.inventory.find(inv => inv.id === x.id);
            const unit = product ? (product.unit || 'pcs') : 'pcs';
            return `<tr>
                <td>${x.name}<br><span style="font-size:0.75rem;color:#555">${x.qty} ${unit} x ৳${x.unitPrice.toLocaleString()}</span></td>
                <td class="right" style="vertical-align:middle">${x.qty}</td>
                <td class="right" style="vertical-align:middle">৳${x.totalSales.toLocaleString()}</td>
            </tr>`;
        }).join('');
    } else {
        const product = window.store.inventory.find(inv => inv.id === item.id);
        const unit = product ? (product.unit || 'pcs') : 'pcs';
        productRows = `<tr>
            <td>${item.name}<br><span style="font-size:0.75rem;color:#555">${item.qty} ${unit} x ৳${item.unitPrice.toLocaleString()}</span></td>
            <td class="right" style="vertical-align:middle">${item.qty}</td>
            <td class="right" style="vertical-align:middle">৳${item.totalSales.toLocaleString()}</td>
        </tr>`;
    }

    const printWindow = window.open('', '_blank', 'width=380,height=650');
    if (!printWindow) {
        alert("Allow popups to print receipts!");
        return;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${receiptNo}</title>
    <style>
        body { font-family: 'Courier New', monospace; padding: 10px 20px; color: #000; background: #fff; font-size: 0.85rem; line-height: 1.4; }
        .receipt { max-width: 320px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 12px; }
        .header h1 { font-size: 1.4rem; margin: 0 0 4px; font-weight: 800; letter-spacing: 1px; }
        .header p { margin: 2px 0; color: #333; font-size: 0.75rem; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        td { padding: 3px 0; }
        .right { text-align: right; }
        .total td { font-weight: bold; font-size: 0.95rem; padding-top: 6px; }
        .footer { text-align: center; margin-top: 20px; font-size: 0.7rem; }
    </style></head><body>
    <div class="receipt">
        <div class="header">
            <h1>RETAILFLOW</h1>
            <p>Standard Market, Dhaka</p>
            <p>Phone: +880 1700-000000</p>
        </div>
        <div class="sep"></div>
        <table>
            <tr><td>Invoice: ${receiptNo}</td><td class="right">Date: ${item.date}</td></tr>
            <tr><td>Operator: Manager</td><td class="right">Time: ${time}</td></tr>
            ${customerDetailsHTML}
        </table>
        <div class="sep"></div>
        <table>
            <tr style="border-bottom:1px dashed #000"><th style="text-align:left">Item</th><th class="right">Qty</th><th class="right">Total</th></tr>
            ${productRows}
        </table>
        <div class="sep"></div>
        <table>
            ${paymentBreakdownHTML}
        </table>
        <div class="sep"></div>
        <div class="footer">
            <p>Thank You For Shopping With Us!</p>
            <p>Please Visit Again</p>
            <p style="margin-top:10px;font-size:0.6rem">Powered by RetailFlow</p>
        </div>
    </div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script>
    </body></html>`);
    printWindow.document.close();
}
