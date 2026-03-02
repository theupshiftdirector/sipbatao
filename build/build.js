const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(__dirname, 'data');
const TEMPLATES = path.join(__dirname, 'templates');
const DOMAIN = 'https://sipbatao.com';
const YEAR = new Date().getFullYear();
const GOOGLE_VERIFICATION = '';

// ─── Fund category metadata ─────────────────────────────────────────────────
const CATEGORIES = {
  'equity':  { label: 'Equity',  fullLabel: 'Equity Mutual Fund',  defaultReturn: 14, slug: 'equity',  defaultYears: 10, riskLevel: 'High' },
  'debt':    { label: 'Debt',    fullLabel: 'Debt Mutual Fund',    defaultReturn: 7,  slug: 'debt',    defaultYears: 5,  riskLevel: 'Low to Moderate' },
  'hybrid':  { label: 'Hybrid',  fullLabel: 'Hybrid Mutual Fund',  defaultReturn: 11, slug: 'hybrid',  defaultYears: 7,  riskLevel: 'Moderate' },
  'elss':    { label: 'ELSS',    fullLabel: 'ELSS Tax Saving Fund', defaultReturn: 14, slug: 'elss',    defaultYears: 10, riskLevel: 'High' },
  'index':   { label: 'Index',   fullLabel: 'Index Fund',          defaultReturn: 12, slug: 'index',   defaultYears: 10, riskLevel: 'High' },
};

// ─── SIP Amount presets ──────────────────────────────────────────────────────
const SIP_AMOUNTS = [500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 25000, 50000];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function formatINRShort(num) {
  num = Math.round(num);
  if (num >= 10000000) return '\u20B9' + (num / 10000000).toFixed(num % 10000000 === 0 ? 0 : 2) + ' Cr';
  if (num >= 100000) return '\u20B9' + (num / 100000).toFixed(num % 100000 === 0 ? 0 : 2) + ' L';
  if (num >= 1000) return '\u20B9' + (num / 1000).toFixed(0) + 'K';
  return '\u20B9' + formatINR(num);
}

function amountSlug(num) {
  return num.toString();
}

function amountLabel(num) {
  if (num >= 100000) return '\u20B9' + formatINR(num);
  if (num >= 1000) return '\u20B9' + new Intl.NumberFormat('en-IN').format(num);
  return '\u20B9' + num;
}

function amountLabelShort(num) {
  if (num >= 100000) {
    const l = num / 100000;
    return '\u20B9' + (l === Math.floor(l) ? l : l.toFixed(1)) + ' Lakh';
  }
  if (num >= 1000) return '\u20B9' + (num / 1000) + 'K';
  return '\u20B9' + num;
}

