/**
 * lang.js - Translation Dictionary & Localization module
 */

window.translations = {
    en: {
        // Navigation / Sidebar
        "nav-dashboard": "Dashboard",
        "nav-inventory": "Inventory",
        "nav-purchases": "Purchases",
        "nav-sales": "Sales",
        "nav-expenses": "Expenses",
        "nav-suppliers": "Suppliers",
        "nav-customers": "Customers",
        "nav-returns": "Returns",
        "nav-reports": "Reports",
        "nav-settings": "Settings",
        "sidebar-footer": "RetailFlow v2.0<br>© 2026 Premium Edition",

        // Topbar
        "btn-export-pdf": "Export PDF",

        // Dashboard KPIs
        "kpi-today-sales": "Today's Sales",
        "kpi-net-sales": "Net Sales",
        "kpi-investment": "Net Investment",
        "kpi-expenses": "Total Expenses",
        "kpi-dues": "Outstanding Dues",
        "kpi-profit": "Net Profit",

        // Dashboard Panels
        "panel-overview": "📊 Business Overview",
        "panel-expenses-pie": "💰 Expense Breakdown",
        "panel-sales-category": "🍕 Sales by Category",
        "panel-due-customers": "⚖️ Due Customers (Sorted by Amount Owed)",
        "panel-low-stock-title": "🔔 Low Stock Alerts",
        "pos-cart-title": "Billing Cart",
        "pos-checkout-title": "Checkout & Invoice",

        // Inventory Page
        "inv-stat-items": "Unique Products",
        "inv-stat-qty": "Total Stock",
        "inv-stat-valuation": "Stock Value",
        "inv-form-title": "Add New Product",
        "label-prod-id": "Product ID",
        "label-prod-name": "Product Name",
        "label-category": "Category",
        "label-cost-price": "Cost Price (৳)",
        "label-sell-price": "Sell Price (৳)",
        "label-unit-type": "Unit Type",
        "label-initial-stock": "Initial Stock",
        "label-min-stock": "Min Stock Alert",
        "btn-add-product": "+ Add Product",
        "filter-category": "Category:",
        "filter-unit": "Unit:",
        "th-id": "ID",
        "th-name": "Name",
        "th-cat": "Category",
        "th-cost": "Cost Price",
        "th-sell": "Sell Price",
        "th-stock": "Stock",
        "th-min": "Min Stock",
        "th-val": "Total Value",
        "th-actions": "Actions",

        // Purchases Page
        "pur-date": "Purchase Date",
        "pur-product": "Product",
        "pur-supplier": "Supplier",
        "pur-qty": "Quantity",
        "btn-log-purchase": "+ Log Purchase",
        "pur-history-title": "📦 Purchase History",
        "th-date": "Date",
        "th-supplier": "Supplier",
        "th-unit-cost": "Unit Cost",
        "th-total-cost": "Total Cost",
        "pur-returns-title": "↩️ Purchase Returns (Return to Supplier)",
        "label-ret-date": "Return Date",
        "label-reason": "Reason",
        "btn-return": "↩ Return",
        "th-qty-returned": "Qty Returned",
        "th-cost-credit": "Cost Credit",
        "th-reason": "Reason",

        // Sales Page
        "sale-date": "Sale Date",
        "sale-customer": "Customer",
        "sale-credit": "Credit Sale?",
        "sale-qty": "Quantity",
        "btn-log-sale": "+ Log Sale",
        "sales-history-title": "📈 Sales History",
        "th-customer": "Customer",
        "th-qty-sold": "Qty Sold",
        "th-unit-price": "Unit Price",
        "th-total-rev": "Total Revenue",
        "th-profit": "Profit",
        "th-receipt": "Receipt",
        "sales-returns-title": "↩️ Sales Returns (Customer Returns)",
        "btn-process-return": "↩ Process Return",
        "th-refund-amount": "Refund Amount",

        // Expenses Page
        "exp-total": "Total Expenses",
        "exp-month": "This Month",
        "exp-records": "Total Records",
        "exp-date": "Date",
        "exp-category": "Category",
        "exp-amount": "Amount (৳)",
        "exp-note": "Note (Optional)",
        "btn-add-expense": "+ Add Expense",
        "exp-history-title": "💸 Expense Records",
        "exp-trend-title": "📊 Monthly Expense Trend",

        // Suppliers Page
        "sup-total": "Total Suppliers",
        "sup-outstanding": "Outstanding Payments",
        "sup-name": "Supplier Name",
        "sup-phone": "Phone",
        "sup-address": "Address",
        "sup-notes": "Notes (Optional)",
        "btn-add-supplier": "+ Add Supplier",
        "sup-list-title": "🏢 Suppliers List",
        "sup-purchases-title": "📦 Purchase History from Supplier",
        "sup-select-label": "Select Supplier to View",

        // Customers Page
        "cust-total": "Total Customers",
        "cust-outstanding": "Outstanding Dues",
        "cust-collected": "Total Collected",
        "cust-name": "Customer Name",
        "cust-phone": "Phone Number",
        "cust-address": "Address",
        "btn-add-customer": "+ Add Customer",
        "cust-list-title": "👥 Customers List",
        "cust-outstanding-due": "Outstanding Due",
        "pay-collect-title": "💵 Collect Due Payment (বাকি আদায়)",
        "pay-date": "Collection Date",
        "pay-customer": "Select Customer",
        "pay-amount": "Amount Collected (৳)",
        "pay-note": "Note (Optional)",
        "btn-collect": "💵 Collect",
        "pay-log-title": "📝 Collection Log",
        "th-collected-amt": "Amount Collected",

        // Common Messages / Badges / Option values
        "walk-in-customer": "Walk-in / Cash",
        "direct-supplier": "Direct / Cash Supplier",
        "empty-state": "No data available.",
        "delete": "Delete",
        "receipt": "🧾 Receipt"
    },
    bn: {
        // Navigation / Sidebar
        "nav-dashboard": "ড্যাশবোর্ড",
        "nav-inventory": "ইনভেন্টরি",
        "nav-purchases": "ক্রয়সমূহ",
        "nav-sales": "বিক্রয়সমূহ",
        "nav-expenses": "খরচসমূহ",
        "nav-suppliers": "সরবরাহকারী",
        "nav-customers": "গ্রাহকসমূহ",
        "nav-returns": "ফেরতসমূহ",
        "nav-reports": "রিপোর্টসমূহ",
        "nav-settings": "সেটিংস",
        "sidebar-footer": "রিটেইলফ্লো ২.০<br>© ২০২৬ প্রিমিয়াম এডিশন",

        // Topbar
        "btn-export-pdf": "পিডিএফ ডাউনলোড",

        // Dashboard KPIs
        "kpi-today-sales": "আজকের বিক্রি",
        "kpi-net-sales": "মোট বিক্রি",
        "kpi-investment": "মোট ইনভেস্টমেন্ট",
        "kpi-expenses": "মোট খরচ",
        "kpi-dues": "মোট বাকি (বকেয়া)",
        "kpi-profit": "মোট লাভ",

        // Dashboard Panels
        "panel-overview": "📊 ব্যবসা পর্যালোচনা",
        "panel-expenses-pie": "💰 খরচের বিবরণ",
        "panel-sales-category": "🍕 ক্যাটাগরি ভিত্তিক বিক্রি",
        "panel-due-customers": "⚖️ বকেয়া গ্রাহক তালিকা (বাকি পরিমাণ অনুযায়ী)",
        "panel-low-stock-title": "🔔 স্বল্প স্টক সতর্কতা",
        "pos-cart-title": "বিলিং কার্ট",
        "pos-checkout-title": "চেকআউট এবং ইনভয়েস",

        // Inventory Page
        "inv-stat-items": "মোট অনন্য পণ্য",
        "inv-stat-qty": "মোট স্টক পরিমাণ",
        "inv-stat-valuation": "স্টক মূল্যমান",
        "inv-form-title": "নতুন পণ্য যোগ করুন",
        "label-prod-id": "পণ্য আইডি (ID)",
        "label-prod-name": "পণ্যের নাম",
        "label-category": "ক্যাটাগরি",
        "label-cost-price": "ক্রয় মূল্য (৳)",
        "label-sell-price": "বিক্রয় মূল্য (৳)",
        "label-unit-type": "একক ধরন",
        "label-initial-stock": "প্রারম্ভিক স্টক",
        "label-min-stock": "ন্যূনতম স্টক এলার্ট",
        "btn-add-product": "+ পণ্য যোগ করুন",
        "filter-category": "ক্যাটাগরি:",
        "filter-unit": "একক:",
        "th-id": "আইডি",
        "th-name": "পণ্যের নাম",
        "th-cat": "ক্যাটাগরি",
        "th-cost": "ক্রয় মূল্য",
        "th-sell": "বিক্রয় মূল্য",
        "th-stock": "স্টক",
        "th-min": "কম স্টক",
        "th-val": "মোট মূল্য",
        "th-actions": "পদক্ষেপ",

        // Purchases Page
        "pur-date": "ক্রয় তারিখ",
        "pur-product": "পণ্য নির্বাচন",
        "pur-supplier": "সরবরাহকারী",
        "pur-qty": "পরিমাণ",
        "btn-log-purchase": "+ ক্রয় সংরক্ষণ করুন",
        "pur-history-title": "📦 ক্রয়ের ইতিহাস",
        "th-date": "তারিখ",
        "th-supplier": "সরবরাহকারী",
        "th-unit-cost": "একক ক্রয়মূল্য",
        "th-total-cost": "মোট খরচ",
        "pur-returns-title": "↩️ ক্রয় ফেরত (সরবরাহকারীকে ফেরত)",
        "label-ret-date": "ফেরত তারিখ",
        "label-reason": "কারণ",
        "btn-return": "↩ ফেরত দিন",
        "th-qty-returned": "ফেরত পরিমাণ",
        "th-cost-credit": "টাকা ফেরত",
        "th-reason": "কারণ",

        // Sales Page
        "sale-date": "বিক্রয় তারিখ",
        "sale-customer": "গ্রাহক",
        "sale-credit": "বাকি বিক্রি?",
        "sale-qty": "পরিমাণ",
        "btn-log-sale": "+ বিক্রয় সংরক্ষণ করুন",
        "sales-history-title": "📈 বিক্রয়ের ইতিহাস",
        "th-customer": "গ্রাহক",
        "th-qty-sold": "বিক্রিত পরিমাণ",
        "th-unit-price": "বিক্রয় মূল্য",
        "th-total-rev": "মোট মূল্য",
        "th-profit": "লাভ",
        "th-receipt": "রসিদ",
        "sales-returns-title": "↩️ বিক্রয় ফেরত (গ্রাহক ফেরত)",
        "btn-process-return": "↩ ফেরত গ্রহণ করুন",
        "th-refund-amount": "ফেরত মূল্য",

        // Expenses Page
        "exp-total": "মোট খরচ",
        "exp-month": "চলতি মাস",
        "exp-records": "মোট তালিকা",
        "exp-date": "তারিখ",
        "exp-category": "শ্রেণী (ক্যাটাগরি)",
        "exp-amount": "টাকার পরিমাণ (৳)",
        "exp-note": "মন্তব্য (ঐচ্ছিক)",
        "btn-add-expense": "+ খরচ যুক্ত করুন",
        "exp-history-title": "💸 খরচের তালিকা",
        "exp-trend-title": "📊 মাসিক খরচের গ্রাফ",

        // Suppliers Page
        "sup-total": "মোট সরবরাহকারী",
        "sup-outstanding": "বকেয়া পরিশোধ",
        "sup-name": "সরবরাহকারীর নাম",
        "sup-phone": "ফোন নম্বর",
        "sup-address": "ঠিকানা",
        "sup-notes": "মন্তব্য (ঐচ্ছিক)",
        "btn-add-supplier": "+ সরবরাহকারী যুক্ত করুন",
        "sup-list-title": "🏢 সরবরাহকারীদের তালিকা",
        "sup-purchases-title": "📦 সরবরাহকারী হতে ক্রয়ের তালিকা",
        "sup-select-label": "সরবরাহকারী নির্বাচন করুন",

        // Customers Page
        "cust-total": "মোট গ্রাহক",
        "cust-outstanding": "মোট বাকি (বকেয়া)",
        "cust-collected": "মোট আদায়",
        "cust-name": "গ্রাহকের নাম",
        "cust-phone": "ফোন নম্বর",
        "cust-address": "ঠিকানা",
        "btn-add-customer": "+ গ্রাহক যুক্ত করুন",
        "cust-list-title": "👥 গ্রাহকদের তালিকা",
        "cust-outstanding-due": "বাকি পরিমাণ",
        "pay-collect-title": "💵 বকেয়া আদায় করুন (বাকি আদায়)",
        "pay-date": "আদায়ের তারিখ",
        "pay-customer": "গ্রাহক নির্বাচন",
        "pay-amount": "আদায়ের পরিমাণ (৳)",
        "pay-note": "মন্তব্য (ঐচ্ছিক)",
        "btn-collect": "💵 আদায় সম্পন্ন করুন",
        "pay-log-title": "📝 আদায়ের লগ (হিসাব)",
        "th-collected-amt": "আদায়কৃত অর্থ",

        // Common Messages / Badges / Option values
        "walk-in-customer": "খুচরা ক্রেতা / নগদ",
        "direct-supplier": "সরাসরি / নগদ বিক্রেতা",
        "empty-state": "কোন তথ্য পাওয়া যায়নি।",
        "delete": "ডিলিট করুন",
        "receipt": "🧾 রসিদ"
    }
};

