(function () {
  'use strict';

  const COMPARISON_MONTHS = 12;
  const MAX_PAYOFF_MONTHS = 30 * 12; // 30 years

  function formatCurrency(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function formatInteger(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
  }

  function formatYearsMonths(months) {
    if (typeof months !== 'number' || !Number.isFinite(months)) return '—';
    const totalMonths = Math.max(0, Math.round(months));
    const years = Math.floor(totalMonths / 12);
    const rem = totalMonths % 12;
    const parts = [];
    if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
    if (rem > 0 || parts.length === 0) parts.push(`${rem} month${rem === 1 ? '' : 's'}`);
    return parts.join(' ');
  }
  function formatMaybeCurrency(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return formatCurrency(n);
  }

  function monthlyRate(annualRate) {
    return annualRate / 1200;
  }

  /**
   * Amortize with fixed monthly payment until balance <= 0.
   * Used for Schedule 1 (before refinance) and Schedule 3 (after refinance, same payment).
   * @returns {{ schedule: Array<{month, payment, principal, interest, balance}>, totalPayment: number, totalInterest: number, months: number } | { error: string }}
   */
  function amortizeWithPayment(principal, annualRate, monthlyPayment) {
    const r = monthlyRate(annualRate);
    if (r < 0) return { error: 'Invalid rate' };
    const firstInterest = principal * r;
    if (monthlyPayment <= firstInterest) {
      return { error: 'Monthly payment does not cover interest; loan would never be paid off. Increase payment or check rate.' };
    }

    const schedule = [];
    let balance = principal;
    let totalPayment = 0;
    let month = 0;

    while (balance > 0.005) {
      month += 1;
      const interest = balance * r;
      let principalPaid = monthlyPayment - interest;
      if (principalPaid > balance) principalPaid = balance;
      balance -= principalPaid;
      if (balance < 0) balance = 0;
      const payment = principalPaid + interest;
      totalPayment += payment;
      schedule.push({
        month,
        payment,
        principal: principalPaid,
        interest,
        balance
      });
    }

    if (month > MAX_PAYOFF_MONTHS) {
      return { error: 'Payoff time would exceed 30 years. Increase monthly payment or check inputs.' };
    }

    const totalInterest = totalPayment - principal;
    return { schedule, totalPayment, totalInterest, months: month };
  }

  function renderBarRow(label, pct, valueText, kind) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const safePct = Math.max(0, Math.min(100, pct));
    row.innerHTML =
      `<div class="bar-label">${label}</div>` +
      `<div class="bar-track"><div class="bar-fill ${kind}" style="width:${safePct}%;"></div></div>` +
      `<div class="bar-value">${valueText}</div>`;
    return row;
  }

  function renderBarRowStacked(label, segments, valueText) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const fills = segments.map(s => `<div class="bar-fill ${s.kind}" style="width:${s.pct}%;"></div>`).join('');
    row.innerHTML =
      `<div class="bar-label">${label}</div>` +
      `<div class="bar-track bar-track-stacked">${fills}</div>` +
      `<div class="bar-value">${valueText}</div>`;
    return row;
  }

  function renderMetric(container, title, beforeVal, afterVal, formatter) {
    const metric = document.createElement('div');
    metric.className = 'metric';

    const b = Number.isFinite(beforeVal) ? beforeVal : 0;
    const a = Number.isFinite(afterVal) ? afterVal : 0;
    const max = Math.max(b, a, 0);
    const beforePct = max > 0 ? (b / max) * 100 : 0;
    const afterPct = max > 0 ? (a / max) * 100 : 0;

    const left = document.createElement('div');
    left.className = 'metric-title';
    left.textContent = title;

    const bars = document.createElement('div');
    bars.className = 'metric-bars';
    bars.appendChild(renderBarRow('Before', beforePct, formatter(beforeVal), 'before'));
    bars.appendChild(renderBarRow('After', afterPct, formatter(afterVal), 'after'));

    metric.appendChild(left);
    metric.appendChild(bars);
    container.appendChild(metric);
  }

  function renderTotalPaymentMetric(container, beforeTotal, afterTotal, refiCost) {
    const metric = document.createElement('div');
    metric.className = 'metric';

    const b = Number.isFinite(beforeTotal) ? beforeTotal : 0;
    const afterPayment = Number.isFinite(afterTotal) ? afterTotal : 0;
    const cost = Number.isFinite(refiCost) && refiCost >= 0 ? refiCost : 0;
    const totalAfter = afterPayment + cost;
    const max = Math.max(b, totalAfter, 0);

    const beforePct = max > 0 ? (b / max) * 100 : 0;
    const afterPaymentPct = max > 0 ? (afterPayment / max) * 100 : 0;
    const refiCostPct = max > 0 ? (cost / max) * 100 : 0;

    const left = document.createElement('div');
    left.className = 'metric-title';
    left.textContent = 'Total payment';
    if (cost > 0) {
      const hint = document.createElement('div');
      hint.className = 'metric-hint';
      hint.textContent = 'Orange = refinance cost';
      left.appendChild(hint);
    }

    const bars = document.createElement('div');
    bars.className = 'metric-bars';
    bars.appendChild(renderBarRow('Before', beforePct, formatCurrency(beforeTotal), 'before'));
    if (cost > 0) {
      bars.appendChild(renderBarRowStacked('After', [
        { kind: 'after', pct: afterPaymentPct },
        { kind: 'refi-cost', pct: refiCostPct }
      ], formatCurrency(totalAfter)));
    } else {
      bars.appendChild(renderBarRow('After', totalAfter > 0 ? (totalAfter / max) * 100 : 0, formatCurrency(totalAfter), 'after'));
    }

    metric.appendChild(left);
    metric.appendChild(bars);
    container.appendChild(metric);
  }

  function renderComparisonBars(beforeRes, afterRes, refiCost) {
    const container = document.getElementById('comparison-bars');
    container.innerHTML = '';

    renderTotalPaymentMetric(container, beforeRes.totalPayment, afterRes.totalPayment, refiCost);
    renderMetric(container, 'Total interest', beforeRes.totalInterest, afterRes.totalInterest, formatCurrency);
    renderMetric(container, 'Time to payoff', beforeRes.months, afterRes.months, formatYearsMonths);
    renderMetric(
      container,
      'First month interest',
      beforeRes.schedule?.[0]?.interest,
      afterRes.schedule?.[0]?.interest,
      formatMaybeCurrency
    );
  }

  function renderFirst12ComparisonTable(beforeRes, afterRes) {
    const metaEl = document.getElementById('comparison-table-meta');
    const tbody = document.getElementById('comparison-table-body');
    tbody.innerHTML = '';

    if (beforeRes.error || afterRes.error) {
      metaEl.textContent = [beforeRes.error, afterRes.error].filter(Boolean).join(' ');
      return;
    }

    metaEl.textContent = `Showing months 1–${COMPARISON_MONTHS}. (Payment is the same before and after; we show it once. Before uses current rate; After uses refinance rate.)`;

    const b = beforeRes.schedule;
    const a = afterRes.schedule;

    for (let m = 1; m <= COMPARISON_MONTHS; m += 1) {
      const br = b[m - 1] || null;
      const ar = a[m - 1] || null;

      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${m}</td>` +
        `<td>${formatMaybeCurrency(br?.payment ?? ar?.payment)}</td>` +
        `<td>${formatMaybeCurrency(br?.principal)}</td>` +
        `<td>${formatMaybeCurrency(ar?.principal)}</td>` +
        `<td>${formatMaybeCurrency(br?.interest)}</td>` +
        `<td>${formatMaybeCurrency(ar?.interest)}</td>` +
        `<td>${formatMaybeCurrency(br?.balance)}</td>` +
        `<td>${formatMaybeCurrency(ar?.balance)}</td>`;
      tbody.appendChild(tr);
    }
  }

  function showError(msg) {
    const el = document.getElementById('error-message');
    el.textContent = msg;
    el.hidden = false;
    document.getElementById('comparison-section').hidden = true;
    document.getElementById('comparison-table-section').hidden = true;
  }

  function hideError() {
    document.getElementById('error-message').hidden = true;
  }

  function runComparison() {
    const principal = Number(document.getElementById('principal').value);
    const currentPayment = Number(document.getElementById('current-payment').value);
    const currentRate = Number(document.getElementById('current-rate').value);
    const refiRate = Number(document.getElementById('refi-rate').value);
    const refiCost = Number(document.getElementById('refi-cost').value) || 0;

    if (principal <= 0 || currentPayment <= 0) {
      showError('Remaining balance and current monthly payment must be positive.');
      return;
    }
    if (currentRate < 0 || refiRate < 0) {
      showError('Interest rates must be non-negative.');
      return;
    }
    if (refiCost < 0) {
      showError('Refinance cost cannot be negative.');
      return;
    }

    hideError();

    const beforeRes = amortizeWithPayment(principal, currentRate, currentPayment);
    const afterRes = amortizeWithPayment(principal, refiRate, currentPayment);

    if (beforeRes.error || afterRes.error) {
      showError([beforeRes.error, afterRes.error].filter(Boolean).join(' '));
      return;
    }

    document.getElementById('comparison-section').hidden = false;
    document.getElementById('comparison-table-section').hidden = false;
    document.getElementById('balance-chart-section').hidden = false;

    const breakEvenMonth = refiCost > 0 ? getBreakEvenMonth(beforeRes, afterRes, refiCost) : null;

    const breakEvenEl = document.getElementById('break-even-summary');
    if (breakEvenMonth != null) {
      breakEvenEl.textContent = `Refinance cost break-even at month ${breakEvenMonth} (cumulative interest savings cover the refinance cost).`;
      breakEvenEl.hidden = false;
    } else {
      breakEvenEl.hidden = true;
    }

    renderComparisonBars(beforeRes, afterRes, refiCost);
    renderFirst12ComparisonTable(beforeRes, afterRes);
    renderBalanceChart(beforeRes, afterRes, principal, breakEvenMonth);
  }

  /**
   * First month (1-based) when cumulative interest savings (before - after) >= refiCost, or null if never.
   */
  function getBreakEvenMonth(beforeRes, afterRes, refiCost) {
    if (!beforeRes.schedule || !afterRes.schedule || refiCost <= 0) return null;
    let cumulative = 0;
    const maxMonths = Math.max(beforeRes.schedule.length, afterRes.schedule.length);
    for (let m = 0; m < maxMonths; m += 1) {
      const interestBefore = beforeRes.schedule[m] ? beforeRes.schedule[m].interest : 0;
      const interestAfter = afterRes.schedule[m] ? afterRes.schedule[m].interest : 0;
      cumulative += interestBefore - interestAfter;
      if (cumulative >= refiCost) return m + 1;
    }
    return null;
  }

  function renderBalanceChart(beforeRes, afterRes, principal, breakEvenMonth) {
    const container = document.getElementById('balance-chart-container');
    container.innerHTML = '';

    if (beforeRes.error || afterRes.error) return;

    const months = Math.max(beforeRes.months || 0, afterRes.months || 0);
    if (months === 0) return;

    const points = months + 1; // include month 0
    const balancesBefore = [];
    const balancesAfter = [];

    for (let m = 0; m <= months; m += 1) {
      if (m === 0) {
        balancesBefore.push(principal);
        balancesAfter.push(principal);
      } else {
        const br = beforeRes.schedule[m - 1];
        const ar = afterRes.schedule[m - 1];
        balancesBefore.push(br ? br.balance : 0);
        balancesAfter.push(ar ? ar.balance : 0);
      }
    }

    const maxBalance = principal || Math.max(...balancesBefore, ...balancesAfter);
    if (!Number.isFinite(maxBalance) || maxBalance <= 0) return;

    const width = 640;
    const height = 260;
    const padding = { top: 16, right: 16, bottom: 32, left: 56 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '260');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${padding.left},${padding.top})`);

    const scaleX = (i) => (i / (points - 1 || 1)) * chartWidth;
    const scaleY = (v) => chartHeight - (v / maxBalance) * chartHeight;

    const makePath = (data, color) => {
      const d = data
        .map((val, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(val)}`)
        .join(' ');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', '2');
      return p;
    };

    const axisY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisY.setAttribute('x1', 0);
    axisY.setAttribute('y1', 0);
    axisY.setAttribute('x2', 0);
    axisY.setAttribute('y2', chartHeight);
    axisY.setAttribute('stroke', '#444');
    axisY.setAttribute('stroke-width', '1');
    g.appendChild(axisY);

    const axisX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisX.setAttribute('x1', 0);
    axisX.setAttribute('y1', chartHeight);
    axisX.setAttribute('x2', chartWidth);
    axisX.setAttribute('y2', chartHeight);
    axisX.setAttribute('stroke', '#444');
    axisX.setAttribute('stroke-width', '1');
    g.appendChild(axisX);

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i += 1) {
      const val = (maxBalance * i) / yTicks;
      const y = scaleY(val);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', -4);
      tick.setAttribute('y1', y);
      tick.setAttribute('x2', 0);
      tick.setAttribute('y2', y);
      tick.setAttribute('stroke', '#444');
      tick.setAttribute('stroke-width', '1');
      g.appendChild(tick);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', -8);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '10');
      label.textContent = formatCurrency(val);
      g.appendChild(label);
    }

    const xTicks = Math.min(10, months);
    for (let i = 0; i <= xTicks; i += 1) {
      const monthVal = Math.round((months * i) / xTicks);
      const x = scaleX((points - 1) * (i / (xTicks || 1)));
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x);
      tick.setAttribute('y1', chartHeight);
      tick.setAttribute('x2', x);
      tick.setAttribute('y2', chartHeight + 4);
      tick.setAttribute('stroke', '#444');
      tick.setAttribute('stroke-width', '1');
      g.appendChild(tick);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', chartHeight + 16);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.textContent = monthVal.toString();
      g.appendChild(label);
    }

    g.appendChild(makePath(balancesBefore, '#2980b9'));
    g.appendChild(makePath(balancesAfter, '#27ae60'));

    if (breakEvenMonth != null && breakEvenMonth >= 1 && breakEvenMonth <= months) {
      const x = scaleX(breakEvenMonth);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', chartHeight);
      line.setAttribute('stroke', '#c0392b');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4,4');
      g.appendChild(line);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', -6);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#c0392b');
      label.textContent = `Break-even (month ${breakEvenMonth})`;
      g.appendChild(label);
    }

    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legend.setAttribute('transform', `translate(${chartWidth - 150}, 4)`);
    [
      { color: '#2980b9', label: 'Before refinance' },
      { color: '#27ae60', label: 'After refinance' }
    ].forEach((item, idx) => {
      const y = idx * 18;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y);
      line.setAttribute('x2', 18);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', item.color);
      line.setAttribute('stroke-width', '2');
      legend.appendChild(line);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', 24);
      text.setAttribute('y', y + 4);
      text.setAttribute('font-size', '11');
      text.textContent = item.label;
      legend.appendChild(text);
    });
    g.appendChild(legend);

    svg.appendChild(g);
    container.appendChild(svg);
  }

  document.getElementById('loan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    runComparison();
  });
})();