function calculateSIPFV(monthlyAmount, annualRate, totalMonths) {
  if (monthlyAmount <= 0 || totalMonths <= 0) return 0;
  if (annualRate === 0) return monthlyAmount * totalMonths;
  const r = annualRate / 12 / 100;
  return Math.round(monthlyAmount * ((Math.pow(1 + r, totalMonths) - 1) / r) * (1 + r));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Load data ───────────────────────────────────────────────────────────────
const amcs = JSON.parse(fs.readFileSync(path.join(DATA, 'funds.json'), 'utf8'));
const layoutTemplate = fs.readFileSync(path.join(TEMPLATES, 'layout.html'), 'utf8');
const affiliateData = JSON.parse(fs.readFileSync(path.join(DATA, 'affiliates.json'), 'utf8'));
const affiliateTemplate = fs.readFileSync(path.join(TEMPLATES, 'affiliate.html'), 'utf8');

// ─── Calculator JS (shared across all SEO pages) ────────────────────────────
const CALCULATOR_JS = `
var currentView = 'yearly';
var currentUnit = 'years';
var growthData = [];

function formatCurrency(num) {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function formatCurrencyShort(num) {
    num = Math.round(num);
    if (num >= 10000000) return '\\u20B9' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '\\u20B9' + (num / 100000).toFixed(2) + ' L';
    return '\\u20B9' + formatCurrency(num);
}

function getRawNumber(id) {
    return parseInt(document.getElementById(id).value.replace(/[^0-9]/g, '')) || 0;
}

function formatAmountInput() {
    var input = document.getElementById('sipAmount');
    var raw = input.value.replace(/[^0-9]/g, '');
    if (raw) input.value = new Intl.NumberFormat('en-IN').format(parseInt(raw));
    calculate();
}

function generateGrowthData(monthlyAmount, annualRate, totalMonths) {
    var r = annualRate / 12 / 100;
    var data = [];
    var totalInvested = 0;
    var value = 0;

    for (var month = 1; month <= totalMonths; month++) {
        totalInvested += monthlyAmount;
        value = (value + monthlyAmount) * (1 + r);
        data.push({
            month: month,
            invested: Math.round(totalInvested),
            value: Math.round(value),
            returns: Math.round(value - totalInvested),
            sip: monthlyAmount
        });
    }
    return data;
}

function getYearlySummary(data) {
    var yearly = [];
    for (var i = 0; i < data.length; i++) {
        if ((i + 1) % 12 === 0 || i === data.length - 1) {
            yearly.push({
                year: Math.ceil((i + 1) / 12),
                invested: data[i].invested,
                returns: data[i].returns,
                value: data[i].value
            });
        }
    }
    return yearly;
}

function drawPieChart(invested, gains) {
    var canvas = document.getElementById('pieChart');
    if (!canvas) return;
    var container = canvas.parentElement;
    var size = container.offsetWidth;
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    var cx = size / 2, cy = size / 2, outerR = size / 2 - 4, innerR = outerR * 0.62;
    var total = invested + gains;
    if (total <= 0) return;
    var investedAngle = (invested / total) * Math.PI * 2, gap = 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, -Math.PI / 2 + gap / 2, -Math.PI / 2 + investedAngle - gap / 2);
    ctx.arc(cx, cy, innerR, -Math.PI / 2 + investedAngle - gap / 2, -Math.PI / 2 + gap / 2, true);
    ctx.closePath(); ctx.fillStyle = '#f97316'; ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, -Math.PI / 2 + investedAngle + gap / 2, -Math.PI / 2 + Math.PI * 2 - gap / 2);
    ctx.arc(cx, cy, innerR, -Math.PI / 2 + Math.PI * 2 - gap / 2, -Math.PI / 2 + investedAngle + gap / 2, true);
    ctx.closePath(); ctx.fillStyle = '#38bdf8'; ctx.fill();
}

function renderTable() {
    var head = document.getElementById('tableHead');
    var body = document.getElementById('tableBody');
    if (currentView === 'yearly') {
        head.innerHTML = '<tr><th>Year</th><th>Invested</th><th>Returns</th><th>Total Value</th></tr>';
        var yearly = getYearlySummary(growthData);
        body.innerHTML = yearly.map(function(r) {
            return '<tr><td>Year ' + r.year + '</td><td>\\u20B9' + formatCurrency(r.invested) + '</td><td>\\u20B9' + formatCurrency(r.returns) + '</td><td>\\u20B9' + formatCurrency(r.value) + '</td></tr>';
        }).join('');
    } else {
        head.innerHTML = '<tr><th>Month</th><th>SIP</th><th>Invested</th><th>Returns</th><th>Value</th></tr>';
        body.innerHTML = growthData.map(function(r) {
            return '<tr><td>' + r.month + '</td><td>\\u20B9' + formatCurrency(r.sip) + '</td><td>\\u20B9' + formatCurrency(r.invested) + '</td><td>\\u20B9' + formatCurrency(r.returns) + '</td><td>\\u20B9' + formatCurrency(r.value) + '</td></tr>';
        }).join('');
    }
}

function calculate() {
    var sipAmount = getRawNumber('sipAmount');
    var rate = parseFloat(document.getElementById('expectedReturn').value) || 0;
    var tenureVal = parseInt(document.getElementById('timePeriod').value) || 0;
    var months = currentUnit === 'years' ? tenureVal * 12 : tenureVal;
    if (sipAmount <= 0 || months <= 0) return;

    growthData = generateGrowthData(sipAmount, rate, months);
    var lastEntry = growthData[growthData.length - 1];
    var futureValue = lastEntry.value;
    var totalInvested = lastEntry.invested;
    var wealthGained = lastEntry.returns;

    document.getElementById('futureValue').textContent = formatCurrencyShort(futureValue);
    document.getElementById('totalInvested').textContent = formatCurrencyShort(totalInvested);
    document.getElementById('wealthGained').textContent = formatCurrencyShort(wealthGained);

    drawPieChart(totalInvested, wealthGained);
    document.getElementById('chartTotal').textContent = formatCurrencyShort(futureValue);

    var investedPct = Math.round(totalInvested / futureValue * 100);
    document.getElementById('legendInvested').textContent = '\\u20B9' + formatCurrency(totalInvested);
    document.getElementById('legendGains').textContent = '\\u20B9' + formatCurrency(wealthGained);
    document.getElementById('legendInvestedPct').textContent = investedPct + '%';
    document.getElementById('legendGainsPct').textContent = (100 - investedPct) + '%';

    renderTable();
}

function downloadPDF() {
    if (growthData.length === 0) return;
    var sipAmount = getRawNumber('sipAmount');
    var rate = parseFloat(document.getElementById('expectedReturn').value) || 0;
    var tenureVal = parseInt(document.getElementById('timePeriod').value) || 0;
    var months = currentUnit === 'years' ? tenureVal * 12 : tenureVal;
    var lastEntry = growthData[growthData.length - 1];
    var futureValue = lastEntry.value;
    var totalInvested = lastEntry.invested;
    var wealthGained = lastEntry.returns;
    var yearly = getYearlySummary(growthData);
    var tenureStr = currentUnit === 'years' ? tenureVal + ' Years' : tenureVal + ' Months';

    var pw = window.open('', '_blank');
    pw.document.write('<!DOCTYPE html><html><head><title>SIP Growth Report - SIP Batao</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:\\'Outfit\\',sans-serif;color:#1a1a1a;line-height:1.6;padding:40px 50px;max-width:900px;margin:0 auto;font-size:13px}h1{font-family:\\'Playfair Display\\',serif;font-size:22px;margin-bottom:4px}.subtitle{color:#666;font-size:13px;margin-bottom:24px}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px}.summary-item{background:#f7f7f7;padding:12px 16px;border-radius:8px}.summary-item .s-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666}.summary-item .s-value{font-size:18px;font-weight:700;margin-top:2px}.summary-item.highlight .s-value{color:#f97316}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:right;padding:8px 10px;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666}th:first-child{text-align:left}td{padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums}td:first-child{text-align:left;color:#666}h2{font-size:16px;margin-top:32px;margin-bottom:4px}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}@media print{body{padding:20px}.summary-item{background:#f7f7f7;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>SIP Growth Report</h1><div class="subtitle">Generated on ' + new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) + ' \\u00B7 sipbatao.com</div><div class="summary"><div class="summary-item highlight"><div class="s-label">Future Value</div><div class="s-value">\\u20B9' + formatCurrency(futureValue) + '</div></div><div class="summary-item"><div class="s-label">Total Invested</div><div class="s-value">\\u20B9' + formatCurrency(totalInvested) + '</div></div><div class="summary-item"><div class="s-label">Wealth Gained</div><div class="s-value">\\u20B9' + formatCurrency(wealthGained) + '</div></div></div><div style="font-size:13px;color:#666;margin-bottom:8px">Monthly SIP: \\u20B9' + formatCurrency(sipAmount) + ' \\u00B7 Expected Return: ' + rate + '% p.a. \\u00B7 Period: ' + tenureStr + ' (' + months + ' months)</div><h2>Year-wise Growth</h2><table><thead><tr><th>Year</th><th>Total Invested</th><th>Returns</th><th>Total Value</th></tr></thead><tbody>' + yearly.map(function(r){return '<tr><td>Year '+r.year+'</td><td>\\u20B9'+formatCurrency(r.invested)+'</td><td>\\u20B9'+formatCurrency(r.returns)+'</td><td>\\u20B9'+formatCurrency(r.value)+'</td></tr>';}).join('') + '</tbody></table><div class="footer">Generated by SIP Batao (sipbatao.com) \\u00B7 Built by TUD Innovations Pvt Ltd</div><script>setTimeout(function(){window.print();window.close()},500)<\\/script></body></html>');
    pw.document.close();
}

// Init
document.getElementById('sipAmount').addEventListener('input', formatAmountInput);
document.getElementById('expectedReturn').addEventListener('input', calculate);
document.getElementById('timePeriod').addEventListener('input', calculate);

document.getElementById('tenureToggle').addEventListener('click', function(e) {
    var btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    this.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentUnit = btn.dataset.unit;
    calculate();
});

document.getElementById('tableToggle').addEventListener('click', function(e) {
    var btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    this.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentView = btn.dataset.view;
    renderTable();
});

document.querySelector('.btn-calculate').addEventListener('click', function() {
    if (window.innerWidth < 900) document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
});

// Prefill and calculate
document.getElementById('sipAmount').value = new Intl.NumberFormat('en-IN').format(PREFILL_AMOUNT);
document.getElementById('expectedReturn').value = PREFILL_RATE;
document.getElementById('timePeriod').value = PREFILL_TENURE;
currentUnit = PREFILL_UNIT;
document.querySelectorAll('#tenureToggle .toggle-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.unit === PREFILL_UNIT);
});
calculate();
`;

// ─── Page content generators ─────────────────────────────────────────────────

function calculatorHTML() {
  return `
<div class="calc-section">
    <div class="form-panel-wrapper">
        <div class="panel">
            <div class="panel-title"><div class="num">1</div> SIP Details</div>
            <div class="section-label">SIP Parameters</div>
            <div class="form-group">
                <label>Monthly SIP Amount (\u20B9)</label>
                <div class="input-with-unit">
                    <span class="unit">\u20B9</span>
                    <input type="text" id="sipAmount" inputmode="numeric" placeholder="10,000">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Expected Annual Return (%)</label>
                    <div class="input-with-unit">
                        <input type="number" id="expectedReturn" class="input-rate" step="0.1" min="1" max="30" placeholder="12">
                        <span class="unit unit-right">%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Time Period</label>
                    <div class="tenure-row">
                        <input type="number" id="timePeriod" min="1" placeholder="10">
                        <div class="tenure-toggle" id="tenureToggle">
                            <button class="toggle-btn active" data-unit="years">Yr</button>
                            <button class="toggle-btn" data-unit="months">Mo</button>
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn-calculate" onclick="calculate()">Calculate SIP Returns \u2192</button>
        </div>
    </div>
    <div>
        <div class="panel" id="resultsPanel">
            <div class="panel-title"><div class="num">2</div> SIP Growth</div>
            <div class="result-cards">
                <div class="result-card highlight">
                    <div class="label">Future Value</div>
                    <div class="value" id="futureValue">-</div>
                </div>
                <div class="result-card">
                    <div class="label">Total Invested</div>
                    <div class="value" id="totalInvested">-</div>
                </div>
                <div class="result-card">
                    <div class="label">Wealth Gained</div>
                    <div class="value" id="wealthGained">-</div>
                </div>
            </div>
            <div class="chart-section">
                <div class="chart-container">
                    <canvas id="pieChart"></canvas>
                    <div class="chart-center">
                        <div class="total-label">Future Value</div>
                        <div class="total-value" id="chartTotal">-</div>
                    </div>
                </div>
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background:var(--accent)"></div>
                        <div class="legend-info">
                            <div class="legend-label">Total Invested</div>
                            <div class="legend-value" id="legendInvested">-</div>
                        </div>
                        <div class="legend-percent" id="legendInvestedPct">-</div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background:var(--blue)"></div>
                        <div class="legend-info">
                            <div class="legend-label">Wealth Gained</div>
                            <div class="legend-value" id="legendGains">-</div>
                        </div>
                        <div class="legend-percent" id="legendGainsPct">-</div>
                    </div>
                </div>
            </div>
            <div class="table-header">
                <div class="table-title">Year-wise SIP Growth</div>
                <div class="table-toggle" id="tableToggle">
                    <button class="toggle-btn active" data-view="yearly">Yearly</button>
                    <button class="toggle-btn" data-view="monthly">Monthly</button>
                </div>
            </div>
            <div class="table-container">
                <table class="growth-table">
                    <thead id="tableHead"><tr><th>Year</th><th>Invested</th><th>Returns</th><th>Total Value</th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
            <button class="btn-download" onclick="downloadPDF()">\u2193 Download SIP Growth Report (PDF)</button>
        </div>
    </div>
</div>`;
}

function detailsGridHTML(fund) {
  return `
<div class="details-grid">
    <div class="detail-item">
        <div class="d-label">Expected Returns</div>
        <div class="d-value accent">${fund.returnRange}% p.a.</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Min SIP Amount</div>
        <div class="d-value">\u20B9${formatINR(fund.minSIP)}</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Exit Load</div>
        <div class="d-value">${fund.exitLoad}</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Expense Ratio</div>
        <div class="d-value">${fund.expenseRatio}</div>
    </div>
</div>`;
}

function sipComparisonTableHTML(rate, category, amounts) {
  const years = CATEGORIES[category].defaultYears;
  const months = years * 12;
  let rows = amounts.map(amt => {
    const fv = calculateSIPFV(amt, rate, months);
    const totalInvested = amt * months;
    const wealthGained = fv - totalInvested;
    return `<tr><td class="amt-col">${amountLabel(amt)}/mo</td><td class="emi-col">\u20B9${formatINR(fv)}</td><td>\u20B9${formatINR(totalInvested)}</td><td>\u20B9${formatINR(wealthGained)}</td></tr>`;
  }).join('');
  return `
<h2>SIP Returns for Different Monthly Amounts at ${rate}% p.a.</h2>
<p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">Investment period: ${years} years</p>
<table class="comparison-table">
    <thead><tr><th>Monthly SIP</th><th>Future Value</th><th>Total Invested</th><th>Wealth Gained</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

function amcComparisonTableHTML(category, sipAmount, amcsList) {
  const years = CATEGORIES[category].defaultYears;
  const months = years * 12;
  const rows = amcsList
    .filter(a => a.categories[category])
    .sort((a, b) => b.categories[category].returnRate - a.categories[category].returnRate)
    .slice(0, 15)
    .map(amc => {
      const fund = amc.categories[category];
      const fv = calculateSIPFV(sipAmount, fund.returnRate, months);
      const wealthGained = fv - sipAmount * months;
      return `<tr><td class="amt-col"><a href="/${amc.slug}-${category}-sip-calculator" style="color:var(--accent);text-decoration:none">${amc.name}</a></td><td>${fund.returnRange}%</td><td class="emi-col">\u20B9${formatINR(fv)}</td><td>\u20B9${formatINR(wealthGained)}</td></tr>`;
    }).join('');
  return `
<h2>Compare ${CATEGORIES[category].label} SIP Returns Across Fund Houses</h2>
<p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">For ${amountLabel(sipAmount)}/month \u00B7 Period: ${years} years</p>
<table class="comparison-table">
    <thead><tr><th>Fund House</th><th>Expected Return</th><th>Future Value</th><th>Wealth Gained</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

// ─── FAQ generators ──────────────────────────────────────────────────────────

function amcCategoryFAQs(amc, category, fund) {
  const cat = CATEGORIES[category];
  const months = cat.defaultYears * 12;
  const midAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];
  const fv = calculateSIPFV(midAmt, fund.returnRate, months);
  const totalInvested = midAmt * months;

  return [
    { q: `What is the expected return on ${amc.name} ${cat.label} funds in ${YEAR}?`, a: `${amc.name} ${cat.label} funds have historically delivered returns in the range of ${fund.returnRange}% per annum. Actual returns depend on market conditions, fund manager expertise, and the specific scheme. Popular funds include ${fund.popular}.` },
    { q: `What is the SIP return for ${amountLabel(midAmt)}/month in ${amc.name} ${cat.label} funds?`, a: `A monthly SIP of ${amountLabel(midAmt)} in ${amc.name} ${cat.label} funds at ${fund.returnRate}% for ${cat.defaultYears} years can grow to approximately \u20B9${formatINR(fv)}, with a total investment of \u20B9${formatINR(totalInvested)} and wealth gained of \u20B9${formatINR(fv - totalInvested)}.` },
    { q: `What is the minimum SIP amount for ${amc.name} ${cat.label} funds?`, a: `The minimum SIP amount for ${amc.name} ${cat.label} funds starts from \u20B9${formatINR(fund.minSIP)} per month. You can start investing with this small amount and increase it over time.` },
    { q: `What are the exit load charges for ${amc.name} ${cat.label} funds?`, a: `Exit load for ${amc.name} ${cat.label} funds: ${fund.exitLoad}. The expense ratio ranges from ${fund.expenseRatio}. Always check the latest scheme document for current charges.` },
    { q: `How to start SIP in ${amc.name} ${cat.label} funds?`, a: `You can start a SIP in ${amc.name} ${cat.label} funds through the AMC website, mobile app, or any registered mutual fund distributor. You'll need your PAN, Aadhaar, bank account, and KYC verification. Use the calculator above to plan your SIP amount.` },
  ];
}

function categoryAmountFAQs(category, amount) {
  const cat = CATEGORIES[category];
  const months = cat.defaultYears * 12;
  const rates = category === 'debt' ? [6, 7, 8] : category === 'hybrid' ? [9, 11, 13] : [10, 12, 14, 16];
  const fvs = rates.map(r => ({ rate: r, fv: calculateSIPFV(amount, r, months) }));

  return [
    { q: `What is the future value of ${amountLabel(amount)}/month SIP in ${cat.label} funds?`, a: `The future value of ${amountLabel(amount)}/month SIP in ${cat.label} funds depends on the return rate and period. At ${rates[1]}% for ${cat.defaultYears} years, it grows to approximately \u20B9${formatINR(fvs[1].fv)}, with total investment of \u20B9${formatINR(amount * months)}.` },
    { q: `Which ${cat.label} fund is best for ${amountLabel(amount)}/month SIP?`, a: `The best ${cat.label} fund depends on your risk tolerance and investment horizon. Compare returns across fund houses using the comparison table on this page. Look for consistent performance over 3-5 years rather than short-term returns.` },
    { q: `How much wealth can ${amountLabel(amount)}/month SIP create in ${cat.defaultYears} years?`, a: `At ${rates[1]}% annual return, ${amountLabel(amount)}/month SIP for ${cat.defaultYears} years creates wealth of \u20B9${formatINR(fvs[1].fv - amount * months)} over your total investment of \u20B9${formatINR(amount * months)}. Higher returns or longer tenure significantly increases wealth creation.` },
    { q: `Is ${amountLabel(amount)}/month SIP enough for long-term goals?`, a: `Whether ${amountLabel(amount)}/month is sufficient depends on your financial goal. For example, at ${rates[1]}% for ${cat.defaultYears} years, it grows to \u20B9${formatINR(fvs[1].fv)}. Consider step-up SIP (increasing amount annually by 10%) to significantly boost your corpus.` },
    { q: `What is the tax on ${cat.label} fund SIP returns?`, a: `Tax on ${cat.label} fund returns depends on the holding period. ${category === 'equity' || category === 'elss' || category === 'index' ? 'For equity-oriented funds, LTCG (holding > 1 year) above \u20B91.25 lakh is taxed at 12.5%. STCG is taxed at 20%.' : category === 'debt' ? 'Debt fund gains are taxed as per your income tax slab, regardless of holding period.' : 'For hybrid funds, taxation depends on the equity allocation. Funds with >65% equity follow equity taxation rules.'}` },
  ];
}

function categoryIndexFAQs(category) {
  const cat = CATEGORIES[category];
  return [
    { q: `What is ${cat.label} SIP?`, a: `${cat.label} SIP is a Systematic Investment Plan in ${cat.fullLabel}s. You invest a fixed amount monthly in ${cat.label.toLowerCase()} mutual funds, which ${category === 'equity' ? 'primarily invest in stocks of companies listed on stock exchanges' : category === 'debt' ? 'invest in fixed income instruments like government securities, corporate bonds, and money market instruments' : category === 'hybrid' ? 'invest in a mix of equity and debt instruments for balanced returns' : category === 'elss' ? 'are tax-saving mutual funds that offer deduction under Section 80C with a 3-year lock-in period' : 'track a market index like Nifty 50 or Sensex, offering low-cost market returns'}.` },
    { q: `What is the expected return on ${cat.label} SIP?`, a: `${cat.label} funds have historically delivered returns in the range of ${cat.defaultReturn - 4}% to ${cat.defaultReturn + 4}% per annum over long periods. However, returns are not guaranteed and vary based on market conditions. Risk level: ${cat.riskLevel}.` },
    { q: `Which ${cat.label} fund is best for SIP in ${YEAR}?`, a: `The best ${cat.label} fund for SIP depends on your goals, risk tolerance, and investment horizon. Compare returns across all major fund houses on this page. Look for consistency in 3, 5, and 10-year returns rather than short-term performance.` },
    { q: `What is the minimum SIP amount for ${cat.label} funds?`, a: `Most ${cat.label} funds allow SIP starting from \u20B9500 per month. Some index funds allow as low as \u20B9100. Check the minimum SIP amount for each fund house in the comparison table above.` },
    { q: `How long should I invest in ${cat.label} SIP?`, a: `For ${category === 'equity' || category === 'elss' || category === 'index' ? 'equity-oriented funds, a minimum of 5-7 years is recommended to ride out market volatility. 10+ years is ideal for wealth creation' : category === 'debt' ? 'debt funds, 1-3 years is suitable for short-term goals. Match your investment horizon with the fund duration' : 'hybrid funds, 3-5 years is a good minimum. The equity component benefits from longer tenure while debt provides stability'}.` },
  ];
}

function amcIndexFAQs(amc) {
  const catList = Object.keys(amc.categories);
  return [
    { q: `What types of mutual funds does ${amc.name} offer?`, a: `${amc.fullName} offers ${catList.map(c => CATEGORIES[c].label).join(', ')} mutual funds. Each category has different risk-return profiles and investment objectives. AUM: ${amc.aum}.` },
    { q: `How to start SIP with ${amc.name}?`, a: `You can start SIP with ${amc.name} through their official website, mobile app, or any registered mutual fund distributor. Complete your KYC (PAN + Aadhaar), choose a fund, set your SIP amount and date, and enable auto-debit from your bank account.` },
    { q: `What is the minimum SIP amount for ${amc.name} funds?`, a: `${amc.name} allows SIP starting from \u20B9${formatINR(Math.min(...catList.map(c => amc.categories[c].minSIP)))} per month across various schemes. The exact minimum varies by fund category and scheme.` },
    { q: `Are ${amc.name} mutual funds good for long-term investment?`, a: `${amc.fullName} is one of India's established fund houses with an AUM of ${amc.aum}. The performance varies across different schemes. Compare specific fund categories and their historical returns on this page before investing.` },
    { q: `What is the AUM of ${amc.name}?`, a: `${amc.fullName} manages Assets Under Management (AUM) of approximately ${amc.aum} as of ${YEAR}. A larger AUM generally indicates investor confidence but doesn't guarantee better returns.` },
  ];
}

function faqHTML(faqs) {
  const items = faqs.map(f => `
    <div class="faq-item">
        <h3>${f.q}</h3>
        <p>${f.a}</p>
    </div>`).join('');
  return `
<section class="faq-section">
    <h2>Frequently Asked Questions</h2>
    ${items}
</section>`;
}

function faqSchemaJSON(faqs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  });
}

