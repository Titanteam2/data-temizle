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
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return { users: Array.isArray(db.users) ? db.users : [] };
  } catch {
    return { users: [] };
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
  getSessionUser,
  isAdminUser,
  listUsers,
  login,
  publicUser,
  register,
  setUserPlan,
};