window.currentLanguage = localStorage.getItem('rf_lang') || 'en';

window.t = function(key) {
    const lang = window.currentLanguage;
    return window.translations[lang]?.[key] || window.translations['en']?.[key] || key;
}

window.translateDOM = function() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = window.t(key);
        if (text) {
            // If it's an input with placeholder
            if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
                el.setAttribute('placeholder', text);
            } else {
                // Keep SVG icons intact inside lists/menus
                const svg = el.querySelector('svg');
                if (svg) {
                    const span = el.querySelector('span');
                    if (span) {
                        span.innerText = text;
                    } else {
                        // Just text wrapper
                        el.innerHTML = svg.outerHTML + ` <span>${text}</span>`;
                    }
                } else {
                    el.innerText = text;
                }
            }
        }
    });

    // Translate dynamic select option fallbacks
    const walkInOptions = document.querySelectorAll('option[value=""]');
    walkInOptions.forEach(opt => {
        if (opt.parentElement?.id === 'sale-customer') {
            opt.innerText = `-- ${window.t('walk-in-customer')} --`;
        } else if (opt.parentElement?.id === 'pur-supplier') {
            opt.innerText = `-- ${window.t('direct-supplier')} --`;
        } else if (opt.parentElement?.id === 'pay-customer' || opt.parentElement?.id === 'sup-history-select' || opt.parentElement?.id === 'sale-product' || opt.parentElement?.id === 'pur-product' || opt.parentElement?.id === 'sale-ret-product' || opt.parentElement?.id === 'pur-ret-product') {
            // Keep default selections
        }
    });
}
