const { randomId } = require("./http");

const ACCESS_COOKIE = "vt_access_token";
const REFRESH_COOKIE = "vt_refresh_token";
const FILE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

function getSupabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function isSupabaseConfigured(requireServiceRole = false) {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && (!requireServiceRole || config.serviceRoleKey));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLocaleLowerCase("tr-TR");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function supabaseFetch(path, options = {}, useServiceRole = false) {
  const config = getSupabaseConfig();
  const key = useServiceRole ? config.serviceRoleKey : config.anonKey;
  if (!config.url || !key) {
    const error = new Error("Supabase ortam değişkenleri eksik.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || "Supabase isteği başarısız.");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function signUp({ email, password, name }) {
  return supabaseFetch("/auth/v1/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      data: { name, plan: "free" },
    }),
  });
}

async function signIn({ email, password }) {
  return supabaseFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function getUserByToken(accessToken) {
  if (!accessToken) return null;
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function publicUser(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};
  const email = normalizeEmail(user.email);
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "");
  return {
    id: user.id,
    name: metadata.name || "",
    email,
    plan: metadata.plan === "pro" || appMetadata.plan === "pro" ? "pro" : "free",
    isAdmin: appMetadata.role === "admin" || email === adminEmail,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

async function listUsers() {
  const data = await supabaseFetch("/auth/v1/admin/users", { method: "GET" }, true);
  return Array.isArray(data?.users) ? data.users.map(publicUser) : [];
}

async function createUser({ email, password, name, plan }) {
  const data = await supabaseFetch(
    "/auth/v1/admin/users",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, plan },
      }),
    },
    true,
  );
  return publicUser(data);
}

async function findUserByEmail(email) {
  const users = await listUsers();
  return users.find((user) => user.email === normalizeEmail(email)) || null;
}

async function updateUserPlan(userId, plan) {
  const data = await supabaseFetch(
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_metadata: { plan } }),
    },
    true,
  );
  return publicUser(data);
}

async function deleteUser(userId) {
  await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" }, true);
}

async function uploadUserFile({ user, fileName, mimeType, buffer }) {
  const safeName = toStorageSafeFileName(fileName);
  const objectPath = `${user.id}/${new Date().toISOString().slice(0, 10)}/${randomId()}-${safeName}`;
  await supabaseFetch(
    `/storage/v1/object/${encodeURIComponent(FILE_BUCKET)}/${encodeObjectPath(objectPath)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "x-upsert": "false",
      },
      body: buffer,
    },
    true,
  );

  const expiresDays = Number(process.env.FILE_RETENTION_DAYS || 7);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseFetch(
    "/rest/v1/file_uploads",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.id,
        file_name: fileName,
        storage_path: objectPath,
        mime_type: mimeType,
        size_bytes: buffer.length,
        expires_at: expiresAt,
      }),
    },
    true,
  );

  return rows?.[0] || { storage_path: objectPath, expires_at: expiresAt };
}

function toStorageSafeFileName(fileName) {
  const fallbackExtension = String(fileName || "").split(".").pop()?.toLocaleLowerCase("tr-TR");
  const extension = ["csv", "xlsx", "xls"].includes(fallbackExtension) ? `.${fallbackExtension}` : "";
  const baseName = String(fileName || "upload")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/\.(csv|xlsx|xls)$/i, "");
  return `${baseName || "upload"}${extension}`;
}

function encodeObjectPath(objectPath) {
  return objectPath.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function cleanupExpiredFiles() {
  const now = new Date().toISOString();
  const expired = await supabaseFetch(
    `/rest/v1/file_uploads?select=id,storage_path&expires_at=lt.${encodeURIComponent(now)}&limit=100`,
    { method: "GET" },
    true,
  );
  const paths = (expired || []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length) {
    await supabaseFetch(
      `/storage/v1/object/${encodeURIComponent(FILE_BUCKET)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      },
      true,
    );
    const ids = expired.map((item) => item.id).join(",");
    await supabaseFetch(`/rest/v1/file_uploads?id=in.(${ids})`, { method: "DELETE" }, true);
  }
  return { deleted: paths.length };
}

module.exports = {
  ACCESS_COOKIE,
  FILE_BUCKET,
  REFRESH_COOKIE,
  cleanupExpiredFiles,
  createUser,
  deleteUser,
  findUserByEmail,
  getUserByToken,
  isSupabaseConfigured,
  isValidEmail,
  listUsers,
  normalizeEmail,
  publicUser,
  signIn,
  signUp,
  updateUserPlan,
  uploadUserFile,
};
