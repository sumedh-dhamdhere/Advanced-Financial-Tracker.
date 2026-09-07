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

  export() {
    return JSON.stringify(this.transactions, null, 2);
  },

  import(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data)) {
        this.transactions = data;
        this.nextId = Math.max(...data.map(t => t.id), 0) + 1;
        this.saveToStorage();
        return true;
      }
    } catch (e) {
      console.error("Import error:", e);
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
