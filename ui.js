/* =========================================================
   CAPITA — UI Rendering Module
   Handles all DOM updates and rendering
   ========================================================= */

const UI = {
  charts: {},
  cashFlowMode: "combined",

  categoryEmoji: {
    food: "🍔",
    bills: "💡",
    shopping: "🛍️",
    transport: "🚗",
    entertainment: "🎮",
    health: "🏥",
    salary: "💼",
    transfer: "🔄",
    other: "📍",
  },

  categoryColor: {
    food: "#FF6B6B",
    bills: "#4ECDC4",
    shopping: "#FFE66D",
    transport: "#95E1D3",
    entertainment: "#C7CEEA",
    health: "#FF85A1",
    salary: "#34D399",
    transfer: "#60A5FA",
    other: "#A78BFA",
  },

  formatMoney(amount) {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: Data.currency,
    });
    return formatter.format(amount);
  },

  updateStats() {
    const stats = Data.getStats();
    document.getElementById("totalIncome").textContent = this.formatMoney(stats.income);
    document.getElementById("totalExpenses").textContent = this.formatMoney(stats.expenses);
    document.getElementById("netBalance").textContent = this.formatMoney(stats.net);
    document.getElementById("txCount").textContent = stats.count;

    const netElement = document.getElementById("netBalance");
    if (stats.net < 0) {
      netElement.style.color = "var(--danger)";
    } else {
      netElement.style.color = "var(--success)";
    }
  },

  renderTable(txs = Data.getAll()) {
    const tbody = document.getElementById("txTableBody");
    const emptyMsg = document.getElementById("emptyMessage");
    tbody.innerHTML = "";

    if (txs.length === 0) {
      emptyMsg.hidden = false;
      return;
    }

    emptyMsg.hidden = true;
    txs.forEach((tx, idx) => {
      const row = document.createElement("tr");
      row.style.animationDelay = idx * 0.05 + "s";
      row.innerHTML = `
        <td>${tx.date}</td>
        <td>${this.escapeHtml(tx.desc)}</td>
        <td>
          <span class="cat-tag">${this.categoryEmoji[tx.category]} ${tx.category}</span>
        </td>
        <td class="right" style="color: ${tx.type === "income" ? "var(--success)" : "var(--text-primary)"}">
          ${tx.type === "income" ? "+" : "-"}${this.formatMoney(tx.amount)}
        </td>
        <td class="center">
          <button class="edit-btn" data-id="${tx.id}" title="Edit transaction">✎</button>
          <button class="del-btn" data-id="${tx.id}" title="Delete">🗑</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  },

  renderChart(mode = "pie") {
    const data = Data.getCategoryTotals();
    const canvas = document.getElementById("mainChart");
    const empty = document.getElementById("chartEmpty");

    if (data.length === 0) {
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    if (this.charts.main) {
      this.charts.main.destroy();
    }

    const labels = data.map(d => this.categoryEmoji[d.category] + " " + d.category);
    const amounts = data.map(d => d.amount);
    const colors = data.map(d => this.categoryColor[d.category]);

    const ctx = canvas.getContext("2d");
    const chartConfig = {
      type: mode === "pie" ? "pie" : mode === "doughnut" ? "doughnut" : "bar",
      data: {
        labels: labels,
        datasets: [{
          data: amounts,
          backgroundColor: colors,
          borderColor: "var(--surface)",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => this.formatMoney(ctx.parsed.y || ctx.parsed),
            },
          },
        },
        ...(mode === "bar" && {
          indexAxis: "y",
          scales: {
            x: { ticks: { callback: (v) => this.formatMoney(v) } },
          },
        }),
        ...(mode === "doughnut" && { cutout: "65%" }),
      },
    };

    this.charts.main = new Chart(ctx, chartConfig);
  },

  renderCashFlowChart(mode = "combined", weeks = 18, granularity = "weekly") {
    const canvas = document.getElementById("cashFlowChart");
    const empty = document.getElementById("cashFlowEmpty");
    if (!canvas) return;

    const horizon = Math.max(1, Math.min(18, Number(weeks) || 18));
    const plannedBase = [4200, 4600, 5100, 5400, 5900, 6100, 6500, 6900, 7300, 7600, 7900, 8200, 8500, 8800, 9100, 9400, 9800, 10200];
    const earnedBase =  [3900, 4700, 4850, 5600, 5400, 6300, 6700, 6500, 7500, 7800, 7600, 8500, 8300, 9000, 8850, 9600, 9400, 10100];
    const weeklyPlanned = plannedBase.slice(0, horizon);
    const live = Data.getWeeklyCashFlow(horizon);
    const hasLiveData = live.income.some(v => v > 0) || live.expenses.some(v => v > 0);
    // "Earned Value" becomes the user's actual net cash flow when transactions exist.
    // The original planning baseline remains available when the account has no recent data.
    const weeklyEarned = hasLiveData ? live.net : earnedBase.slice(0, horizon);

    let labels;
    let planned;
    let earned;
    if (granularity === "monthly") {
      const groups = [];
      for (let i = 0; i < weeklyPlanned.length; i += 4) {
        groups.push({
          planned: weeklyPlanned.slice(i, i + 4).reduce((a, b) => a + b, 0),
          earned: weeklyEarned.slice(i, i + 4).reduce((a, b) => a + b, 0),
        });
      }
      labels = groups.map((_, i) => `M${i + 1}`);
      planned = groups.map(g => g.planned);
      earned = groups.map(g => g.earned);
    } else {
      labels = weeklyPlanned.map((_, i) => `W${i + 1}`);
      planned = weeklyPlanned;
      earned = weeklyEarned;
    }

    const cumulativePlanned = planned.map((_, i) => planned.slice(0, i + 1).reduce((a, b) => a + b, 0));
    const cumulativeEarned = earned.map((_, i) => earned.slice(0, i + 1).reduce((a, b) => a + b, 0));

    if (!planned.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    if (this.charts.cashFlow) this.charts.cashFlow.destroy();

    const showBars = mode !== "lines";
    const showLines = mode !== "bars";
    const ctx = canvas.getContext("2d");
    this.charts.cashFlow = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Planned Value",
            data: planned,
            backgroundColor: "rgba(167, 139, 250, 0.62)",
            borderColor: "#a78bfa",
            borderWidth: 1,
            borderRadius: 6,
            hidden: !showBars,
            order: 2,
          },
          {
            type: "bar",
            label: "Earned Value",
            data: earned,
            backgroundColor: "rgba(94, 234, 212, 0.55)",
            borderColor: "#5eead4",
            borderWidth: 1,
            borderRadius: 6,
            hidden: !showBars,
            order: 2,
          },
          {
            type: "line",
            label: "Cumulative Planned",
            data: cumulativePlanned,
            borderColor: "#c4b5fd",
            backgroundColor: "rgba(196, 181, 253, 0.05)",
            pointBackgroundColor: "#c4b5fd",
            pointBorderColor: "#c4b5fd",
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            hidden: !showLines,
            yAxisID: "y1",
            order: 1,
          },
          {
            type: "line",
            label: "Cumulative Earned",
            data: cumulativeEarned,
            borderColor: "#f9a8d4",
            backgroundColor: "rgba(249, 168, 212, 0.05)",
            pointBackgroundColor: "#f9a8d4",
            pointBorderColor: "#f9a8d4",
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 3,
            borderDash: [7, 5],
            tension: 0.3,
            fill: false,
            hidden: !showLines,
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const index = items?.[0]?.dataIndex ?? 0;
                return granularity === "monthly" ? `Month ${index + 1} · ${Math.min(4, horizon - index * 4)} week window` : `Week ${index + 1}`;
              },
              label: (ctx) => `${ctx.dataset.label}: ${this.formatMoney(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#a9a0c2" },
            title: { display: true, text: granularity === "monthly" ? "4-week periods across selected horizon" : "18-week planning horizon", color: "#a9a0c2" },
          },
          y: {
            beginAtZero: true,
            position: "left",
            ticks: { color: "#a9a0c2", callback: (v) => this.formatMoney(v) },
            grid: { color: "rgba(167,139,250,.10)" },
            title: { display: true, text: granularity === "monthly" ? "Period Value" : "Weekly Value", color: "#a9a0c2" },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { color: "#c4b5fd", callback: (v) => this.formatMoney(v) },
            title: { display: true, text: "Cumulative", color: "#c4b5fd" },
          },
        },
      },
    });
  },

  renderCategoryStats() {
    const data = Data.getCategoryTotals();
    const container = document.getElementById("categoryStats");
    container.innerHTML = data.map(d => `
      <div class="category-item">
        <span class="category-name">
          <span class="cat-emoji">${this.categoryEmoji[d.category]}</span>
          <span>${d.category}</span>
        </span>
        <span class="category-amount">${this.formatMoney(d.amount)}</span>
      </div>
    `).join("");
  },

  renderTopTransactions() {
    const txs = Data.getTopTransactions(5);
    const container = document.getElementById("topTransactions");
    container.innerHTML = txs.map(t => `
      <div class="top-item">
        <span class="top-name">
          <span class="cat-emoji">${this.categoryEmoji[t.category]}</span>
          <span>${this.escapeHtml(t.desc)}</span>
        </span>
        <span class="top-amount" style="color: ${t.type === "income" ? "var(--success)" : "var(--text-primary)"}">
          ${t.type === "income" ? "+" : "-"}${this.formatMoney(t.amount)}
        </span>
      </div>
    `).join("");
  },

  updateAll() {
    this.updateStats();
    this.renderTable();
    const mode = document.querySelector(".chart-mode-btn.active")?.dataset.mode || "pie";
    this.renderChart(mode);
    this.renderCategoryStats();
    this.renderTopTransactions();
    if (this.charts.cashFlow) {
      this.renderCashFlowChart(
        this.cashFlowMode || "combined",
        parseInt(document.getElementById("cashFlowWeeks")?.value || "18", 10),
        document.getElementById("cashFlowGranularity")?.value || "weekly"
      );
    }
  },

  updateAnalytics() {
    this.renderCashFlowChart(
      this.cashFlowMode || "combined",
      parseInt(document.getElementById("cashFlowWeeks")?.value || "18", 10),
      document.getElementById("cashFlowGranularity")?.value || "weekly"
    );
    this.renderCategoryStats();
    this.renderTopTransactions();
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  showNotification(message, type = "success") {
    const notif = document.createElement("div");
    notif.className = `notification notification-${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  },
};

// Add notification styles if not present
if (!document.getElementById("notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: var(--success);
      color: white;
      z-index: 9999;
      animation: notifSlide 0.3s ease;
    }
    .notification-success { background: var(--success); }
    .notification-error { background: var(--danger); }
    .notification-warning { background: var(--warning); }
    @keyframes notifSlide {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
