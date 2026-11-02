/* =========================================================
   CAPITA — Data Management Module
   Handles all transaction data operations
   ========================================================= */

const Data = {
  transactions: [],
  currency: "USD",
  showCurrency: true,

  init() {
    this.loadFromStorage();
    if (this.transactions.length === 0) {
      this.seedData();
    }
  },

  seedData() {
    this.transactions = [
      { id: 1, desc: "Monthly Salary", amount: 3500, category: "salary", type: "income", date: "2024-01-01" },
      { id: 2, desc: "Supermarket", amount: 45.50, category: "food", type: "expense", date: "2024-01-02" },
      { id: 3, desc: "Electric Bill", amount: 120, category: "bills", type: "expense", date: "2024-01-03" },
      { id: 4, desc: "Online Shopping", amount: 89.99, category: "shopping", type: "expense", date: "2024-01-04" },
      { id: 5, desc: "Freelance Work", amount: 500, category: "salary", type: "income", date: "2024-01-05" },
      { id: 6, desc: "Gas Station", amount: 60, category: "transport", type: "expense", date: "2024-01-06" },
      { id: 7, desc: "Movie Tickets", amount: 28, category: "entertainment", type: "expense", date: "2024-01-07" },
      { id: 8, desc: "Doctor Visit", amount: 150, category: "health", type: "expense", date: "2024-01-08" },
      { id: 9, desc: "Gym Subscription", amount: 45, category: "health", type: "expense", date: "2024-01-09" },
      { id: 10, desc: "Restaurant", amount: 65.75, category: "food", type: "expense", date: "2024-01-10" },
    ];
    this.nextId = 11;
    this.saveToStorage();
  },

  nextId: 11,

  add(desc, amount, category, type, date = new Date().toISOString().split('T')[0]) {
    const tx = {
      id: this.nextId++,
      desc: desc.trim(),
      amount: parseFloat(amount),
      category: category.toLowerCase(),
      type,
      date,
    };
    this.transactions.unshift(tx);
    this.saveToStorage();
    return tx;
  },

  delete(id) {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.saveToStorage();
  },

  update(id, desc, amount, category, type, date) {
    const tx = this.transactions.find(t => t.id === Number(id));
    if (!tx) return null;
    tx.desc = String(desc).trim();
    tx.amount = parseFloat(amount);
    tx.category = String(category).toLowerCase();
    tx.type = type;
    tx.date = date || tx.date;
    this.saveToStorage();
    return tx;
  },

  getWeeklyCashFlow(weeks = 18) {
    const horizon = Math.max(1, Math.min(18, Number(weeks) || 18));
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    start.setDate(start.getDate() - day);

    const income = Array(horizon).fill(0);
    const expenses = Array(horizon).fill(0);

    this.transactions.forEach(tx => {
      const txDate = new Date(`${tx.date}T00:00:00`);
      const diffDays = Math.floor((start - txDate) / 86400000);
      const weekIndex = horizon - 1 - Math.floor(diffDays / 7);
      if (weekIndex >= 0 && weekIndex < horizon) {
        if (tx.type === "income") income[weekIndex] += tx.amount;
        if (tx.type === "expense") expenses[weekIndex] += tx.amount;
      }
    });

    return {
      income: income.map(v => Math.round(v * 100) / 100),
      expenses: expenses.map(v => Math.round(v * 100) / 100),
      net: income.map((v, i) => Math.round((v - expenses[i]) * 100) / 100)
    };
  },

  getAll() {
    return this.transactions;
  },

  getByType(type) {
    return this.transactions.filter(t => t.type === type);
  },

  filter(options = {}) {
    let result = this.transactions;

    if (options.type) {
      result = result.filter(t => t.type === options.type);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      result = result.filter(t =>
        t.desc.toLowerCase().includes(q) || t.category.includes(q)
      );
    }

    if (options.dateFrom) {
      result = result.filter(t => t.date >= options.dateFrom);
    }

    if (options.dateTo) {
      result = result.filter(t => t.date <= options.dateTo);
    }

    return result;
  },

  getStats() {
    const income = this.getByType("income").reduce((sum, t) => sum + t.amount, 0);
    const expenses = this.getByType("expense").reduce((sum, t) => sum + t.amount, 0);

    return {
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
      count: this.transactions.length,
    };
  },

  getCategoryTotals() {
    const totals = {};
    this.getByType("expense").forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return Object.entries(totals)
      .map(([cat, amount]) => ({ category: cat, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  },

  getTopTransactions(limit = 5) {
    return [...this.transactions].sort((a, b) => b.amount - a.amount).slice(0, limit);
  },

  normalizeTransactions(items) {
    if (!Array.isArray(items)) return null;
    const normalized = items.map((t, index) => {
      const desc = String(t?.desc ?? t?.description ?? "").trim();
      const amount = Number.parseFloat(String(t?.amount ?? t?.value ?? "").replace(/[$₹€£,]/g, ""));
      const category = String(t?.category ?? "other").trim().toLowerCase() || "other";
      const type = String(t?.type ?? "expense").trim().toLowerCase();
      const date = String(t?.date ?? "").trim();
      if (!desc || !Number.isFinite(amount) || amount <= 0 || !["income", "expense"].includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { id: Number(t?.id) > 0 ? Number(t.id) : index + 1, desc, amount, category, type, date };
    }).filter(Boolean);
    return normalized.length ? normalized : null;
  },

  importTransactions(items) {
    const normalized = this.normalizeTransactions(items);
    if (!normalized) return false;
    this.transactions = normalized;
    this.nextId = Math.max(...normalized.map(t => t.id), 0) + 1;
    this.saveToStorage();
    return true;
  },

  export() {
    return JSON.stringify(this.transactions, null, 2);
  },

  exportCSV() {
    const headers = ["id", "description", "amount", "category", "type", "date"];
    const escape = (value) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(","), ...this.transactions.map(t => [
      t.id, t.desc, Number(t.amount).toFixed(2), t.category, t.type, t.date
    ].map(escape).join(","))].join("\n");
  },

  importCSV(csvData) {
    const rows = this.parseCSV(csvData);
    if (!rows.length) return false;
    const header = rows[0].map(v => String(v).trim().toLowerCase());
    const find = (...names) => names.map(n => header.indexOf(n)).find(i => i >= 0);
    const descIndex = find("description", "desc", "name");
    const amountIndex = find("amount", "value");
    const categoryIndex = find("category", "cat");
    const typeIndex = find("type", "transaction_type", "transaction type");
    const dateIndex = find("date", "transaction_date", "transaction date");
    if ([descIndex, amountIndex, categoryIndex, typeIndex, dateIndex].some(i => i == null)) return false;

    const imported = rows.slice(1).map((row, index) => {
      const desc = String(row[descIndex] ?? "").trim();
      const amount = Number.parseFloat(String(row[amountIndex] ?? "").replace(/[$₹€£,]/g, ""));
      const category = String(row[categoryIndex] ?? "other").trim().toLowerCase() || "other";
      const type = String(row[typeIndex] ?? "expense").trim().toLowerCase();
      const date = String(row[dateIndex] ?? "").trim();
      if (!desc || !Number.isFinite(amount) || amount <= 0 || !["income", "expense"].includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { id: index + 1, desc, amount, category, type, date };
    }).filter(Boolean);
    if (!imported.length) return false;
    return this.importTransactions(imported);
  },

  parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < String(text).length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === ',' && !quoted) { row.push(cell); cell = ""; continue; }
      if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cell); cell = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row); }
    return rows;
  },

  import(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      return this.importTransactions(data);
    } catch (e) {
      console.error("Import error:", e);
      return false;
    }
  },

  exportXLS() {
    const xml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
    const cell = (value, type = "String") => `<Cell><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
    const rows = [
      `<Row>${["id","description","amount","category","type","date"].map(v => cell(v)).join("")}</Row>`,
      ...this.transactions.map(t => `<Row>${[
        cell(t.id, "Number"), cell(t.desc), cell(Number(t.amount).toFixed(2), "Number"),
        cell(t.category), cell(t.type), cell(t.date, "String")
      ].join("")}</Row>`)
    ];
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
` +
      `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
      `<Worksheet ss:Name="Capita Transactions"><Table>${rows.join("")}</Table></Worksheet></Workbook>`;
  },

  importXLS(xlsText) {
    try {
      const doc = new DOMParser().parseFromString(String(xlsText), "application/xml");
      if (doc.querySelector("parsererror")) return false;
      const rowNodes = Array.from(doc.getElementsByTagNameNS("*", "Row"));
      if (!rowNodes.length) return false;
      const rows = rowNodes.map(row => Array.from(row.getElementsByTagNameNS("*", "Data")).map(d => d.textContent || ""));
      if (!rows.length) return false;
      const header = rows[0].map(v => String(v).trim().toLowerCase());
      const find = (...names) => names.map(n => header.indexOf(n)).find(i => i >= 0);
      const descIndex = find("description", "desc", "name");
      const amountIndex = find("amount", "value");
      const categoryIndex = find("category", "cat");
      const typeIndex = find("type", "transaction_type", "transaction type");
      const dateIndex = find("date", "transaction_date", "transaction date");
      if ([descIndex, amountIndex, categoryIndex, typeIndex, dateIndex].some(i => i == null)) return false;
      const imported = rows.slice(1).map((row, index) => ({
        id: Number(row[0]) || index + 1, desc: row[descIndex], amount: row[amountIndex],
        category: row[categoryIndex], type: row[typeIndex], date: row[dateIndex]
      }));
      return this.importTransactions(imported);
    } catch (e) {
      console.error("XLS import error:", e);
      return false;
    }
  },

  _base64Encode(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
  },

  _base64Decode(encoded) {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  },

  exportPDF() {
    const rows = this.transactions;
    const payload = this._base64Encode(JSON.stringify(rows));
    const esc = (text) => String(text ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "?");
    const pages = [];
    const perPage = 38;
    for (let start = 0; start < rows.length || start === 0; start += perPage) {
      const slice = rows.slice(start, start + perPage);
      const lines = [
        "CAPITA - ADVANCED FINANCIAL TRACKER",
        "Transaction Ledger - Dhamdhere Financial",
        `Generated: ${new Date().toLocaleString()}`,
        `Records: ${rows.length}`,
        "",
        "ID   DATE        TYPE      CATEGORY          AMOUNT        DESCRIPTION",
        "--------------------------------------------------------------------------"
      ];
      slice.forEach(t => {
        const id = String(t.id).padEnd(4).slice(0,4);
        const date = String(t.date).padEnd(11).slice(0,11);
        const type = String(t.type).padEnd(9).slice(0,9);
        const cat = String(t.category).padEnd(17).slice(0,17);
        const amt = Number(t.amount).toFixed(2).padStart(12).slice(-12);
        const desc = String(t.desc).replace(/[\r\n]+/g, " ").slice(0, 32);
        lines.push(`${id}${date}${type}${cat}${amt}   ${desc}`);
      });
      if (!slice.length) lines.push("No transactions available.");
      pages.push(lines);
    }

    const objects = [];
    objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
    const pageIds = [];
    const contentIds = [];
    let nextId = 4;
    pages.forEach(() => { pageIds.push(nextId++); contentIds.push(nextId++); });
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    pages.forEach((lines, pageIndex) => {
      const commands = [`BT`, `/F1 10 Tf`, `36 760 Td`, `14 TL`];
      lines.forEach((line, i) => {
        if (i > 0) commands.push(`T*`);
        commands.push(`(${esc(line)}) Tj`);
      });
      commands.push(`ET`);
      const stream = commands.join("\n");
      const pageId = pageIds[pageIndex], contentId = contentIds[pageIndex];
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    let pdf = "%PDF-1.4\n%CAPITA\n";
    const offsets = [0];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    pdf += `%CAPITA_DATA_B64:${payload}\n`;
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
  },

  importPDF(arrayBuffer) {
    try {
      const text = new TextDecoder("latin1").decode(new Uint8Array(arrayBuffer));
      const match = text.match(/%CAPITA_DATA_B64:([A-Za-z0-9+/=]+)/);
      if (!match) return false;
      return this.importTransactions(JSON.parse(this._base64Decode(match[1])));
    } catch (e) {
      console.error("PDF import error:", e);
      return false;
    }
  },

  clearAll() {
    this.transactions = [];
    this.saveToStorage();
  },

  saveToStorage() {
    localStorage.setItem("capita_transactions", JSON.stringify(this.transactions));
    localStorage.setItem("capita_nextId", this.nextId);
  },

  loadFromStorage() {
    const stored = localStorage.getItem("capita_transactions");
    const nextId = localStorage.getItem("capita_nextId");
    if (stored) {
      try {
        this.transactions = JSON.parse(stored);
        this.nextId = nextId ? parseInt(nextId) : 11;
      } catch (e) {
        console.error("Load error:", e);
        this.transactions = [];
      }
    }
  },
};

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Data.init());
} else {
  Data.init();
}
