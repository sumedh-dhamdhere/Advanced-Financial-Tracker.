/* =========================================================
   CAPITA — Main Application Logic
   Handles user interactions and app flow
   ========================================================= */

const App = {
  currentView: "dashboard",

  init() {
    this.setupTheme();
    this.setupHomeLogo();
    this.setupTopbarTools();
    this.setupInteractions();
    this.setupNavigation();
    this.setupForm();
    this.setupTransactions();
    this.setupTransactionTransfer();
    this.setupAnalytics();
    this.setupCurrencyCalculator();
    this.setupSettings();
    UI.updateAll();
  },


  setupHomeLogo() {
    const refreshHome = () => {
      window.location.reload();
    };
    document.getElementById("logoHome")?.addEventListener("click", refreshHome);
    document.getElementById("topbarHome")?.addEventListener("click", refreshHome);
  },

  setupTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
  },

  setupInteractions() {
    // Premium cursor: subtle ring + dot that follows the pointer.
    const dot = document.querySelector(".cursor-dot");
    const ring = document.querySelector(".cursor-ring");
    if (dot && ring && window.matchMedia("(pointer:fine)").matches) {
      let mouseX = -100, mouseY = -100;
      let ringX = mouseX, ringY = mouseY;

      const moveCursor = (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        dot.style.left = mouseX + "px";
        dot.style.top = mouseY + "px";
        document.body.classList.add("cursor-ready");
      };
      const animateRing = () => {
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        ring.style.left = ringX + "px";
        ring.style.top = ringY + "px";
        requestAnimationFrame(animateRing);
      };
      document.addEventListener("mousemove", moveCursor);
      animateRing();

      document.addEventListener("mouseover", (e) => {
        if (e.target.closest("button, input, select, a, .card")) {
          document.body.classList.add("cursor-hover");
        }
      });
      document.addEventListener("mouseout", (e) => {
        if (e.target.closest("button, input, select, a, .card")) {
          document.body.classList.remove("cursor-hover");
        }
      });
    }

    // Ripple feedback for clickable controls.
    document.addEventListener("click", (e) => {
      const target = e.target.closest("button, .btn");
      if (!target || target.disabled) return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = (e.clientX - rect.left) + "px";
      ripple.style.top = (e.clientY - rect.top) + "px";
      target.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  },

  setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const views = document.querySelectorAll(".view");
    let isTransitioning = false;

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        const viewName = link.dataset.view;
        if (isTransitioning || viewName === this.currentView) return;

        const currentView = document.getElementById(this.currentView + "View");
        const nextView = document.getElementById(viewName + "View");
        if (!nextView) return;

        isTransitioning = true;

        // Update nav immediately.
        navLinks.forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        // Slide the current dashboard out, then slide the selected view in.
        const direction = [...views].indexOf(nextView) > [...views].indexOf(currentView) ? "left" : "right";
        views.forEach(v => {
          v.classList.remove("slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
        });

        currentView.classList.add("active", `slide-out-${direction}`);
        nextView.classList.add("active", `slide-in-${direction}`);

        setTimeout(() => {
          currentView.classList.remove("active", `slide-out-${direction}`);
          nextView.classList.remove(`slide-in-${direction}`);
          this.currentView = viewName;
          isTransitioning = false;

          if (viewName === "analytics") {
            UI.updateAnalytics();
          } else if (viewName === "dashboard") {
            UI.updateAll();
          }
        }, 450);
      });
    });
  },

  setupForm() {
    const quickDate = document.getElementById("quickDate");
    if (quickDate) quickDate.value = new Date().toISOString().split("T")[0];
    const form = document.getElementById("quickForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const desc = document.getElementById("quickDesc").value.trim();
      const amount = parseFloat(document.getElementById("quickAmount").value);
      const category = document.getElementById("quickCategory").value;
      const type = document.getElementById("quickType").value;
      const date = document.getElementById("quickDate").value || new Date().toISOString().split("T")[0];

      if (!desc || !amount || amount <= 0) {
        UI.showNotification("Please fill all fields", "error");
        return;
      }

      Data.add(desc, amount, category, type, date);
      UI.updateAll();
      UI.showNotification("Transaction added!", "success");

      form.reset();
    });

    // Chart mode buttons
    const chartModes = document.getElementById("chartModes");
    chartModes.addEventListener("click", (e) => {
      const btn = e.target.closest(".chart-mode-btn");
      if (!btn) return;

      chartModes.querySelectorAll(".chart-mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const mode = btn.dataset.mode;
      UI.renderChart(mode);
    });
  },

  setupTransactions() {
    const searchInput = document.getElementById("txSearch");
    const dateFrom = document.getElementById("txDateFrom");
    const dateTo = document.getElementById("txDateTo");
    const filterBtns = document.querySelectorAll(".filter-btn");

    const updateFiltered = () => {
      const filtered = Data.filter({
        search: searchInput.value,
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
        type: this.currentFilterType,
      });
      UI.renderTable(filtered);
    };

    searchInput.addEventListener("input", updateFiltered);
    dateFrom.addEventListener("change", updateFiltered);
    dateTo.addEventListener("change", updateFiltered);

    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentFilterType = btn.dataset.filter === "all" ? null : btn.dataset.filter;
        updateFiltered();
      });
    });

    this.currentFilterType = null;
  },

  setupTransactionTransfer() {
    const download = (content, filename, type) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 800);
    };

    const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    document.getElementById("downloadTransactionsJson")?.addEventListener("click", () => {
      download(Data.export(), `capita-transactions-${stamp()}.json`, "application/json");
      UI.showNotification("Transactions downloaded as JSON", "success");
    });

    document.getElementById("downloadTransactionsXls")?.addEventListener("click", () => {
      download(Data.exportXLS(), `capita-transactions-${stamp()}.xls`, "application/vnd.ms-excel");
      UI.showNotification("Transactions downloaded as XLS", "success");
    });

    document.getElementById("downloadTransactionsPdf")?.addEventListener("click", () => {
      download(Data.exportPDF(), `capita-transactions-${stamp()}.pdf`, "application/pdf");
      UI.showNotification("Transactions downloaded as PDF", "success");
    });

    document.getElementById("downloadTransactionsCsv")?.addEventListener("click", () => {
      download(Data.exportCSV(), `capita-transactions-${stamp()}.csv`, "text/csv;charset=utf-8");
      UI.showNotification("Transactions downloaded as CSV", "success");
    });

    const input = document.getElementById("transactionUploadFile");
    const choose = document.getElementById("uploadTransactionsBtn");
    const name = document.getElementById("transactionUploadName");
    choose?.addEventListener("click", () => input?.click());
    input?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      name.textContent = `Selected: ${file.name}`;
      try {
        const lower = file.name.toLowerCase();
        let imported = false;
        if (lower.endsWith(".csv")) {
          imported = Data.importCSV(await file.text());
        } else if (lower.endsWith(".xls")) {
          imported = Data.importXLS(await file.text());
        } else if (lower.endsWith(".pdf")) {
          imported = Data.importPDF(await file.arrayBuffer());
        } else {
          imported = Data.import(await file.text());
        }
        if (!imported) throw new Error(lower.endsWith(".pdf") ? "Only Capita-generated transaction PDFs can be imported." : "The file format or transaction rows are invalid.");
        UI.updateAll();
        this.addNotification(`Imported ${file.name}`);
        UI.showNotification(`${file.name} uploaded successfully`, "success");
      } catch (err) {
        UI.showNotification(err.message || "Unable to upload transactions", "error");
      } finally {
        input.value = "";
      }
    });
  },

  addNotification(message) {
    const current = JSON.parse(sessionStorage.getItem("capita_notifications") || "[]");
    current.unshift({ message, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    sessionStorage.setItem("capita_notifications", JSON.stringify(current.slice(0, 8)));
    this.renderNotificationPanel();
  },

  renderNotificationPanel() {
    const list = document.getElementById("notificationList");
    const badge = document.getElementById("notificationBadge");
    if (!list) return;
    const current = JSON.parse(sessionStorage.getItem("capita_notifications") || "[]");
    const base = [
      { message: "Capita is running in Dark Mode.", time: "Now" },
      { message: "Your transaction data stays in browser storage.", time: "Info" },
      ...current
    ].slice(0, 6);
    list.innerHTML = base.map(item => `<div class="notification-item"><span class="notification-dot"></span><div><strong>${UI.escapeHtml(item.message)}</strong><small>${UI.escapeHtml(item.time)}</small></div></div>`).join("");
    if (badge) badge.textContent = Math.min(9, Math.max(3, base.length));
  },

  setupTopbarTools() {
    const panels = {
      search: document.getElementById("topbarSearchPanel"),
      notifications: document.getElementById("topbarNotificationsPanel"),
      profile: document.getElementById("topbarProfilePanel")
    };
    const buttons = {
      search: document.getElementById("topbarSearch"),
      notifications: document.getElementById("topbarNotifications"),
      profile: document.getElementById("topbarProfile")
    };
    const closeAll = () => Object.values(panels).forEach(panel => { if (panel) panel.hidden = true; });
    const toggle = (key) => {
      const panel = panels[key];
      if (!panel) return;
      const wasOpen = !panel.hidden;
      closeAll();
      if (!wasOpen) {
        panel.hidden = false;
        panel.classList.remove("panel-open");
        requestAnimationFrame(() => panel.classList.add("panel-open"));
        if (key === "search") setTimeout(() => document.getElementById("globalSearchInput")?.focus(), 80);
      }
    };
    buttons.search?.addEventListener("click", () => toggle("search"));
    buttons.notifications?.addEventListener("click", () => { this.renderNotificationPanel(); toggle("notifications"); });
    buttons.profile?.addEventListener("click", () => toggle("profile"));
    document.querySelectorAll("[data-close-panel]").forEach(btn => btn.addEventListener("click", closeAll));
    document.addEventListener("click", (e) => {
      if (e.target.closest(".topbar-popover, .topbar-icon")) return;
      closeAll();
    });

    const search = document.getElementById("globalSearchInput");
    const results = document.getElementById("globalSearchResults");
    search?.addEventListener("input", () => {
      const q = search.value.trim();
      if (!q) { results.innerHTML = `<span class="popover-empty">Start typing to search your ledger.</span>`; return; }
      const matches = Data.filter({ search: q }).slice(0, 6);
      if (!matches.length) { results.innerHTML = `<span class="popover-empty">No matching transactions.</span>`; return; }
      results.innerHTML = matches.map(tx => `<button type="button" class="global-search-item" data-search-tx="${tx.id}"><span><strong>${UI.escapeHtml(tx.desc)}</strong><small>${UI.escapeHtml(tx.category)} · ${UI.escapeHtml(tx.date)}</small></span><b class="${tx.type}">${tx.type === "income" ? "+" : "−"}${UI.formatMoney(tx.amount)}</b></button>`).join("");
    });
    results?.addEventListener("click", (e) => {
      const item = e.target.closest("[data-search-tx]");
      if (!item) return;
      const nav = document.querySelector('.nav-link[data-view="transactions"]');
      nav?.click();
      closeAll();
      const txSearch = document.getElementById("txSearch");
      const tx = Data.getAll().find(t => String(t.id) === item.dataset.searchTx);
      if (tx && txSearch) { txSearch.value = tx.desc; txSearch.dispatchEvent(new Event("input")); }
    });
    document.querySelector("[data-profile-settings]")?.addEventListener("click", () => {
      document.querySelector('.nav-link[data-view="settings"]')?.click();
      closeAll();
    });
    this.renderNotificationPanel();
  },

  setupAnalytics() {
    const modeWrap = document.getElementById("cashFlowModes");
    const weekSelect = document.getElementById("cashFlowWeeks");
    const granularitySelect = document.getElementById("cashFlowGranularity");
    if (!modeWrap || !weekSelect || !granularitySelect) return;

    modeWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".cash-flow-mode");
      if (!btn) return;
      modeWrap.querySelectorAll(".cash-flow-mode").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      UI.cashFlowMode = btn.dataset.cashMode || "combined";
      UI.renderCashFlowChart(UI.cashFlowMode, parseInt(weekSelect.value, 10), granularitySelect.value);
    });

    weekSelect.addEventListener("change", () => {
      UI.renderCashFlowChart(UI.cashFlowMode || "combined", parseInt(weekSelect.value, 10), granularitySelect.value);
    });

    granularitySelect.addEventListener("change", () => {
      UI.renderCashFlowChart(UI.cashFlowMode || "combined", parseInt(weekSelect.value, 10), granularitySelect.value);
    });
  },

  setupCurrencyCalculator() {
    const amount = document.getElementById("calcAmount");
    const from = document.getElementById("calcFrom");
    const to = document.getElementById("calcTo");
    const result = document.getElementById("calcResult");
    const rateLabel = document.getElementById("calcRate");
    const convertBtn = document.getElementById("calcConvert");
    const swapBtn = document.getElementById("calcSwap");
    const resetBtn = document.getElementById("calcReset");

    if (!amount || !from || !to || !result || !rateLabel || !convertBtn || !swapBtn) return;

    const ratesToUsd = { USD: 1, EUR: 1.09, GBP: 1.27, INR: 0.01205, JPY: 0.00685 };
    const symbols = { USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥" };

    const calculate = () => {
      const value = Math.max(0, parseFloat(amount.value) || 0);
      const fromCode = from.value;
      const toCode = to.value;
      const usdValue = value * ratesToUsd[fromCode];
      const converted = usdValue / ratesToUsd[toCode];
      const rate = ratesToUsd[fromCode] / ratesToUsd[toCode];

      result.textContent = `${symbols[toCode]}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      rateLabel.textContent = `1 ${fromCode} ≈ ${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toCode}`;
    };

    [amount, from, to].forEach(el => {
      el.addEventListener("input", calculate);
      el.addEventListener("change", calculate);
    });
    convertBtn.addEventListener("click", calculate);
    swapBtn.addEventListener("click", () => {
      const oldFrom = from.value;
      from.value = to.value;
      to.value = oldFrom;
      calculate();
    });

    calculate();

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        amount.value = "100";
        from.value = "USD";
        to.value = "INR";
        calculate();
        UI.showNotification("Calculator reset", "success");
      });
    }
  },

  setupSettings() {
    // Export
    document.getElementById("exportBtn").addEventListener("click", () => {
      const json = Data.export();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capita-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showNotification("Data exported!", "success");
    });

    // Import
    const importFile = document.getElementById("importFile");
    document.getElementById("importBtn").addEventListener("click", () => {
      importFile.click();
    });

    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (Data.import(event.target.result)) {
          UI.updateAll();
          UI.showNotification("Data imported successfully!", "success");
        } else {
          UI.showNotification("Error importing file", "error");
        }
      };
      reader.readAsText(file);
      importFile.value = "";
    });

    // Clear all
    document.getElementById("clearBtn").addEventListener("click", () => {
      if (confirm("Are you sure? This will delete all transactions.")) {
        Data.clearAll();
        UI.updateAll();
        UI.showNotification("All data cleared", "success");
      }
    });

    // Currency
    const currencySelect = document.getElementById("currencySelect");
    const showCurrencyCheckbox = document.getElementById("showCurrency");

    currencySelect.addEventListener("change", (e) => {
      Data.currency = e.target.value;
      UI.updateStats();
      UI.renderTable();
      localStorage.setItem("capita_currency", Data.currency);
    });

    showCurrencyCheckbox.addEventListener("change", (e) => {
      Data.showCurrency = e.target.checked;
      localStorage.setItem("capita_showCurrency", Data.showCurrency);
    });

    // Load saved settings
    const savedCurrency = localStorage.getItem("capita_currency") || "USD";
    const savedShowCurrency = localStorage.getItem("capita_showCurrency") !== "false";
    Data.currency = savedCurrency;
    Data.showCurrency = savedShowCurrency;
    currencySelect.value = savedCurrency;
    showCurrencyCheckbox.checked = savedShowCurrency;
  },
};


// Edit transaction
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".edit-btn");
  if (!btn) return;

  const id = parseInt(btn.dataset.id, 10);
  const tx = Data.getAll().find(item => item.id === id);
  if (!tx) return;

  const desc = prompt("Description", tx.desc);
  if (desc === null) return;
  const amount = prompt("Amount", tx.amount);
  if (amount === null) return;
  const category = prompt("Category", tx.category);
  if (category === null) return;
  const type = prompt("Type: income or expense", tx.type);
  if (type === null) return;
  const date = prompt("Date (YYYY-MM-DD)", tx.date);
  if (date === null) return;

  const parsedAmount = parseFloat(amount);
  const normalizedType = type.trim().toLowerCase();
  if (!desc.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 ||
      !["income", "expense"].includes(normalizedType) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    UI.showNotification("Invalid transaction details", "error");
    return;
  }

  Data.update(id, desc, parsedAmount, category, normalizedType, date);
  UI.updateAll();
  UI.showNotification("Transaction updated", "success");
});

// Delete transaction
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".del-btn");
  if (!btn) return;

  const id = parseInt(btn.dataset.id);
  if (confirm("Delete this transaction?")) {
    Data.delete(id);
    UI.updateAll();
    UI.showNotification("Transaction deleted", "success");
  }
});

// Initialize on ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => App.init());
} else {
  App.init();
}
