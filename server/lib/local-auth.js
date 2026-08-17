const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const LOCAL_SESSION_COOKIE = "vt_local_session";
const sessions = new Map();

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], promoCodes: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      users: Array.isArray(db.users) ? db.users : [],
      promoCodes: Array.isArray(db.promoCodes) ? db.promoCodes : [],
    };
  } catch {
    return { users: [], promoCodes: [] };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLocaleLowerCase("tr-TR");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const next = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(next.hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function isAdminUser(user) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "cantoprak2000@hotmail.com");
  return Boolean(user && (user.role === "admin" || user.email === adminEmail));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id || user.email,
    name: user.name || "",
    email: user.email,
    plan: user.plan || "free",
    isAdmin: isAdminUser(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createSession(email) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, normalizeEmail(email));
  return sessionId;
}

function getSessionUser(sessionId) {
  const email = sessionId ? sessions.get(sessionId) : "";
  if (!email) return null;
  return readDb().users.find((user) => user.email === email) || null;
}

function deleteSession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

function login({ email, password }) {
  const db = readDb();
  const user = db.users.find((item) => item.email === normalizeEmail(email));
  if (!user) {
    const error = new Error("Bu e-posta ile hesap bulunamadı. Kayıt Ol sekmesini kullanın.");
    error.status = 401;
    throw error;
  }
  if (!verifyPassword(password, user)) {
    const error = new Error("E-posta veya şifre hatalı.");
    error.status = 401;
    throw error;
  }
  return publicUser(user);
}

function register({ email, password, name }) {
  const db = readDb();
  const normalizedEmail = normalizeEmail(email);
  if (db.users.some((item) => item.email === normalizedEmail)) {
    const error = new Error("Bu e-posta ile hesap var. Giriş sekmesini kullanın.");
    error.status = 409;
    throw error;
  }
  const passwordData = hashPassword(password);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    name,
    email: normalizedEmail,
    plan: "free",
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  writeDb(db);
  return publicUser(user);
}

function listUsers() {
  return readDb().users.map(publicUser);
}

function createUser({ email, password, name, plan }) {
  const user = register({ email, password, name });
  setUserPlan(user.email, plan);
  return findUserByEmail(user.email);
}

function findUserByEmail(email) {
  return publicUser(readDb().users.find((user) => user.email === normalizeEmail(email)));
}

function setUserPlan(email, plan) {
  const db = readDb();
  const user = db.users.find((item) => item.email === normalizeEmail(email));
  if (!user) return null;
  user.plan = plan === "pro" ? "pro" : "free";
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  return publicUser(user);
}

function normalizePromoCode(code) {
  return String(code || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
}

function listPromoCodes() {
  return readDb().promoCodes.map(publicPromoCode);
}

function createPromoCode({ code, trialDays, maxRedemptions, expiresAt, active }) {
  const db = readDb();
  const normalizedCode = normalizePromoCode(code);
  if (!/^[A-ZÇĞİÖŞÜ0-9_-]{3,32}$/.test(normalizedCode)) {
    const error = new Error("Kod 3-32 karakter olmalı; harf, rakam, tire veya alt çizgi kullanın.");
    error.status = 400;
    throw error;
  }
  if (db.promoCodes.some((item) => item.code === normalizedCode)) {
    const error = new Error("Bu promosyon kodu zaten var.");
    error.status = 409;
    throw error;
  }
  const now = new Date().toISOString();
  const promoCode = {
    id: crypto.randomUUID(),
    code: normalizedCode,
    trialDays: clampNumber(trialDays, 1, 365),
    maxRedemptions: clampNumber(maxRedemptions, 1, 100000),
    redeemedCount: 0,
    expiresAt: expiresAt || null,
    active: active !== false,
    createdAt: now,
    updatedAt: now,
  };
  db.promoCodes.push(promoCode);
  writeDb(db);
  return publicPromoCode(promoCode);
}

function findPromoCode(code) {
  const normalizedCode = normalizePromoCode(code);
  return publicPromoCode(readDb().promoCodes.find((item) => item.code === normalizedCode));
}

function publicPromoCode(promoCode) {
  if (!promoCode) return null;
  return {
    id: promoCode.id,
    code: promoCode.code,
    trialDays: Number(promoCode.trialDays || promoCode.trial_days || 0),
    maxRedemptions: Number(promoCode.maxRedemptions || promoCode.max_redemptions || 0),
    redeemedCount: Number(promoCode.redeemedCount || promoCode.redeemed_count || 0),
    expiresAt: promoCode.expiresAt || promoCode.expires_at || null,
    active: promoCode.active !== false,
    createdAt: promoCode.createdAt || promoCode.created_at,
    updatedAt: promoCode.updatedAt || promoCode.updated_at,
  };
}

function isPromoCodeUsable(promoCode) {
  if (!promoCode?.active) return false;
  if (promoCode.expiresAt && new Date(promoCode.expiresAt).getTime() < Date.now()) return false;
  return Number(promoCode.redeemedCount || 0) < Number(promoCode.maxRedemptions || 0);
}

function clampNumber(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function deleteUser(email) {
  const db = readDb();
  const normalizedEmail = normalizeEmail(email);
  const nextUsers = db.users.filter((item) => item.email !== normalizedEmail);
  const deleted = nextUsers.length !== db.users.length;
  db.users = nextUsers;
  writeDb(db);
  return deleted;
}

module.exports = {
  LOCAL_SESSION_COOKIE,
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  findUserByEmail,
  findPromoCode,
  getSessionUser,
  isAdminUser,
  isPromoCodeUsable,
  listPromoCodes,
  listUsers,
  login,
  normalizePromoCode,
  publicUser,
  register,
  createPromoCode,
  setUserPlan,
};
