/* =========================================================
   CAPITA — Main Application Logic
   Handles user interactions and app flow
   ========================================================= */

const App = {
  currentView: "dashboard",

  init() {
    this.setupTheme();
    this.setupHomeLogo();
    this.setupInteractions();
    this.setupNavigation();
    this.setupForm();
    this.setupTransactions();
    this.setupAnalytics();
    this.setupCurrencyCalculator();
    this.setupFileVault();
    this.setupSettings();
    UI.updateAll();
  },


  setupHomeLogo() {
    const logo = document.getElementById("logoHome");
    if (!logo) return;
    logo.addEventListener("click", () => {
      // The brand acts as a reliable home/refresh control.
      window.location.reload();
    });
  },

  setupTheme() {
    const themeBtn = document.getElementById("themeBtn");
    const root = document.documentElement;

    // Check saved theme
    const savedTheme = localStorage.getItem("capita_theme") || "dark";
    root.setAttribute("data-theme", savedTheme);
    this.updateThemeIcon(savedTheme);

    themeBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("capita_theme", next);
      this.updateThemeIcon(next);
      if (UI.charts.main) {
        setTimeout(() => {
          const mode = document.querySelector(".chart-mode-btn.active")?.dataset.mode || "pie";
          UI.renderChart(mode);
        }, 300);
      }
    });
  },

  updateThemeIcon(theme) {
    const icon = document.getElementById("themeIcon");
    icon.textContent = theme === "dark" ? "☀️" : "🌙";
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
          } else if (viewName === "vault") {
            App.refreshFileVault();
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

  setupFileVault() {
    this.pendingVaultFiles = [];

    const form = document.getElementById("vaultAuthForm");
    const fileInput = document.getElementById("vaultFileInput");
    const dropzone = document.getElementById("vaultDropzone");
    const saveSelected = document.getElementById("vaultSaveSelected");
    const lockBtn = document.getElementById("vaultLockBtn");
    const search = document.getElementById("vaultSearch");
    const filter = document.getElementById("vaultFilter");
    const clearVaultBtn = document.getElementById("vaultClearBtn");
    const modal = document.getElementById("vaultModal");
    const modalClose = document.getElementById("vaultModalClose");

    if (!form || !fileInput || !dropzone) return;

    this.refreshFileVault();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("vaultPassword").value;
      const confirm = document.getElementById("vaultConfirmPassword").value;
      const configured = await FileVault.isConfigured();
      if (!configured && password !== confirm) {
        UI.showNotification("Vault passwords do not match", "error");
        return;
      }
      try {
        if (!configured) {
          await FileVault.setupPassword(password);
          UI.showNotification("Secure vault created", "success");
        } else {
          await FileVault.unlock(password);
          UI.showNotification("Vault unlocked", "success");
        }
        document.getElementById("vaultPassword").value = "";
        document.getElementById("vaultConfirmPassword").value = "";
        this.updateVaultState(true);
        await this.renderVaultFiles();
      } catch (err) {
        UI.showNotification(err.message || "Unable to open vault", "error");
      }
    });

    fileInput.addEventListener("change", (e) => this.stageVaultFiles([...e.target.files]));

    ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragging");
    }));
    dropzone.addEventListener("drop", (e) => this.stageVaultFiles([...e.dataTransfer.files]));
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
    });

    saveSelected?.addEventListener("click", async () => {
      if (!this.pendingVaultFiles.length) return;
      if (!FileVault.isUnlocked()) { UI.showNotification("Unlock the vault first", "error"); return; }
      const category = document.getElementById("vaultCategory").value;
      const notes = document.getElementById("vaultNotes").value.trim();
      const files = [...this.pendingVaultFiles];
      const progress = document.getElementById("vaultProgress");
      const bar = document.getElementById("vaultProgressBar");
      const label = document.getElementById("vaultProgressLabel");
      const value = document.getElementById("vaultProgressValue");
      const detail = document.getElementById("vaultProgressDetail");
      if (progress) progress.hidden = false;
      if (saveSelected) saveSelected.disabled = true;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const pct = Math.round((i / files.length) * 100);
          if (bar) bar.style.width = `${pct}%`; if (value) value.textContent = `${pct}%`;
          if (label) label.textContent = `Securing ${file.name}`;
          if (detail) detail.textContent = `Encrypting file ${i + 1} of ${files.length} locally…`;
          await FileVault.add(file, category, notes);
          const done = Math.round(((i + 1) / files.length) * 100);
          if (bar) bar.style.width = `${done}%`; if (value) value.textContent = `${done}%`;
        }
        if (label) label.textContent = "Files stored securely";
        if (detail) detail.textContent = "Encryption completed. Your documents remain in this browser vault.";
        UI.showNotification(`${files.length} file(s) stored securely`, "success");
        await this.renderVaultFiles();
        setTimeout(() => this.clearStagedVaultFiles(), 700);
      } catch (err) {
        UI.showNotification(err.message || "Unable to store files", "error");
        if (label) label.textContent = "Secure storage stopped";
        if (detail) detail.textContent = err.message || "Unable to store the selected files.";
      } finally {
        if (saveSelected) saveSelected.disabled = false;
      }
    });

    lockBtn?.addEventListener("click", () => {
      FileVault.lock();
      this.clearStagedVaultFiles();
      this.updateVaultState(false);
      UI.showNotification("Vault locked", "success");
    });

    [search, filter].forEach(el => el?.addEventListener("input", () => this.renderVaultFiles()));
    filter?.addEventListener("change", () => this.renderVaultFiles());
    clearVaultBtn?.addEventListener("click", async () => {
      if (!FileVault.isUnlocked()) return;
      const files = await FileVault.list();
      if (!files.length) { UI.showNotification("The vault is already empty", "success"); return; }
      if (!confirm(`Delete all ${files.length} stored file(s)? This cannot be undone.`)) return;
      try {
        await FileVault.clearAll();
        await this.renderVaultFiles();
        UI.showNotification("All vault files deleted", "success");
      } catch (err) {
        UI.showNotification(err.message || "Unable to clear vault", "error");
      }
    });

    document.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-vault-action]");
      if (!action) return;
      const id = action.dataset.id;
      const type = action.dataset.vaultAction;
      try {
        if (type === "download") await this.downloadVaultFile(id);
        else if (type === "preview") await this.previewVaultFile(id);
        else if (type === "rename") await this.renameVaultFile(id);
        else if (type === "delete") await this.deleteVaultFile(id);
      } catch (err) {
        UI.showNotification(err.message || "Vault action failed", "error");
      }
    });

    const closeModal = () => {
      const preview = document.getElementById("vaultPreview");
      preview.querySelectorAll("iframe, img").forEach(el => { if (el.src.startsWith("blob:")) URL.revokeObjectURL(el.src); });
      preview.innerHTML = "";
      modal.hidden = true;
    };
    modalClose?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal && !modal.hidden) closeModal(); });
  },

  stageVaultFiles(files) {
    this.pendingVaultFiles = files.filter(Boolean).filter(file => file.size <= FileVault.maxFileBytes);
    const selected = document.getElementById("vaultSelected");
    const meta = document.getElementById("vaultAddMeta");
    const preview = document.getElementById("vaultSelectionPreview");
    const progress = document.getElementById("vaultProgress");
    const bar = document.getElementById("vaultProgressBar");
    const label = document.getElementById("vaultProgressLabel");
    const value = document.getElementById("vaultProgressValue");
    const detail = document.getElementById("vaultProgressDetail");
    if (!selected || !meta) return;
    if (progress) progress.hidden = true;
    if (bar) bar.style.width = "0%"; if (value) value.textContent = "0%";
    if (!this.pendingVaultFiles.length) {
      selected.hidden = true; meta.hidden = true; if (preview) { preview.hidden = true; preview.innerHTML = ""; } return;
    }
    selected.hidden = false; meta.hidden = false;
    selected.textContent = `${this.pendingVaultFiles.length} file(s) selected — review before secure storage.`;
    if (label) label.textContent = "Ready to secure selected files";
    if (detail) detail.textContent = "Files are only stored after you choose Store Selected Files.";
    if (preview) {
      preview.hidden = false; preview.innerHTML = "";
      this.pendingVaultFiles.forEach(file => {
        const item = document.createElement("div"); item.className = "vault-selection-item";
        const copy = document.createElement("div"); copy.className = "vault-selection-copy";
        const name = document.createElement("strong"); name.textContent = file.name;
        const info = document.createElement("span"); info.textContent = `${FileVault.formatBytes(file.size)} · ${(file.type || "FILE").split("/").pop().toUpperCase()}`;
        copy.append(name, info);
        if (file.type?.startsWith("image/")) {
          const img = document.createElement("img"); img.className = "vault-selection-thumb"; img.alt = "Selected image preview"; img.src = URL.createObjectURL(file); img.onload = () => URL.revokeObjectURL(img.src); item.append(img);
        } else {
          const icon = document.createElement("div"); icon.className = "vault-selection-icon"; icon.textContent = (file.name.split(".").pop() || "FILE").toUpperCase().slice(0,4); item.append(icon);
        }
        item.append(copy); preview.append(item);
      });
    }
  },

  clearStagedVaultFiles() {
    this.pendingVaultFiles = [];
    const input = document.getElementById("vaultFileInput");
    const selected = document.getElementById("vaultSelected");
    const meta = document.getElementById("vaultAddMeta");
    const preview = document.getElementById("vaultSelectionPreview");
    const progress = document.getElementById("vaultProgress");
    const bar = document.getElementById("vaultProgressBar");
    const value = document.getElementById("vaultProgressValue");
    if (input) input.value = "";
    if (selected) selected.hidden = true;
    if (meta) meta.hidden = true;
    if (preview) { preview.hidden = true; preview.innerHTML = ""; }
    if (progress) progress.hidden = true;
    if (bar) bar.style.width = "0%"; if (value) value.textContent = "0%";
    const notes = document.getElementById("vaultNotes");
    if (notes) notes.value = "";
  },

  async refreshFileVault() {
    try {
      const configured = await FileVault.isConfigured();
      this.updateVaultAuthUI(configured);
      if (configured && FileVault.isUnlocked()) {
        this.updateVaultState(true);
        await this.renderVaultFiles();
      } else {
        this.updateVaultState(false);
      }
    } catch (err) {
      this.updateVaultAuthUI(false);
      UI.showNotification(err.message || "Secure vault is unavailable", "error");
    }
  },

  updateVaultAuthUI(configured) {
    const kicker = document.getElementById("vaultAuthKicker");
    const title = document.getElementById("vaultAuthTitle");
    const help = document.getElementById("vaultAuthHelp");
    const confirmField = document.getElementById("vaultConfirmField");
    const btn = document.getElementById("vaultAuthBtn");
    const status = document.getElementById("vaultStatus");
    if (!kicker || !title || !help || !confirmField || !btn || !status) return;
    if (configured) {
      kicker.textContent = "VAULT LOCKED";
      title.textContent = "Unlock your secure file vault";
      help.textContent = "Enter your vault password to view, download, preview or manage encrypted documents.";
      confirmField.hidden = true;
      confirmField.querySelector("input").required = false;
      btn.textContent = "Unlock Vault";
      status.textContent = "Locked";
      status.classList.remove("is-unlocked");
    } else {
      kicker.textContent = "FIRST-TIME SETUP";
      title.textContent = "Create your secure file vault";
      help.textContent = "Choose a password with at least 6 characters. You will need it each time you open the vault.";
      confirmField.hidden = false;
      confirmField.querySelector("input").required = true;
      btn.textContent = "Create Vault";
      status.textContent = "Not configured";
      status.classList.remove("is-unlocked");
    }
  },

  updateVaultState(unlocked) {
    const auth = document.getElementById("vaultAuthCard");
    const workspace = document.getElementById("vaultWorkspace");
    const status = document.getElementById("vaultStatus");
    const lockBtn = document.getElementById("vaultLockBtn");
    if (unlocked) {
      auth.hidden = true;
      workspace.hidden = false;
      status.textContent = "Unlocked";
      status.classList.add("is-unlocked");
      lockBtn.hidden = false;
    } else {
      auth.hidden = false;
      workspace.hidden = true;
      lockBtn.hidden = true;
    }
  },

  async renderVaultFiles() {
    const grid = document.getElementById("vaultFileGrid");
    const empty = document.getElementById("vaultEmpty");
    const count = document.getElementById("vaultCount");
    const search = (document.getElementById("vaultSearch")?.value || "").trim().toLowerCase();
    const filter = document.getElementById("vaultFilter")?.value || "all";
    if (!grid || !empty || !count) return;
    if (!FileVault.isUnlocked()) return;
    const files = await FileVault.list();
    const filtered = files.filter(file => {
      const haystack = `${file.name} ${file.category} ${file.notes}`.toLowerCase();
      return (!search || haystack.includes(search)) && (filter === "all" || file.category === filter);
    });
    count.textContent = files.length;
    grid.innerHTML = filtered.map(file => {
      const previewable = /^(application\/pdf|image\/)/i.test(file.mime || "") || ["PDF", "PNG", "JPG", "JPEG"].includes(file.extension);
      const safeName = UI.escapeHtml(file.name);
      return `
        <article class="vault-file-card">
          <div class="vault-file-top"><span class="vault-file-type">${UI.escapeHtml(file.extension || "FILE")}</span><span class="vault-file-size">${FileVault.formatBytes(file.size)}</span></div>
          <div class="vault-file-icon">${file.extension === "PDF" ? "▤" : ["XLS","XLSX","CSV"].includes(file.extension) ? "▦" : "▣"}</div>
          <h4 title="${safeName}">${safeName}</h4>
          <p class="vault-file-category">${UI.escapeHtml(file.category)}</p>
          ${file.notes ? `<p class="vault-file-notes">${UI.escapeHtml(file.notes)}</p>` : ""}
          <div class="vault-file-meta"><span>${new Date(file.createdAt).toLocaleDateString()}</span><span>Encrypted</span></div>
          <div class="vault-file-actions">
            ${previewable ? `<button type="button" class="btn btn-secondary" data-vault-action="preview" data-id="${file.id}">Preview</button>` : ""}
            <button type="button" class="btn btn-secondary" data-vault-action="download" data-id="${file.id}">Download</button>
            <button type="button" class="vault-icon-btn" data-vault-action="rename" data-id="${file.id}" title="Rename">✎</button>
            <button type="button" class="vault-icon-btn danger" data-vault-action="delete" data-id="${file.id}" title="Delete">×</button>
          </div>
        </article>`;
    }).join("");
    empty.hidden = filtered.length > 0;
    empty.textContent = files.length === 0 ? "Your encrypted file vault is empty. Add a financial document above." : "No files match the current search or filter.";
  },

  async downloadVaultFile(id) {
    const file = await FileVault.get(id);
    const blob = new Blob([file.bytes], { type: file.mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async previewVaultFile(id) {
    const file = await FileVault.get(id);
    const preview = document.getElementById("vaultPreview");
    const modal = document.getElementById("vaultModal");
    const title = document.getElementById("vaultModalTitle");
    const blob = new Blob([file.bytes], { type: file.mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    title.textContent = file.name;
    if ((file.mime || "").includes("pdf") || file.extension === "PDF") {
      preview.innerHTML = `<iframe title="PDF preview" src="${url}"></iframe>`;
    } else if ((file.mime || "").startsWith("image/") || ["PNG","JPG","JPEG"].includes(file.extension)) {
      preview.innerHTML = `<img alt="${UI.escapeHtml(file.name)}" src="${url}">`;
    } else {
      URL.revokeObjectURL(url);
      preview.textContent = "Preview is available for PDF and image documents. Use Download for this file type.";
    }
    modal.hidden = false;
  },

  async renameVaultFile(id) {
    const file = await FileVault.get(id);
    const next = prompt("Rename file", file.name);
    if (!next || next.trim() === file.name) return;
    const safeName = next.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
    if (!safeName) return;
    await FileVault.updateMeta(id, { name: safeName });
    await this.renderVaultFiles();
    UI.showNotification("File renamed", "success");
  },

  async deleteVaultFile(id) {
    const file = await FileVault.get(id);
    if (!confirm(`Delete "${file.name}" from the vault? This cannot be undone.`)) return;
    await FileVault.delete(id);
    await this.renderVaultFiles();
    UI.showNotification("File deleted from vault", "success");
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