function breadcrumbSchemaJSON(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.label,
      ...(item.href ? { "item": DOMAIN + item.href } : {})
    }))
  });
}

// ─── Page assembly ───────────────────────────────────────────────────────────

function buildPage(opts) {
  const { title, description, keywords, canonicalPath, breadcrumb, breadcrumbItems, content, faqSection, linksSection, prefillAmount, prefillRate, prefillTenure, prefillUnit, jsonLd } = opts;

  let allJsonLd = '';
  if (jsonLd) allJsonLd += `<script type="application/ld+json">\n${jsonLd}\n</script>\n`;
  if (breadcrumbItems) allJsonLd += `    <script type="application/ld+json">\n${breadcrumbSchemaJSON(breadcrumbItems)}\n</script>`;

  const verificationTag = GOOGLE_VERIFICATION ? `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">` : '';

  let html = layoutTemplate
    .replace(/{{PAGE_TITLE}}/g, title)
    .replace(/{{META_DESCRIPTION}}/g, description)
    .replace(/{{META_KEYWORDS}}/g, keywords || '')
    .replace(/{{CANONICAL_PATH}}/g, canonicalPath)
    .replace('{{JSON_LD}}', allJsonLd)
    .replace('{{GOOGLE_VERIFICATION}}', verificationTag)
    .replace('{{BREADCRUMB}}', breadcrumb || '')
    .replace('{{CONTENT}}', content)
    .replace('{{FAQ_SECTION}}', faqSection || '')
    .replace('{{LINKS_SECTION}}', linksSection || '')
    .replace('{{CALCULATOR_JS}}', `var PREFILL_AMOUNT = ${prefillAmount};\nvar PREFILL_RATE = ${prefillRate};\nvar PREFILL_TENURE = ${prefillTenure};\nvar PREFILL_UNIT = '${prefillUnit || 'years'}';\n` + CALCULATOR_JS);

  return html;
}

