/**
 * settings.js - Administrative Settings & Ledger Backups Page Controller
 */

window.initSettings = function() {
    renderSettingsPage();

    // Hook forms
    const shopForm = document.getElementById('settings-shop-form');
    const inviteForm = document.getElementById('settings-invite-form');
    const btnExport = document.getElementById('btn-backup-export');
    const btnImport = document.getElementById('btn-backup-import');

    if (shopForm) shopForm.addEventListener('submit', handleShopInfoSubmit);
    if (inviteForm) inviteForm.addEventListener('submit', handleInviteSubmit);
    if (btnExport) btnExport.addEventListener('click', handleJSONBackupExport);
    if (btnImport) btnImport.addEventListener('click', handleJSONBackupRestore);

    // Subscribe to store updates
    window.store.subscribe(() => {
        renderSettingsPage();
    });
}

async function renderSettingsPage() {
    if (!window.store.profile || window.store.profile.role !== 'owner') return;

    // Load shop metadata
    const shop = window.store.shop;
    if (shop) {
        setVal('shop-name-input', shop.name || '');
        setVal('shop-owner-input', shop.owner_name || '');
        setVal('shop-address-input', shop.address || '');
        setVal('shop-phone-input', shop.phone || '');
    }

    // Render active staff table
    const tableBody = document.getElementById('settings-users-table');
    if (tableBody) {
        const staff = window.store.staffList;
        if (staff.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="empty-state">No staff profiles registered.</td></tr>`;
        } else {
            tableBody.innerHTML = staff.map(s => {
                const roleBadge = s.role === 'owner' 
                    ? `<span class="badge badge-success">Owner</span>`
                    : s.role === 'cashier' 
                    ? `<span class="badge badge-warning">Cashier</span>`
                    : `<span class="badge badge-success" style="background:rgba(59,130,246,0.15);color:#3b82f6;">Viewer</span>`;

                return `<tr>
                    <td class="td-name">${s.full_name || 'Staff User'}</td>
                    <td>${roleBadge}</td>
                    <td><span class="badge badge-success" style="animation:none;">Active</span></td>
                </tr>`;
            }).join('');
        }
    }

    // Retrieve and display Last Backup Date
    try {
        const val = await window.store.getLocalItem('rf_last_backup_date', 'null');
        const lastBackupEl = document.getElementById('last-backup-date-display');
        if (lastBackupEl) {
            if (val && val !== 'null') {
                const date = new Date(val);
                lastBackupEl.innerText = date.toLocaleString();
            } else {
                lastBackupEl.innerText = 'Never';
            }
        }
    } catch (e) {
        console.error("Failed to load last backup date:", e);
    }
}

async function handleShopInfoSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('shop-name-input').value.trim();
    const owner = document.getElementById('shop-owner-input').value.trim();
    const address = document.getElementById('shop-address-input').value.trim();
    const phone = document.getElementById('shop-phone-input').value.trim();

    try {
        await window.store.updateShopInfo(name, owner, address, phone);
        window.showToast("Shop profile updated successfully!", "success");
        if (window.playBeep) window.playBeep('success');
    } catch (err) {
        window.showToast("Update failed: " + err.message, "error");
        if (window.playBeep) window.playBeep('error');
    }
}

async function handleInviteSubmit(e) {
    e.preventDefault();
    const emailEl = document.getElementById('invite-email');
    const roleEl = document.getElementById('invite-role');

    if (!emailEl.value) return;

    try {
        await window.store.sendInvitation(emailEl.value, roleEl.value);
        window.showToast(`Invitation sent to ${emailEl.value}!`, "success");
        if (window.playBeep) window.playBeep('double');
        
        emailEl.value = '';
    } catch (err) {
        window.showToast("Invitation failed: " + err.message, "error");
        if (window.playBeep) window.playBeep('error');
    }
}

async function handleJSONBackupExport() {
    if (window.playBeep) window.playBeep('success');

    // Consolidate full ledger data
    const backupData = {
        retailflow_ledger_version: "2.0-cloud",
        exported_at: new Date().toISOString(),
        shop_id: window.store.profile ? window.store.profile.shop_id : 'guest-shop-id',
        shop_name: window.store.shop ? window.store.shop.name : 'Store',
        
        // Include raw cached operational arrays
        products: window.store.inventory.map(p => ({
            product_code: p.id,
            name: p.name,
            category: p.category,
            cost_price: p.cost,
            selling_price: p.sell,
            stock: p.stock,
            unit_type: p.unit,
            low_stock_threshold: p.minStock
        })),
        suppliers: window.store.suppliers.map(s => ({
            name: s.name, phone: s.phone, address: s.address, notes: s.notes
        })),
        customers: window.store.customers.map(c => ({
            name: c.name, phone: c.phone, total_due: c.total_due
        })),
        expenses: window.store.expenses.map(e => ({
            category: e.category, amount: e.amount, note: e.note, expense_date: e.date
        })),
        // flat inserts mapped
        purchases: window.store.purchases.map(p => ({
            product_code: p.id, supplier_name: p.supplierName, quantity: p.qty, 
            cost_per_unit: p.unitCost, total_cost: p.totalCost, purchase_date: p.date
        })),
        sales: window.store.sales.flatMap(s => s.items.map(item => ({
            invoice_no: s.invoiceNo, product_code: item.id, customer_name: s.customerName,
            quantity: item.qty, unit_price: item.unitPrice, total_revenue: item.totalSales,
            estimated_profit: item.profit, is_credit: s.isCredit, amount_paid: s.isCredit ? 0 : item.totalSales,
            sale_date: s.date,
            discount_amount: item.discountAmount || 0,
            seasonal_offer: s.seasonalOffer || ''
        }))),
        payments: window.store.payments.map(p => ({
            customer_name: p.customerName, amount: p.amount, payment_date: p.date, note: p.note
        })),
        returns: [
            ...window.store.salesReturns.map(r => ({
                type: 'sales_return', product_code: r.id, quantity: r.qty, amount: r.totalRefund, reason: r.reason, return_date: r.date
            })),
            ...window.store.purchaseReturns.map(r => ({
                type: 'purchase_return', product_code: r.id, quantity: r.qty, amount: r.totalCost, reason: r.reason, return_date: r.date
            }))
        ]
    };

    // Store last backup date locally
    const lastBackupStr = new Date().toISOString();
    await window.store.setLocalItem('rf_last_backup_date', lastBackupStr);

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `RetailFlow_Backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    
    window.showToast("Ledger JSON backup downloaded!", "success");

    // Force re-render of settings page to reflect new backup date
    renderSettingsPage();
}

async function handleJSONBackupRestore() {
    const fileEl = document.getElementById('backup-import-file');
    if (!fileEl || fileEl.files.length === 0) {
        window.showToast("Please select a JSON backup file first.", "warning");
        if (window.playBeep) window.playBeep('error');
        return;
    }

    if (!confirm("⚠️ WARNING: This will completely wipe all CURRENT products, sales, purchases, customers, and expenses for your shop and restore the backup database! Proceed?")) return;

    const file = fileEl.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.products) throw new Error("Invalid backup format: Missing products list.");

            const shopId = window.store.profile ? window.store.profile.shop_id : 'guest-shop-id';

            if (window.store.isMock) {
                window.showToast("Restoring backup database locally...", "info");

                // 2. Insert Products
                const productCodeMap = {};
                const rowsProducts = [];
                if (data.products && data.products.length > 0) {
                    data.products.forEach(p => {
                        const mockId = 'mock-prod-' + Math.random().toString(36).substr(2, 9);
                        productCodeMap[p.product_code] = mockId;
                        rowsProducts.push({
                            id: mockId,
                            shop_id: shopId,
                            product_code: p.product_code,
                            name: p.name,
                            category: p.category || 'General',
                            cost_price: Number(p.cost_price),
                            selling_price: Number(p.selling_price),
                            stock: Number(p.stock),
                            unit_type: p.unit_type || 'pcs',
                            low_stock_threshold: Number(p.low_stock_threshold) || 10
                        });
                    });
                    const existing = await window.store.getLocalItem('rf_mock_products', '[]');
                    const filtered = existing.filter(x => x.shop_id !== shopId);
                    await window.store.setLocalItem('rf_mock_products', [...filtered, ...rowsProducts]);
                }

                // 3. Insert Suppliers
                const supplierNameMap = {};
                const rowsSuppliers = [];
                if (data.suppliers && data.suppliers.length > 0) {
                    data.suppliers.forEach(s => {
                        const mockId = 'mock-sup-' + Math.random().toString(36).substr(2, 9);
                        supplierNameMap[s.name] = mockId;
                        rowsSuppliers.push({
                            id: mockId,
                            shop_id: shopId,
                            name: s.name,
                            phone: s.phone || '',
                            address: s.address || '',
                            notes: s.notes || ''
                        });
                    });
                    const existing = await window.store.getLocalItem('rf_mock_suppliers', '[]');
                    const filtered = existing.filter(x => x.shop_id !== shopId);
                    await window.store.setLocalItem('rf_mock_suppliers', [...filtered, ...rowsSuppliers]);
                }

                // 4. Insert Customers
                const customerNameMap = {};
                const rowsCustomers = [];
                if (data.customers && data.customers.length > 0) {
                    data.customers.forEach(c => {
                        const mockId = 'mock-cust-' + Math.random().toString(36).substr(2, 9);
                        customerNameMap[c.name] = mockId;
                        rowsCustomers.push({
                            id: mockId,
                            shop_id: shopId,
                            name: c.name,
                            phone: c.phone || '',
                            total_due: Number(c.total_due) || 0
                        });
                    });
                    const existing = await window.store.getLocalItem('rf_mock_customers', '[]');
                    const filtered = existing.filter(x => x.shop_id !== shopId);
                    await window.store.setLocalItem('rf_mock_customers', [...filtered, ...rowsCustomers]);
                }

                // 5. Insert Expenses
                if (data.expenses && data.expenses.length > 0) {
                    const rowsExpenses = data.expenses.map(exp => ({
                        id: 'mock-exp-' + Math.random().toString(36).substr(2, 9),
                        shop_id: shopId,
                        category: exp.category,
                        amount: Number(exp.amount),
                        note: exp.note || '',
                        expense_date: exp.expense_date
                    }));
                    const existing = await window.store.getLocalItem('rf_mock_expenses', '[]');
                    const filtered = existing.filter(x => x.shop_id !== shopId);
                    await window.store.setLocalItem('rf_mock_expenses', [...filtered, ...rowsExpenses]);
                }

                // 6. Insert Purchases
                if (data.purchases && data.purchases.length > 0) {
                    const rowsPurchases = data.purchases.map(p => {
                        const productId = productCodeMap[p.product_code];
                        const supplierId = supplierNameMap[p.supplier_name] || null;
                        if (!productId) return null;
                        return {
                            id: 'mock-pur-' + Math.random().toString(36).substr(2, 9),
                            shop_id: shopId,
                            product_id: productId,
                            supplier_id: supplierId,
                            quantity: Number(p.quantity),
                            cost_per_unit: Number(p.cost_per_unit),
                            total_cost: Number(p.total_cost),
                            purchase_date: p.purchase_date
                        };
                    }).filter(x => x !== null);
                    
                    if (rowsPurchases.length > 0) {
                        const existing = await window.store.getLocalItem('rf_mock_purchases', '[]');
                        const filtered = existing.filter(x => x.shop_id !== shopId);
                        await window.store.setLocalItem('rf_mock_purchases', [...filtered, ...rowsPurchases]);
                    }
                }

                // 7. Insert Sales
                if (data.sales && data.sales.length > 0) {
                    const rowsSales = data.sales.map(s => {
                        const productId = productCodeMap[s.product_code];
                        const customerId = customerNameMap[s.customer_name] || null;
                        if (!productId) return null;
                        return {
                            id: 'mock-sale-' + Math.random().toString(36).substr(2, 9),
                            shop_id: shopId,
                            invoice_no: s.invoice_no,
                            product_id: productId,
                            customer_id: customerId,
                            quantity: Number(s.quantity),
                            unit_price: Number(s.unit_price),
                            discount_amount: Number(s.discount_amount) || 0,
                            total_revenue: Number(s.total_revenue),
                            estimated_profit: Number(s.estimated_profit),
                            is_credit: !!s.is_credit,
                            amount_paid: Number(s.amount_paid) || 0,
                            seasonal_offer: s.seasonal_offer || '',
                            sale_date: s.sale_date,
                            created_at: new Date().toISOString()
                        };
                    }).filter(x => x !== null);

                    if (rowsSales.length > 0) {
                        const existing = await window.store.getLocalItem('rf_mock_sales', '[]');
                        const filtered = existing.filter(x => x.shop_id !== shopId);
                        await window.store.setLocalItem('rf_mock_sales', [...filtered, ...rowsSales]);
                    }
                }

                // 8. Insert Payments
                if (data.payments && data.payments.length > 0) {
                    const rowsPayments = data.payments.map(p => {
                        const customerId = customerNameMap[p.customer_name];
                        if (!customerId) return null;
                        return {
                            id: 'mock-pay-' + Math.random().toString(36).substr(2, 9),
                            shop_id: shopId,
                            customer_id: customerId,
                            amount: Number(p.amount),
                            payment_date: p.payment_date,
                            note: p.note || ''
                        };
                    }).filter(x => x !== null);

                    if (rowsPayments.length > 0) {
                        const existing = await window.store.getLocalItem('rf_mock_payments', '[]');
                        const filtered = existing.filter(x => x.shop_id !== shopId);
                        await window.store.setLocalItem('rf_mock_payments', [...filtered, ...rowsPayments]);
                    }
                }

                // 9. Insert Returns
                if (data.returns && data.returns.length > 0) {
                    const rowsReturns = data.returns.map(r => {
                        const productId = productCodeMap[r.product_code];
                        if (!productId) return null;
                        return {
                            id: 'mock-ret-' + Math.random().toString(36).substr(2, 9),
                            shop_id: shopId,
                            type: r.type,
                            product_id: productId,
                            quantity: Number(r.quantity),
                            amount: Number(r.amount),
                            reason: r.reason || '',
                            return_date: r.return_date
                        };
                    }).filter(x => x !== null);

                    if (rowsReturns.length > 0) {
                        const existing = await window.store.getLocalItem('rf_mock_returns', '[]');
                        const filtered = existing.filter(x => x.shop_id !== shopId);
                        await window.store.setLocalItem('rf_mock_returns', [...filtered, ...rowsReturns]);
                    }
                }

                window.showToast("Local ledger restore completed successfully! Synchronizing...", "success");
                if (window.playBeep) window.playBeep('double');
                await window.store.loadAllData();
                fileEl.value = '';
                return;
            }

            window.showToast("Wiping local shop tables...", "info");

            // 1. Wipe current shop data securely (RLS scopes this operation to this shop only!)
            await window.supabaseClient.from('returns').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('payments').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('sales').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('purchases').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('expenses').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('customers').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('suppliers').delete().eq('shop_id', shopId);
            await window.supabaseClient.from('products').delete().eq('shop_id', shopId);

            window.showToast("Restoring backup database...", "info");

            // 2. Insert Products
            const productCodeMap = {};
            if (data.products && data.products.length > 0) {
                const rows = data.products.map(p => ({
                    shop_id: shopId,
                    product_code: p.product_code,
                    name: p.name,
                    category: p.category || 'General',
                    cost_price: Number(p.cost_price),
                    selling_price: Number(p.selling_price),
                    stock: Number(p.stock),
                    unit_type: p.unit_type || 'pcs',
                    low_stock_threshold: Number(p.low_stock_threshold) || 10
                }));
                const { data: dbProducts, error } = await window.supabaseClient.from('products').insert(rows).select();
                if (error) throw error;
                dbProducts.forEach(p => { productCodeMap[p.product_code] = p.id; });
            }

            // 3. Insert Suppliers
            const supplierNameMap = {};
            if (data.suppliers && data.suppliers.length > 0) {
                const rows = data.suppliers.map(s => ({
                    shop_id: shopId, name: s.name, phone: s.phone || '', address: s.address || '', notes: s.notes || ''
                }));
                const { data: dbSuppliers, error } = await window.supabaseClient.from('suppliers').insert(rows).select();
                if (error) throw error;
                dbSuppliers.forEach(s => { supplierNameMap[s.name] = s.id; });
            }

            // 4. Insert Customers
            const customerNameMap = {};
            if (data.customers && data.customers.length > 0) {
                const rows = data.customers.map(c => ({
                    shop_id: shopId, name: c.name, phone: c.phone || '', total_due: Number(c.total_due) || 0
                }));
                const { data: dbCustomers, error } = await window.supabaseClient.from('customers').insert(rows).select();
                if (error) throw error;
                dbCustomers.forEach(c => { customerNameMap[c.name] = c.id; });
            }

            // 5. Insert Expenses
            if (data.expenses && data.expenses.length > 0) {
                const rows = data.expenses.map(exp => ({
                    shop_id: shopId,
                    category: exp.category,
                    amount: Number(exp.amount),
                    note: exp.note || '',
                    expense_date: exp.expense_date
                }));
                const { error } = await window.supabaseClient.from('expenses').insert(rows);
                if (error) throw error;
            }

            // 6. Insert Purchases
            if (data.purchases && data.purchases.length > 0) {
                const rows = data.purchases.map(p => {
                    const productId = productCodeMap[p.product_code];
                    const supplierId = supplierNameMap[p.supplier_name] || null;
                    if (!productId) return null;
                    return {
                        shop_id: shopId,
                        product_id: productId,
                        supplier_id: supplierId,
                        quantity: Number(p.quantity),
                        cost_per_unit: Number(p.cost_per_unit),
                        total_cost: Number(p.total_cost),
                        purchase_date: p.purchase_date
                    };
                }).filter(x => x !== null);
                
                if (rows.length > 0) {
                    const { error } = await window.supabaseClient.from('purchases').insert(rows);
                    if (error) throw error;
                }
            }

            // 7. Insert Sales
            if (data.sales && data.sales.length > 0) {
                const rows = data.sales.map(s => {
                    const productId = productCodeMap[s.product_code];
                    const customerId = customerNameMap[s.customer_name] || null;
                    if (!productId) return null;
                    return {
                        shop_id: shopId,
                        invoice_no: s.invoice_no,
                        product_id: productId,
                        customer_id: customerId,
                        quantity: Number(s.quantity),
                        unit_price: Number(s.unit_price),
                        total_revenue: Number(s.total_revenue),
                        estimated_profit: Number(s.estimated_profit),
                        is_credit: !!s.is_credit,
                        amount_paid: Number(s.amount_paid) || 0,
                        sale_date: s.sale_date
                    };
                }).filter(x => x !== null);

                if (rows.length > 0) {
                    const { error } = await window.supabaseClient.from('sales').insert(rows);
                    if (error) throw error;
                }
            }

            // 8. Insert Payments
            if (data.payments && data.payments.length > 0) {
                const rows = data.payments.map(p => {
                    const customerId = customerNameMap[p.customer_name];
                    if (!customerId) return null;
                    return {
                        shop_id: shopId,
                        customer_id: customerId,
                        amount: Number(p.amount),
                        payment_date: p.payment_date,
                        note: p.note || ''
                    };
                }).filter(x => x !== null);

                if (rows.length > 0) {
                    const { error } = await window.supabaseClient.from('payments').insert(rows);
                    if (error) throw error;
                }
            }

            // 9. Insert Returns
            if (data.returns && data.returns.length > 0) {
                const rows = data.returns.map(r => {
                    const productId = productCodeMap[r.product_code];
                    if (!productId) return null;
                    return {
                        shop_id: shopId,
                        type: r.type,
                        product_id: productId,
                        quantity: Number(r.quantity),
                        amount: Number(r.amount),
                        reason: r.reason || '',
                        return_date: r.return_date
                    };
                }).filter(x => x !== null);

                if (rows.length > 0) {
                    const { error } = await window.supabaseClient.from('returns').insert(rows);
                    if (error) throw error;
                }
            }

            window.showToast("Ledger restore completed successfully! Synchronizing...", "success");
            if (window.playBeep) window.playBeep('double');
            await window.store.loadAllData();
            fileEl.value = '';

        } catch (err) {
            console.error("Ledger restore failed:", err);
            window.showToast("Ledger restore failed: " + err.message, "error");
            if (window.playBeep) window.playBeep('error');
        }
    };

    reader.readAsText(file);
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}
