/**
 * reports.js - Reports & Business Intelligence Page Controller
 */

let reportsMoMChartInstance = null;

window.initReports = function() {
    // Set default month selector to current month
    const selector = document.getElementById('report-month-selector');
    if (selector && !selector.value) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        selector.value = `${year}-${month}`;
    }

    renderReportsPage();

    // Hook buttons
    const btnLoad = document.getElementById('btn-load-report');
    const btnExportCsv = document.getElementById('btn-export-csv-products');
    const btnPdf = document.getElementById('btn-export-full-report');

    if (btnLoad) btnLoad.addEventListener('click', renderReportsPage);
    if (btnExportCsv) btnExportCsv.addEventListener('click', handleCSVExportSubmit);
    if (btnPdf) btnPdf.addEventListener('click', handlePDFExportSubmit);

    // Subscribe to store updates
    window.store.subscribe(() => {
        renderReportsPage();
    });
}

function renderReportsPage() {
    const selector = document.getElementById('report-month-selector');
    if (!selector) return;

    const monthStr = selector.value;
    if (!monthStr) return;

    const rep = window.store.getMonthlyReport(monthStr);

    // Set stats
    setText('rep-total-sales', `৳ ${rep.totalSales.toLocaleString()}`);
    setText('rep-total-purchases', `৳ ${rep.totalPurchases.toLocaleString()}`);
    setText('rep-total-expenses', `৳ ${rep.totalExpenses.toLocaleString()}`);
    
    const netProfitEl = document.getElementById('rep-net-profit');
    if (netProfitEl) {
        netProfitEl.innerText = `৳ ${rep.netProfit.toLocaleString()}`;
        netProfitEl.style.color = rep.netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    // Render top selling products table
    renderTopSellingTable(monthStr);

    // Render discount history and seasonal campaigns
    renderDiscountReport(monthStr);

    // Render MoM comparison chart (last 6 months)
    renderMoMChart(monthStr);
}

function renderDiscountReport(monthStr) {
    const tableBody = document.getElementById('rep-discounts-table');
    if (!tableBody) return;

    const monthSales = window.store.sales.filter(s => s.date.startsWith(monthStr));
    const campaignStats = {};

    monthSales.forEach(s => {
        const tag = (s.seasonalOffer || '').trim();
        const discountAmount = Number(s.discountAmount || 0);
        
        if (discountAmount > 0 || tag !== '') {
            const bucketName = tag !== '' ? tag : 'General Discounts';
            
            if (!campaignStats[bucketName]) {
                campaignStats[bucketName] = {
                    tag: bucketName,
                    count: 0,
                    totalDiscount: 0,
                    totalSales: 0,
                    invoices: []
                };
            }
            campaignStats[bucketName].count++;
            campaignStats[bucketName].totalDiscount += discountAmount;
            campaignStats[bucketName].totalSales += s.totalSales;
            campaignStats[bucketName].invoices.push(s.invoiceNo);
        }
    });

    const campaigns = Object.values(campaignStats).sort((a, b) => b.totalDiscount - a.totalDiscount);

    if (campaigns.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No discounts or campaigns recorded in ${monthStr}.</td></tr>`;
        return;
    }

    tableBody.innerHTML = campaigns.map(c => `
        <tr>
            <td class="td-name"><span class="category-tag" style="background:rgba(124,58,237,0.15);color:#7c3aed;">${c.tag}</span></td>
            <td class="td-qty">${c.count} sales</td>
            <td class="td-revenue" style="color:var(--danger);font-weight:600;">৳ ${c.totalDiscount.toLocaleString()}</td>
            <td style="font-weight:600;color:var(--text-primary);">৳ ${c.totalSales.toLocaleString()}</td>
            <td class="text-muted" style="font-size:0.8rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${c.invoices.join(', ')}
            </td>
        </tr>
    `).join('');
}

function renderTopSellingTable(month) {
    const tableBody = document.getElementById('rep-top-selling-table');
    if (!tableBody) return;

    const topProducts = window.store.getTopSellingProducts(month, 5);

    if (topProducts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No sales transactions logged this month.</td></tr>`;
        return;
    }

    tableBody.innerHTML = topProducts.map(p => `
        <tr>
            <td class="td-name">${p.name}</td>
            <td class="td-qty">${p.totalQty} units</td>
            <td class="td-revenue">৳ ${p.totalRevenue.toLocaleString()}</td>
            <td class="td-profit" style="color:var(--success);">৳ ${p.totalProfit.toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderMoMChart(selectedMonth) {
    const canvas = document.getElementById('reportsMoMChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (reportsMoMChartInstance) reportsMoMChartInstance.destroy();

    // Generate last 6 months list relative to selectedMonth (YYYY-MM)
    const months = [];
    const salesData = [];
    const profitData = [];

    const date = new Date(selectedMonth + '-01');
    for (let i = 5; i >= 0; i--) {
        const d = new Date(date);
        d.setMonth(d.getMonth() - i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const mKey = `${yStr}-${mStr}`;
        months.push(mKey);

        const rep = window.store.getMonthlyReport(mKey);
        salesData.push(rep.totalSales);
        profitData.push(rep.netProfit);
    }

    const monthLabels = months.map(m => {
        const parts = m.split('-');
        const dateObj = new Date(parts[0], parts[1] - 1);
        return dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    reportsMoMChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                {
                    label: 'Sales Revenue (৳)',
                    data: salesData,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 3,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#7c3aed',
                    pointRadius: 4
                },
                {
                    label: 'Net Profit (৳)',
                    data: profitData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    borderWidth: 2,
                    tension: 0.35,
                    fill: false,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'Inter' } }
                },
                tooltip: {
                    backgroundColor: '#161b22',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter' },
                        callback: v => '৳' + v.toLocaleString()
                    }
                }
            }
        }
    });
}

function handleCSVExportSubmit() {
    if (window.playBeep) window.playBeep('success');

    const selector = document.getElementById('report-month-selector');
    const month = selector ? selector.value : 'all_time';

    // Build Product Inventory CSV file
    const headers = ['Product Code', 'Name', 'Category', 'Cost Price', 'Selling Price', 'Current Stock', 'Unit'];
    const rows = window.store.inventory.map(p => [
        p.id,
        p.name,
        p.category,
        p.cost,
        p.sell,
        p.stock,
        p.unit
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RetailFlow_Inventory_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast("CSV exported successfully!", "success");
}

function handlePDFExportSubmit() {
    if (window.playBeep) window.playBeep('success');

    const section = document.getElementById('reports');
    if (!section) return;

    const clone = section.cloneNode(true);
    clone.querySelectorAll('button, .search-filter-bar, input').forEach(el => el.remove());

    // Convert chart canvas to static image for PDF compatibility
    const origCanvas = document.getElementById('reportsMoMChart');
    const cloneContainer = clone.querySelector('#reportsMoMChart')?.parentElement;
    if (origCanvas && cloneContainer) {
        cloneContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = origCanvas.toDataURL('image/png');
        img.style.width = '100%';
        img.style.maxHeight = '240px';
        img.style.borderRadius = '10px';
        cloneContainer.appendChild(img);
    }

    const doc = document.createElement('div');
    doc.style.cssText = 'padding:40px; background:#fff; color:#000; font-family:Inter,sans-serif;';

    const selectedMonth = document.getElementById('report-month-selector')?.value || 'Month';
    
    doc.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #7c3aed; padding-bottom:15px; margin-bottom:25px;">
            <div>
                <h1 style="font-family:Outfit,sans-serif; font-size:2.2rem; color:#7c3aed; margin:0; font-weight:800;">RetailFlow</h1>
                <p style="color:#64748b; font-size:0.9rem; margin:2px 0 0 0;">Premium Monthly Performance Ledger</p>
            </div>
            <div style="text-align:right;">
                <p style="margin:0; font-weight:800; font-size:1.1rem; color:#0f172a; text-transform:uppercase;">Performance Report</p>
                <p style="margin:3px 0 0 0; color:#64748b; font-size:0.85rem;">Ledger Month: ${selectedMonth}</p>
            </div>
        </div>
    `;

    const formatted = document.createElement('div');
    formatted.innerHTML = clone.innerHTML;

    // Apply PDF style overrides
    formatted.querySelectorAll('.card, .panel, .table-container').forEach(el => {
        el.style.background = '#fff';
        el.style.border = '1px solid #e2e8f0';
        el.style.color = '#000';
        el.style.boxShadow = 'none';
        el.style.padding = '18px';
        el.style.marginBottom = '20px';
        el.style.borderRadius = '10px';
    });

    formatted.querySelectorAll('th').forEach(el => {
        el.style.background = '#f8fafc';
        el.style.color = '#475569';
        el.style.borderBottom = '2px solid #cbd5e1';
        el.style.padding = '10px 14px';
    });

    formatted.querySelectorAll('td').forEach(el => {
        el.style.color = '#1e293b';
        el.style.borderBottom = '1px solid #e2e8f0';
        el.style.padding = '10px 14px';
    });

    doc.appendChild(formatted);

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `RetailFlow_FullReport_${selectedMonth}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(doc).save().catch(err => {
        console.error("PDF export error:", err);
        alert("PDF export failed: " + err.message);
    });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}