function breadcrumbHTML(items) {
  const links = items.map((item, i) => {
    if (i === items.length - 1) return `<span style="color:var(--text)">${item.label}</span>`;
    return `<a href="${item.href}">${item.label}</a>`;
  });
  return `<nav class="breadcrumb">${links.join('<span>\u203A</span>')}</nav>`;
}

function linksGridHTML(title, links) {
  if (!links.length) return '';
  const items = links.map(l => `<a href="${l.href}">${l.label}${l.sub ? '<span class="link-sub">' + l.sub + '</span>' : ''}</a>`).join('');
  return `
<section class="links-section">
    <h2>${title}</h2>
    <div class="links-grid">${items}</div>
</section>`;
}

// ─── Page generators ─────────────────────────────────────────────────────────
const allPages = [];

// 1. AMC + Category page: /sbi-mutual-fund-equity-sip-calculator
function generateAmcCategoryPage(amc, category) {
  const fund = amc.categories[category];
  if (!fund) return;
  const cat = CATEGORIES[category];
  const slug = `${amc.slug}-${category}-sip-calculator`;
  const months = cat.defaultYears * 12;
  const defaultAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];
  const fv = calculateSIPFV(defaultAmt, fund.returnRate, months);
  const totalInvested = defaultAmt * months;

  const faqs = amcCategoryFAQs(amc, category, fund);

  const amountLinks = SIP_AMOUNTS.map(a => ({
    href: `/${amc.slug}-${category}-sip-calculator-for-${amountSlug(a)}-per-month`,
    label: `${amc.name} ${cat.label} SIP for ${amountLabel(a)}/mo`,
  }));

  const otherAmcLinks = amcs
    .filter(a => a.slug !== amc.slug && a.categories[category])
    .slice(0, 12)
    .map(a => ({
      href: `/${a.slug}-${category}-sip-calculator`,
      label: `${a.name} ${cat.label} SIP`,
      sub: `Returns: ${a.categories[category].returnRange}%`,
    }));

  const otherCatLinks = Object.keys(amc.categories)
    .filter(c => c !== category)
    .map(c => ({
      href: `/${amc.slug}-${c}-sip-calculator`,
      label: `${amc.name} ${CATEGORIES[c].label} SIP`,
    }));

  const content = `
<section class="page-hero">
    <h1>${amc.name} <span class="hl">${cat.label}</span> SIP Calculator ${YEAR}</h1>
    <p>Calculate SIP returns for ${amc.name} ${cat.label} mutual funds. Expected returns: ${fund.returnRange}% p.a. Min SIP: \u20B9${formatINR(fund.minSIP)}/month.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${amc.name} ${cat.label} Fund Details ${YEAR}</h2>
    ${detailsGridHTML(fund)}
    <p>${amc.fullName} offers ${cat.label.toLowerCase()} mutual funds with expected returns of ${fund.returnRange}% per annum. Popular schemes include ${fund.popular}. Risk level: ${fund.riskLevel}.</p>
    ${sipComparisonTableHTML(fund.returnRate, category, SIP_AMOUNTS)}
</section>`;

  const links =
    linksGridHTML(`${amc.name} ${cat.label} SIP by Amount`, amountLinks) +
    linksGridHTML(`${cat.label} SIP from Other Fund Houses`, otherAmcLinks) +
    linksGridHTML(`Other ${amc.name} Fund Categories`, otherCatLinks);

  const html = buildPage({
    title: `${amc.name} ${cat.label} SIP Calculator ${YEAR} | SIP Batao`,
    description: `Calculate ${amc.name} ${cat.label} SIP returns online. Expected returns: ${fund.returnRange}% p.a. SIP of ${amountLabel(defaultAmt)}/mo for ${cat.defaultYears} years = \u20B9${formatINR(fv)}.`,
    keywords: `${amc.slug} ${category} sip calculator, ${amc.name} ${cat.label.toLowerCase()} sip returns, ${amc.name} ${cat.label.toLowerCase()} mutual fund sip`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { href: `/${category}-sip-calculator`, label: `${cat.label} SIP` },
      { href: `/${amc.slug}-sip-calculator`, label: amc.name },
      { label: `${amc.name} ${cat.label}` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: defaultAmt,
    prefillRate: fund.returnRate,
    prefillTenure: cat.defaultYears,
    prefillUnit: 'years',
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 2. Category + Amount page: /equity-sip-calculator-for-5000-per-month
function generateCategoryAmountPage(category, amount) {
  const cat = CATEGORIES[category];
  const slug = `${category}-sip-calculator-for-${amountSlug(amount)}-per-month`;
  const months = cat.defaultYears * 12;

  const amcsWithCat = amcs.filter(a => a.categories[category]);
  const avgRate = amcsWithCat.reduce((sum, a) => sum + a.categories[category].returnRate, 0) / amcsWithCat.length;
  const displayRate = Math.round(avgRate * 100) / 100;
  const fv = calculateSIPFV(amount, displayRate, months);
  const totalInvested = amount * months;

  const faqs = categoryAmountFAQs(category, amount);

  const amcLinks = amcsWithCat.slice(0, 15).map(a => ({
    href: `/${a.slug}-${category}-sip-calculator-for-${amountSlug(amount)}-per-month`,
    label: `${a.name} ${cat.label} SIP for ${amountLabel(amount)}/mo`,
    sub: `Returns: ${a.categories[category].returnRange}%`,
  }));

  const otherAmountLinks = SIP_AMOUNTS
    .filter(a => a !== amount)
    .map(a => ({
      href: `/${category}-sip-calculator-for-${amountSlug(a)}-per-month`,
      label: `${cat.label} SIP for ${amountLabel(a)}/month`,
    }));

  const content = `
<section class="page-hero">
    <h1>${amountLabel(amount)}/month <span class="hl">${cat.label}</span> SIP Calculator</h1>
    <p>Calculate returns for ${amountLabel(amount)} monthly SIP in ${cat.label.toLowerCase()} mutual funds. Compare across ${amcsWithCat.length}+ fund houses.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${amountLabel(amount)}/month ${cat.label} SIP \u2014 Returns Comparison</h2>
    <p>Investing ${amountLabel(amount)} per month in ${cat.label.toLowerCase()} funds at an average return of ${displayRate}% for ${cat.defaultYears} years can grow to approximately \u20B9${formatINR(fv)}. Your total investment would be \u20B9${formatINR(totalInvested)} with wealth gained of \u20B9${formatINR(fv - totalInvested)}.</p>
    ${amcComparisonTableHTML(category, amount, amcs)}
</section>`;

  const links =
    linksGridHTML(`${amountLabel(amount)}/mo ${cat.label} SIP by Fund House`, amcLinks) +
    linksGridHTML(`Other ${cat.label} SIP Amounts`, otherAmountLinks);

  const html = buildPage({
    title: `${amountLabel(amount)}/month ${cat.label} SIP Calculator | SIP Batao`,
    description: `Calculate ${amountLabel(amount)}/month ${cat.label} SIP returns. At ${displayRate}%, future value = \u20B9${formatINR(fv)} in ${cat.defaultYears} years. Compare ${amcsWithCat.length}+ fund houses.`,
    keywords: `${category} sip calculator for ${amount} per month, ${amountLabel(amount)} ${cat.label.toLowerCase()} sip returns`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { href: `/${category}-sip-calculator`, label: `${cat.label} SIP` },
      { label: `${amountLabel(amount)}/month` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: amount,
    prefillRate: displayRate,
    prefillTenure: cat.defaultYears,
    prefillUnit: 'years',
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 3. AMC + Category + Amount page: /sbi-mutual-fund-equity-sip-calculator-for-5000-per-month
function generateAmcCategoryAmountPage(amc, category, amount) {
  const fund = amc.categories[category];
  if (!fund) return;
  const cat = CATEGORIES[category];
  const slug = `${amc.slug}-${category}-sip-calculator-for-${amountSlug(amount)}-per-month`;
  const months = cat.defaultYears * 12;
  const fv = calculateSIPFV(amount, fund.returnRate, months);
  const totalInvested = amount * months;
  const wealthGained = fv - totalInvested;

  const faqs = [
    { q: `What is the SIP return for ${amountLabel(amount)}/month in ${amc.name} ${cat.label} funds?`, a: `At ${fund.returnRate}% expected return for ${cat.defaultYears} years, ${amountLabel(amount)}/month SIP in ${amc.name} ${cat.label} funds grows to approximately \u20B9${formatINR(fv)}. Total invested: \u20B9${formatINR(totalInvested)}, Wealth gained: \u20B9${formatINR(wealthGained)}.` },
    { q: `Is ${amountLabel(amount)}/month SIP in ${amc.name} ${cat.label} funds a good investment?`, a: `${amc.name} ${cat.label} funds offer expected returns of ${fund.returnRange}% p.a. with ${fund.riskLevel.toLowerCase()} risk. Popular schemes include ${fund.popular}. Compare with other fund houses on this page.` },
    { q: `What is the expense ratio of ${amc.name} ${cat.label} funds?`, a: `${amc.name} ${cat.label} funds have an expense ratio of ${fund.expenseRatio}. Lower expense ratios mean more of your returns stay with you. Exit load: ${fund.exitLoad}.` },
    { q: `Can I increase my ${amountLabel(amount)} SIP in ${amc.name} later?`, a: `Yes, most ${amc.name} fund schemes allow you to increase (top-up) your SIP amount. You can also start an additional SIP in the same or different scheme. Consider step-up SIP for automatic annual increases.` },
    { q: `How long should I continue ${amountLabel(amount)} SIP in ${amc.name} ${cat.label} funds?`, a: `${category === 'equity' || category === 'elss' || category === 'index' ? `For equity-oriented funds, staying invested for 7-10+ years is recommended to benefit from compounding and average out market volatility.` : category === 'debt' ? `For debt funds, 1-3 years is typical. Match your SIP duration with your financial goal timeline.` : `For hybrid funds, 5-7 years is ideal to benefit from both equity growth and debt stability.`}` },
  ];

  const otherAmcLinks = amcs
    .filter(a => a.slug !== amc.slug && a.categories[category])
    .slice(0, 10)
    .map(a => ({
      href: `/${a.slug}-${category}-sip-calculator-for-${amountSlug(amount)}-per-month`,
      label: `${a.name} ${cat.label} SIP for ${amountLabel(amount)}/mo`,
      sub: `Returns: ${a.categories[category].returnRange}%`,
    }));

  const otherAmountLinks = SIP_AMOUNTS
    .filter(a => a !== amount)
    .slice(0, 8)
    .map(a => ({
      href: `/${amc.slug}-${category}-sip-calculator-for-${amountSlug(a)}-per-month`,
      label: `${amc.name} ${cat.label} SIP for ${amountLabel(a)}/mo`,
    }));

  const content = `
<section class="page-hero">
    <h1>${amc.name} <span class="hl">${cat.label}</span> SIP for ${amountLabel(amount)}/month</h1>
    <p>Future Value: \u20B9${formatINR(fv)} at ${fund.returnRate}% for ${cat.defaultYears} years. Wealth gained: \u20B9${formatINR(wealthGained)}.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${amc.name} ${cat.label} SIP for ${amountLabel(amount)}/month \u2014 Key Details</h2>
    ${detailsGridHTML(fund)}
    <p>A monthly SIP of ${amountLabel(amount)} in ${amc.name} ${cat.label} funds at ${fund.returnRate}% for ${cat.defaultYears} years grows to \u20B9${formatINR(fv)}. Total amount invested: \u20B9${formatINR(totalInvested)}, wealth gained: \u20B9${formatINR(wealthGained)}. Popular schemes: ${fund.popular}.</p>
</section>`;

  const links =
    linksGridHTML(`${amountLabel(amount)}/mo ${cat.label} SIP from Other Fund Houses`, otherAmcLinks) +
    linksGridHTML(`Other ${amc.name} ${cat.label} SIP Amounts`, otherAmountLinks);

  const html = buildPage({
    title: `${amc.name} ${cat.label} SIP for ${amountLabel(amount)}/month (${YEAR}) | SIP Batao`,
    description: `${amc.name} ${cat.label} SIP for ${amountLabel(amount)}/month = \u20B9${formatINR(fv)} at ${fund.returnRate}% for ${cat.defaultYears} years. Wealth gained: \u20B9${formatINR(wealthGained)}.`,
    keywords: `${amc.slug} ${category} sip for ${amount} per month, ${amc.name} ${cat.label.toLowerCase()} sip ${amountLabel(amount)}`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { href: `/${category}-sip-calculator`, label: `${cat.label} SIP` },
      { href: `/${amc.slug}-${category}-sip-calculator`, label: amc.name },
      { label: `${amountLabel(amount)}/month` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: amount,
    prefillRate: fund.returnRate,
    prefillTenure: cat.defaultYears,
    prefillUnit: 'years',
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 4. Category Index page: /equity-sip-calculator
function generateCategoryIndexPage(category) {
  const cat = CATEGORIES[category];
  const slug = `${category}-sip-calculator`;
  const amcsWithCat = amcs.filter(a => a.categories[category]).sort((a, b) => b.categories[category].returnRate - a.categories[category].returnRate);
  const bestReturn = amcsWithCat[0]?.categories[category];
  const defaultAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];

  const faqs = categoryIndexFAQs(category);

  const amcLinks = amcsWithCat.map(a => ({
    href: `/${a.slug}-${category}-sip-calculator`,
    label: `${a.name} ${cat.label} SIP Calculator`,
    sub: `Returns: ${a.categories[category].returnRange}%`,
  }));

  const amountLinks = SIP_AMOUNTS.map(a => ({
    href: `/${category}-sip-calculator-for-${amountSlug(a)}-per-month`,
    label: `${cat.label} SIP for ${amountLabel(a)}/month`,
  }));

  const otherCatLinks = Object.keys(CATEGORIES)
    .filter(c => c !== category)
    .map(c => ({
      href: `/${c}-sip-calculator`,
      label: `${CATEGORIES[c].label} SIP Calculator`,
    }));

  const content = `
<section class="page-hero">
    <h1><span class="hl">${cat.label}</span> SIP Calculator Online</h1>
    <p>Calculate ${cat.label.toLowerCase()} mutual fund SIP returns from ${amcsWithCat.length}+ fund houses. Expected returns: ${bestReturn ? bestReturn.returnRange : 'N/A'}% p.a.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${cat.label} SIP Returns Comparison ${YEAR}</h2>
    <p>Compare ${cat.label.toLowerCase()} mutual fund SIP returns across all major Indian fund houses.</p>
    ${amcComparisonTableHTML(category, defaultAmt, amcs)}
</section>`;

  const links =
    linksGridHTML(`${cat.label} SIP by Fund House`, amcLinks) +
    linksGridHTML(`${cat.label} SIP by Amount`, amountLinks) +
    linksGridHTML('Other SIP Calculators', otherCatLinks);

  const html = buildPage({
    title: `${cat.label} SIP Calculator Online | Compare All Fund Houses ${YEAR} | SIP Batao`,
    description: `Free ${cat.label} SIP calculator. Compare ${cat.label.toLowerCase()} mutual fund returns from ${amcsWithCat.length}+ fund houses. Expected returns: ${bestReturn ? bestReturn.returnRange : '10 - 15'}% p.a.`,
    keywords: `${category} sip calculator, ${cat.label.toLowerCase()} mutual fund sip calculator, ${cat.label.toLowerCase()} sip returns ${YEAR}`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: `${cat.label} SIP Calculator` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: defaultAmt,
    prefillRate: bestReturn ? bestReturn.returnRate : cat.defaultReturn,
    prefillTenure: cat.defaultYears,
    prefillUnit: 'years',
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 5. AMC Index page: /sbi-mutual-fund-sip-calculator
function generateAmcIndexPage(amc) {
  const slug = `${amc.slug}-sip-calculator`;
  const catList = Object.keys(amc.categories);
  const faqs = amcIndexFAQs(amc);

  const catLinks = catList.map(c => ({
    href: `/${amc.slug}-${c}-sip-calculator`,
    label: `${amc.name} ${CATEGORIES[c].label} SIP`,
    sub: `Returns: ${amc.categories[c].returnRange}%`,
  }));

  const otherAmcLinks = amcs
    .filter(a => a.slug !== amc.slug)
    .slice(0, 12)
    .map(a => ({
      href: `/${a.slug}-sip-calculator`,
      label: `${a.name} SIP Calculator`,
    }));

  // Rate table for all categories
  const rateRows = catList.map(c => {
    const fund = amc.categories[c];
    return `<tr><td class="amt-col"><a href="/${amc.slug}-${c}-sip-calculator" style="color:var(--accent);text-decoration:none">${CATEGORIES[c].label}</a></td><td class="emi-col">${fund.returnRange}%</td><td>\u20B9${formatINR(fund.minSIP)}</td><td>${fund.expenseRatio}</td><td>${fund.riskLevel}</td></tr>`;
  }).join('');

  const firstCat = catList[0];
  const firstFund = amc.categories[firstCat];
  const defaultAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];

  const content = `
<section class="page-hero">
    <h1><span class="hl">${amc.name}</span> SIP Calculator ${YEAR}</h1>
    <p>Calculate SIP returns for all ${amc.fullName} mutual fund categories. AUM: ${amc.aum}.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${amc.name} Mutual Fund Categories ${YEAR}</h2>
    <p>Here are all mutual fund categories offered by ${amc.fullName} with their expected returns and key details.</p>
    <table class="comparison-table">
        <thead><tr><th>Category</th><th>Expected Return</th><th>Min SIP</th><th>Expense Ratio</th><th>Risk Level</th></tr></thead>
        <tbody>${rateRows}</tbody>
    </table>
</section>`;

  const links =
    linksGridHTML(`${amc.name} SIP by Category`, catLinks) +
    linksGridHTML('Other Fund House SIP Calculators', otherAmcLinks);

  const html = buildPage({
    title: `${amc.name} SIP Calculator ${YEAR} | All Fund Categories | SIP Batao`,
    description: `Calculate ${amc.name} SIP returns for ${catList.map(c => CATEGORIES[c].label).join(', ')} mutual funds. AUM: ${amc.aum}. Compare returns and start investing.`,
    keywords: `${amc.slug} sip calculator, ${amc.name} mutual fund sip returns, ${amc.name} sip`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: `${amc.name} SIP Calculator` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: defaultAmt,
    prefillRate: firstFund ? firstFund.returnRate : 12,
    prefillTenure: CATEGORIES[firstCat] ? CATEGORIES[firstCat].defaultYears : 10,
    prefillUnit: 'years',
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 6. General amount page: /sip-calculator-for-5000-per-month
function generateGeneralAmountPage(amount) {
  const slug = `sip-calculator-for-${amountSlug(amount)}-per-month`;
  const defaultRate = 12;
  const defaultYears = 10;
  const months = defaultYears * 12;
  const fv = calculateSIPFV(amount, defaultRate, months);
  const totalInvested = amount * months;

  const faqs = [
    { q: `How much will ${amountLabel(amount)}/month SIP grow in 10 years?`, a: `At 12% annual return, ${amountLabel(amount)}/month SIP for 10 years grows to approximately \u20B9${formatINR(fv)}. Your total investment would be \u20B9${formatINR(totalInvested)} with wealth gained of \u20B9${formatINR(fv - totalInvested)}.` },
    { q: `Which fund category is best for ${amountLabel(amount)}/month SIP?`, a: `For long-term goals (7+ years), equity funds offer the highest growth potential. For medium-term (3-5 years), hybrid funds provide balanced risk-return. For short-term (1-3 years), debt funds offer stability. Use the calculator above to compare.` },
    { q: `Can I start SIP with ${amountLabel(amount)}/month?`, a: `Yes, most mutual funds allow SIP starting from \u20B9500/month. ${amountLabel(amount)}/month is ${amount >= 5000 ? 'a great amount for building long-term wealth' : 'a good starting point that you can increase over time'}. You can invest in equity, debt, hybrid, or ELSS funds.` },
    { q: `What is the power of compounding in ${amountLabel(amount)} SIP?`, a: `With ${amountLabel(amount)}/month SIP at 12%, you invest \u20B9${formatINR(totalInvested)} over 10 years but receive \u20B9${formatINR(fv)} \u2014 that's \u20B9${formatINR(fv - totalInvested)} created by compounding alone! Over 20 years, the effect is even more dramatic.` },
    { q: `Should I do step-up SIP with ${amountLabel(amount)}/month?`, a: `Yes! If you start with ${amountLabel(amount)}/month and increase by 10% annually, your corpus after 10 years at 12% would be significantly higher than a flat SIP. Step-up SIP aligns with your growing income.` },
  ];

  const catLinks = Object.keys(CATEGORIES).map(c => ({
    href: `/${c}-sip-calculator-for-${amountSlug(amount)}-per-month`,
    label: `${CATEGORIES[c].label} SIP for ${amountLabel(amount)}/mo`,
    sub: `Expected: ${CATEGORIES[c].defaultReturn}% p.a.`,
  }));

  const otherAmountLinks = SIP_AMOUNTS
    .filter(a => a !== amount)
    .map(a => ({
      href: `/sip-calculator-for-${amountSlug(a)}-per-month`,
      label: `SIP Calculator for ${amountLabel(a)}/month`,
    }));

  // Category comparison
  const catRows = Object.keys(CATEGORIES).map(c => {
    const cat = CATEGORIES[c];
    const catFv = calculateSIPFV(amount, cat.defaultReturn, cat.defaultYears * 12);
    const catInvested = amount * cat.defaultYears * 12;
    return `<tr><td class="amt-col"><a href="/${c}-sip-calculator-for-${amountSlug(amount)}-per-month" style="color:var(--accent);text-decoration:none">${cat.label}</a></td><td>${cat.defaultReturn}%</td><td class="emi-col">\u20B9${formatINR(catFv)}</td><td>\u20B9${formatINR(catFv - catInvested)}</td><td>${cat.defaultYears} years</td></tr>`;
  }).join('');

  const content = `
<section class="page-hero">
    <h1>SIP Calculator for <span class="hl">${amountLabel(amount)}/month</span></h1>
    <p>See how ${amountLabel(amount)} monthly SIP grows across Equity, Debt, Hybrid, ELSS, and Index mutual funds.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${amountLabel(amount)}/month SIP \u2014 Returns by Fund Category</h2>
    <p>Compare how ${amountLabel(amount)}/month SIP grows across different mutual fund categories.</p>
    <table class="comparison-table">
        <thead><tr><th>Category</th><th>Expected Return</th><th>Future Value</th><th>Wealth Gained</th><th>Period</th></tr></thead>
        <tbody>${catRows}</tbody>
    </table>
</section>`;

  const links =
    linksGridHTML(`${amountLabel(amount)}/mo SIP by Category`, catLinks) +
    linksGridHTML('Other SIP Amounts', otherAmountLinks);

  const html = buildPage({
    title: `SIP Calculator for ${amountLabel(amount)}/month | Compare All Fund Types | SIP Batao`,
    description: `Calculate ${amountLabel(amount)}/month SIP returns. At 12%, it grows to \u20B9${formatINR(fv)} in 10 years. Compare Equity, Debt, Hybrid, ELSS & Index funds.`,
    keywords: `sip calculator for ${amount} per month, ${amountLabel(amount)} sip returns, ${amountLabel(amount)} monthly sip`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: `SIP for ${amountLabel(amount)}/month` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: amount,
    prefillRate: defaultRate,
    prefillTenure: defaultYears,
    prefillUnit: 'years',
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// ─── Affiliate page generator ────────────────────────────────────────────────

function buildAffiliatePage(opts) {
  const { title, description, keywords, canonicalPath, breadcrumb, breadcrumbItems, content, faqSection, linksSection, disclaimer, jsonLd } = opts;

  let allJsonLd = '';
  if (jsonLd) allJsonLd += `<script type="application/ld+json">\n${jsonLd}\n</script>\n`;
  if (breadcrumbItems) allJsonLd += `    <script type="application/ld+json">\n${breadcrumbSchemaJSON(breadcrumbItems)}\n</script>`;

  const verificationTag = GOOGLE_VERIFICATION ? `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">` : '';

  let html = affiliateTemplate
    .replace(/{{PAGE_TITLE}}/g, title)
    .replace(/{{META_DESCRIPTION}}/g, description)
    .replace(/{{META_KEYWORDS}}/g, keywords || '')
    .replace(/{{CANONICAL_PATH}}/g, canonicalPath)
    .replace('{{JSON_LD}}', allJsonLd)
    .replace('{{GOOGLE_VERIFICATION}}', verificationTag)
    .replace('{{BREADCRUMB}}', breadcrumb || '')
    .replace('{{CONTENT}}', content)
    .replace('{{FAQ_SECTION}}', faqSection || '')
    .replace('{{LINKS_SECTION}}', linksSection || '')
    .replace('{{DISCLAIMER}}', disclaimer || '');

  return html;
}

function generateAffiliatePage(pageData) {
  const { slug, title, description, keywords, heroTitle, heroSub, category, pageType, faqs } = pageData;
  const cat = CATEGORIES[category];

  let content = '';

  if (pageType === 'fund-comparison') {
    // --- Top 3 Picks ---
    const topAMCs = pageData.topPicks
      .map(s => amcs.find(a => a.slug === s))
      .filter(a => a && a.categories[category]);

    const picksHTML = topAMCs.map((amc, i) => {
      const fund = amc.categories[category];
      const badgeText = pageData.badges[amc.slug] || '';
      const note = pageData.editorNotes[amc.slug] || '';
      const defaultAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];
      const months = cat.defaultYears * 12;
      const fv = calculateSIPFV(defaultAmt, fund.returnRate, months);

      return `
    <div class="pick-card${i === 0 ? ' featured' : ''}">
        ${badgeText ? `<div class="pick-badge">${badgeText}</div>` : ''}
        <div class="pick-rank">#${i + 1} Pick</div>
        <div class="pick-name">${amc.fullName}</div>
        <div class="pick-rate">${fund.returnRange}% <small>p.a.</small></div>
        <p class="pick-note">${note}</p>
        <ul class="pick-features">
            <li>Min SIP: \u20B9${formatINR(fund.minSIP)}/month</li>
            <li>Expense Ratio: ${fund.expenseRatio}</li>
            <li>Exit Load: ${fund.exitLoad}</li>
            <li>SIP of \u20B9${formatINR(defaultAmt)}/mo for ${cat.defaultYears}yr = \u20B9${formatINR(fv)}</li>
        </ul>
        <a href="/${amc.slug}-${category}-sip-calculator" class="pick-cta">${pageData.ctaText} \u2192</a>
    </div>`;
    }).join('');

    // --- Full Comparison Table ---
    const amcsWithCat = amcs
      .filter(a => a.categories[category])
      .sort((a, b) => b.categories[category].returnRate - a.categories[category].returnRate);

    const defaultAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];
    const months = cat.defaultYears * 12;

    const tableRows = amcsWithCat.map(amc => {
      const fund = amc.categories[category];
      const fv = calculateSIPFV(defaultAmt, fund.returnRate, months);
      return `<tr>
        <td class="bank-name">${amc.name}</td>
        <td class="rate-col">${fund.returnRange}%</td>
        <td>\u20B9${formatINR(fund.minSIP)}</td>
        <td>${fund.expenseRatio}</td>
        <td>${fund.popular.split(',')[0]}</td>
        <td class="cta-col"><a href="/${amc.slug}-${category}-sip-calculator" class="table-cta">${pageData.ctaText} \u2192</a></td>
    </tr>`;
    }).join('');

    content = `
<section class="page-hero">
    <h1><span class="hl">${heroTitle}</span> in India ${YEAR}</h1>
    <p>${heroSub}</p>
    <div class="updated">Updated: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="top-picks">
    <h2 class="top-picks-title">Our Top Picks</h2>
    <div class="picks-grid">
        ${picksHTML}
    </div>
</section>

<section class="comparison-section">
    <h2>All ${cat.label} Fund Houses \u2014 Full Comparison</h2>
    <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">Returns for \u20B9${formatINR(defaultAmt)}/month SIP over ${cat.defaultYears} years. Sorted by expected returns (highest first).</p>
    <div class="table-container">
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Fund House</th>
                    <th>Expected Return</th>
                    <th>Min SIP</th>
                    <th>Expense Ratio</th>
                    <th>Popular Scheme</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
</section>

<section class="calc-cta">
    <div class="calc-cta-box">
        <h3>Calculate Your SIP Returns</h3>
        <p>Know your exact future value, total investment, and wealth gained with our free SIP calculator.</p>
        <a href="/${category}-sip-calculator" class="calc-cta-btn">Open SIP Calculator \u2192</a>
    </div>
</section>`;

  } else if (pageType === 'content-comparison') {
    // --- SIP vs Lumpsum style content comparison ---
    const comparisonRows = pageData.comparisonTable.map(row => {
      return `<tr>
        <td>${row.factor}</td>
        <td>${row.sip}</td>
        <td>${row.lumpsum}</td>
    </tr>`;
    }).join('');

    // --- SIP Recommended AMCs ---
    const sipAMCs = pageData.sipRecommendedAMCs
      .map(s => amcs.find(a => a.slug === s))
      .filter(a => a && a.categories[category]);

    const sipPicksHTML = sipAMCs.map((amc, i) => {
      const fund = amc.categories[category];
      const badgeText = pageData.sipBadges[amc.slug] || '';
      const note = pageData.sipRecommendedNotes[amc.slug] || '';
      const defaultAmt = SIP_AMOUNTS[Math.floor(SIP_AMOUNTS.length / 2)];
      const months = cat.defaultYears * 12;
      const fv = calculateSIPFV(defaultAmt, fund.returnRate, months);

      return `
    <div class="pick-card${i === 0 ? ' featured' : ''}">
        ${badgeText ? `<div class="pick-badge">${badgeText}</div>` : ''}
        <div class="pick-rank">#${i + 1} for SIP</div>
        <div class="pick-name">${amc.fullName}</div>
        <div class="pick-rate">${fund.returnRange}% <small>p.a.</small></div>
        <p class="pick-note">${note}</p>
        <ul class="pick-features">
            <li>Min SIP: \u20B9${formatINR(fund.minSIP)}/month</li>
            <li>Expense Ratio: ${fund.expenseRatio}</li>
            <li>SIP of \u20B9${formatINR(defaultAmt)}/mo for ${cat.defaultYears}yr = \u20B9${formatINR(fv)}</li>
        </ul>
        <a href="/${amc.slug}-${category}-sip-calculator" class="pick-cta">Calculate SIP Returns \u2192</a>
    </div>`;
    }).join('');

    // --- Lumpsum Recommended AMCs ---
    const lumpAMCs = pageData.lumpsumRecommendedAMCs
      .map(s => amcs.find(a => a.slug === s))
      .filter(a => a);

    const lumpPicksHTML = lumpAMCs.map((amc, i) => {
      const fund = amc.categories['hybrid'] || amc.categories['index'] || amc.categories[category];
      if (!fund) return '';
      const badgeText = pageData.lumpsumBadges[amc.slug] || '';
      const note = pageData.lumpsumRecommendedNotes[amc.slug] || '';
      const fundCat = amc.categories['hybrid'] ? 'hybrid' : amc.categories['index'] ? 'index' : category;

      return `
    <div class="pick-card${i === 0 ? ' featured' : ''}">
        ${badgeText ? `<div class="pick-badge">${badgeText}</div>` : ''}
        <div class="pick-rank">#${i + 1} for Lump Sum</div>
        <div class="pick-name">${amc.fullName}</div>
        <div class="pick-rate">${fund.returnRange}% <small>p.a.</small></div>
        <p class="pick-note">${note}</p>
        <ul class="pick-features">
            <li>Min SIP: \u20B9${formatINR(fund.minSIP)}/month</li>
            <li>Expense Ratio: ${fund.expenseRatio}</li>
            <li>Risk Level: ${fund.riskLevel}</li>
        </ul>
        <a href="/${amc.slug}-${fundCat}-sip-calculator" class="pick-cta">Calculate Returns \u2192</a>
    </div>`;
    }).join('');

    content = `
<section class="page-hero">
    <h1><span class="hl">${heroTitle}</span> ${YEAR}</h1>
    <p>${heroSub}</p>
    <div class="updated">Updated: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="content-comparison">
    <h2>SIP vs Lump Sum \u2014 Head-to-Head Comparison</h2>
    <div class="table-container">
        <table class="vs-table">
            <thead>
                <tr>
                    <th>Factor</th>
                    <th class="sip-col">SIP Advantage</th>
                    <th class="lump-col">Lump Sum Advantage</th>
                </tr>
            </thead>
            <tbody>
                ${comparisonRows}
            </tbody>
        </table>
    </div>
</section>

<section class="top-picks">
    <h2 class="top-picks-title">Best AMCs for SIP (Equity)</h2>
    <div class="picks-grid">
        ${sipPicksHTML}
    </div>
</section>

<!-- Ad: Between Picks -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="top-picks">
    <h2 class="top-picks-title">Best AMCs for Lump Sum (Debt/Hybrid/Index)</h2>
    <div class="picks-grid">
        ${lumpPicksHTML}
    </div>
</section>

<section class="calc-cta">
    <div class="calc-cta-box">
        <h3>Calculate Your SIP Returns</h3>
        <p>Know your exact future value, total investment, and wealth gained with our free SIP calculator.</p>
        <a href="/" class="calc-cta-btn">Open SIP Calculator \u2192</a>
    </div>
</section>`;
  }

  // --- Internal links ---
  const otherAffiliateLinks = affiliateData.pages
    .filter(p => p.slug !== slug)
    .map(p => ({
      href: `/${p.slug}`,
      label: p.heroTitle,
      sub: '',
    }));

  const categoryLinks = Object.keys(CATEGORIES).map(c => ({
    href: `/${c}-sip-calculator`,
    label: `${CATEGORIES[c].label} SIP Calculator`,
  }));

  const links =
    linksGridHTML('More Comparisons', otherAffiliateLinks) +
    linksGridHTML('SIP Calculators', categoryLinks);

  // --- FAQ ---
  const faqItems = faqs.map(f => `
    <div class="faq-item">
        <h3>${f.q}</h3>
        <p>${f.a}</p>
    </div>`).join('');

  const faqSection = `
<section class="faq-section">
    <h2>Frequently Asked Questions</h2>
    ${faqItems}
</section>`;

  // --- Disclaimer ---
  const disclaimer = `
<div class="disclaimer">
    <div class="disclaimer-box">
        <strong>Disclaimer:</strong> Mutual fund investments are subject to market risks. Read all scheme-related documents carefully before investing. The returns shown on this page are based on historical data and are for reference only. Actual returns may vary based on market conditions and fund performance. We may earn a referral commission when you invest through links on this page, at no extra cost to you. This does not affect our rankings or recommendations. Last verified: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}.
    </div>
</div>`;

  const html = buildAffiliatePage({
    title,
    description,
    keywords,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: heroTitle },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection,
    linksSection: links,
    disclaimer,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// ─── Sitemap & robots.txt ────────────────────────────────────────────────────

function generateSitemap() {
  const urls = [
    { loc: '', priority: '1.0', changefreq: 'weekly' },
    { loc: 'privacy', priority: '0.3', changefreq: 'yearly' },
    ...allPages.map(p => ({ loc: p, priority: p.includes('-for-') ? '0.6' : '0.8', changefreq: 'monthly' })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${DOMAIN}/${u.loc}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
}

function generateRobotsTxt() {
  const txt = `User-agent: *
Allow: /
Sitemap: ${DOMAIN}/sitemap.xml
`;
  fs.writeFileSync(path.join(DIST, 'robots.txt'), txt);
}

// ─── Build ───────────────────────────────────────────────────────────────────

console.log('\uD83D\uDD28 SIP Batao \u2014 Programmatic SEO Build');
console.log('=====================================\n');

// Clean & create dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
ensureDir(DIST);

// Copy static files
console.log('\uD83D\uDCC4 Copying static files...');
['index.html', 'privacy.html', 'ads.txt'].forEach(f => {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, f));
  }
});

// Generate category index pages
console.log('\uD83D\uDCD1 Generating category index pages...');
Object.keys(CATEGORIES).forEach(cat => generateCategoryIndexPage(cat));
console.log(`   \u2192 ${Object.keys(CATEGORIES).length} category index pages`);

// Generate AMC index pages
console.log('\uD83C\uDFE6 Generating AMC index pages...');
amcs.forEach(amc => generateAmcIndexPage(amc));
console.log(`   \u2192 ${amcs.length} AMC index pages`);

// Generate AMC + category pages
console.log('\uD83D\uDCCA Generating AMC+category pages...');
let amcCatCount = 0;
amcs.forEach(amc => {
  Object.keys(CATEGORIES).forEach(cat => {
    if (amc.categories[cat]) {
      generateAmcCategoryPage(amc, cat);
      amcCatCount++;
    }
  });
});
console.log(`   \u2192 ${amcCatCount} AMC+category pages`);

// Generate general amount pages
console.log('\uD83D\uDCB0 Generating general amount pages...');
SIP_AMOUNTS.forEach(amt => generateGeneralAmountPage(amt));
console.log(`   \u2192 ${SIP_AMOUNTS.length} general amount pages`);

// Generate category + amount pages
console.log('\uD83D\uDCB0 Generating category+amount pages...');
let catAmountCount = 0;
Object.keys(CATEGORIES).forEach(cat => {
  SIP_AMOUNTS.forEach(amt => {
    generateCategoryAmountPage(cat, amt);
    catAmountCount++;
  });
});
console.log(`   \u2192 ${catAmountCount} category+amount pages`);

// Generate AMC + category + amount pages
console.log('\uD83C\uDFE6\uD83D\uDCB0 Generating AMC+category+amount pages...');
let amcCatAmountCount = 0;
amcs.forEach(amc => {
  Object.keys(CATEGORIES).forEach(cat => {
    if (amc.categories[cat]) {
      SIP_AMOUNTS.forEach(amt => {
        generateAmcCategoryAmountPage(amc, cat, amt);
        amcCatAmountCount++;
      });
    }
  });
});
console.log(`   \u2192 ${amcCatAmountCount} AMC+category+amount pages`);

// Generate affiliate comparison pages
console.log('\uD83D\uDD17 Generating affiliate comparison pages...');
affiliateData.pages.forEach(page => generateAffiliatePage(page));
console.log(`   \u2192 ${affiliateData.pages.length} affiliate pages`);

// Generate sitemap and robots.txt
console.log('\uD83D\uDDFA\uFE0F  Generating sitemap.xml and robots.txt...');
generateSitemap();
generateRobotsTxt();

// Summary
console.log(`\n\u2705 Build complete!`);
console.log(`   Total pages: ${allPages.length} generated + 3 static = ${allPages.length + 3}`);
console.log(`   Sitemap entries: ${allPages.length + 2}`);
console.log(`   Output: ${DIST}`);
