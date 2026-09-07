/* =========================================================
   CAPITA — Local Secure File Vault
   Stores uploaded financial files locally in IndexedDB.
   File contents + metadata are encrypted with AES-GCM.
   ========================================================= */

const FileVault = {
  db: null,
  key: null,
  salt: null,
  dbName: "capita_secure_file_vault",
  version: 1,
  maxFileBytes: 25 * 1024 * 1024,

  async openDB() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open local vault."));
    });
    return this.db;
  },

  async getMeta(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction("meta", "readonly").objectStore("meta").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async setMeta(record) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction("meta", "readwrite").objectStore("meta").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getSalt() {
    if (this.salt) return this.salt;
    const meta = await this.getMeta("vault");
    if (!meta?.salt) return null;
    this.salt = meta.salt instanceof Uint8Array ? meta.salt : new Uint8Array(meta.salt);
    return this.salt;
  },

  async setupPassword(password) {
    if (!password || password.length < 6) throw new Error("Use a vault password with at least 6 characters.");
    const existing = await this.getMeta("vault");
    if (existing) throw new Error("Vault is already configured. Unlock it instead.");
    this.salt = crypto.getRandomValues(new Uint8Array(16));
    await this.setMeta({ id: "vault", salt: this.salt, createdAt: Date.now() });
    await this.unlock(password);
  },

  async deriveKey(password, salt) {
    if (!crypto?.subtle) throw new Error("This browser does not provide Web Crypto support.");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  async unlock(password) {
    const salt = await this.getSalt();
    if (!salt) throw new Error("No vault exists yet. Create one first.");
    this.key = await this.deriveKey(password, salt);
    // Validate credentials when files exist by decrypting one record.
    const files = await this.rawGetAll();
    if (files.length) {
      try { await this.decryptRecord(files[0]); }
      catch (err) { this.key = null; throw new Error("Incorrect vault password."); }
    }
    return true;
  },

  lock() {
    this.key = null;
  },

  isConfigured: async function () {
    return Boolean(await this.getMeta("vault"));
  },

  isUnlocked() {
    return Boolean(this.key);
  },

  async encryptPayload(payload) {
    if (!this.key) throw new Error("Vault is locked.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key, data);
    return { iv, ciphertext: encrypted };
  },

  async decryptPayload(iv, ciphertext) {
    if (!this.key) throw new Error("Vault is locked.");
    const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, this.key, ciphertext);
    return JSON.parse(new TextDecoder().decode(data));
  },

  async encryptFile(file, meta) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const combined = new Uint8Array(4 + metaBytes.length + fileBytes.length);
    new DataView(combined.buffer).setUint32(0, metaBytes.length);
    combined.set(metaBytes, 4);
    combined.set(fileBytes, 4 + metaBytes.length);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key, combined);
    return { iv, ciphertext };
  },

  async decryptRecord(record) {
    const combined = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, this.key, record.ciphertext));
    const metaLength = new DataView(combined.buffer).getUint32(0);
    const metaBytes = combined.slice(4, 4 + metaLength);
    const fileBytes = combined.slice(4 + metaLength);
    const meta = JSON.parse(new TextDecoder().decode(metaBytes));
    return { ...meta, id: record.id, createdAt: record.createdAt, bytes: fileBytes };
  },

  async rawGetAll() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction("files", "readonly").objectStore("files").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async add(file, category = "Other", notes = "") {
    if (!this.key) throw new Error("Unlock the vault before adding files.");
    if (!file) throw new Error("No file selected.");
    if (file.size > this.maxFileBytes) throw new Error(`File too large. Maximum size is ${this.formatBytes(this.maxFileBytes)}.`);
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const meta = {
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      category,
      notes: String(notes || "").slice(0, 500),
      extension: (file.name.split(".").pop() || "FILE").toUpperCase(),
    };
    const encrypted = await this.encryptFile(file, meta);
    const db = await this.openDB();
    await new Promise((resolve, reject) => {
      const req = db.transaction("files", "readwrite").objectStore("files").put({
        id, createdAt: Date.now(), iv: encrypted.iv, ciphertext: encrypted.ciphertext,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return { id, ...meta, createdAt: Date.now() };
  },

  async list() {
    if (!this.key) return [];
    const records = await this.rawGetAll();
    const output = [];
    for (const record of records) {
      try { output.push(await this.decryptRecord(record)); }
      catch (err) { /* Skip unreadable records while keeping vault available. */ }
    }
    return output.sort((a, b) => b.createdAt - a.createdAt);
  },

  async get(id) {
    if (!this.key) throw new Error("Vault is locked.");
    const db = await this.openDB();
    const record = await new Promise((resolve, reject) => {
      const req = db.transaction("files", "readonly").objectStore("files").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (!record) throw new Error("File not found.");
    return this.decryptRecord(record);
  },

  async updateMeta(id, patch) {
    const item = await this.get(id);
    const blob = new File([item.bytes], item.name, { type: item.mime });
    const meta = {
      name: patch.name ?? item.name,
      mime: item.mime,
      size: item.size,
      category: patch.category ?? item.category,
      notes: patch.notes ?? item.notes,
      extension: (String(patch.name ?? item.name).split(".").pop() || item.extension).toUpperCase(),
    };
    const encrypted = await this.encryptFile(blob, meta);
    const db = await this.openDB();
    await new Promise((resolve, reject) => {
      const req = db.transaction("files", "readwrite").objectStore("files").put({
        id, createdAt: item.createdAt, iv: encrypted.iv, ciphertext: encrypted.ciphertext,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    if (!this.key) throw new Error("Vault is locked.");
    const db = await this.openDB();
    await new Promise((resolve, reject) => {
      const req = db.transaction("files", "readwrite").objectStore("files").delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clearAll() {
    if (!this.key) throw new Error("Vault is locked.");
    const db = await this.openDB();
    await new Promise((resolve, reject) => {
      const req = db.transaction("files", "readwrite").objectStore("files").clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = units[0];
    for (let i = 1; i < units.length && value >= 1024; i++) { value /= 1024; unit = units[i]; }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
  },
};
