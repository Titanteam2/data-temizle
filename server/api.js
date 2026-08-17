const {
  clearCookie,
  getClientIp,
  getCookie,
  getCorsHeaders,
  makeCookie,
  readJsonBody,
  setJson,
} = require("./lib/http");
const { rateLimit } = require("./lib/rate-limit");
const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cleanupExpiredFiles,
  createUser: supabaseCreateUser,
  createPromoCode: supabaseCreatePromoCode,
  deleteUser: supabaseDeleteUser,
  findPromoCode: supabaseFindPromoCode,
  findUserByEmail: supabaseFindUserByEmail,
  getUserByToken,
  isSupabaseConfigured,
  isPromoCodeUsable: supabaseIsPromoCodeUsable,
  isValidEmail,
  listPromoCodes: supabaseListPromoCodes,
  listUsers: supabaseListUsers,
  normalizeEmail,
  normalizePromoCode: supabaseNormalizePromoCode,
  publicUser,
  signIn,
  signUp,
  updateUserPlan: supabaseUpdateUserPlan,
  uploadUserFile,
} = require("./lib/supabase");
const localAuth = require("./lib/local-auth");

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);
const allowedExtensions = new Set(["csv", "xlsx", "xls"]);
const allowedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

function checkRateLimit(req, res, key, options) {
  const result = rateLimit(req, key, { ...options, identity: getClientIp(req) });
  if (result.ok) return true;
  setJson(res, 429, { error: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin." }, getCorsHeaders(req));
  return false;
}

async function getCurrentUser(req) {
  if (!isSupabaseConfigured(false)) {
    return localAuth.publicUser(localAuth.getSessionUser(getCookie(req, localAuth.LOCAL_SESSION_COOKIE)));
  }
  const accessToken = getCookie(req, ACCESS_COOKIE);
  const user = await getUserByToken(accessToken);
  return publicUser(user);
}

function requireSupabase(res, corsHeaders, serviceRole = false) {
  if (isSupabaseConfigured(serviceRole)) return true;
  setJson(res, 503, { error: "Supabase bağlantısı yapılandırılmamış. Environment değişkenlerini kontrol edin." }, corsHeaders);
  return false;
}

function sessionCookies(session) {
  const accessToken = session?.access_token || "";
  const refreshToken = session?.refresh_token || "";
  return [
    makeCookie(ACCESS_COOKIE, accessToken, { maxAge: session?.expires_in || 3600 }),
    makeCookie(REFRESH_COOKIE, refreshToken, { maxAge: 60 * 60 * 24 * 30 }),
  ];
}

function localSessionCookie(email) {
  return makeCookie(localAuth.LOCAL_SESSION_COOKIE, localAuth.createSession(email), { maxAge: 60 * 60 * 24 * 30 });
}

function clearAllSessionCookies() {
  return [clearCookie(ACCESS_COOKIE), clearCookie(REFRESH_COOKIE), clearCookie(localAuth.LOCAL_SESSION_COOKIE)];
}

async function parseMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) {
    const error = new Error("Dosya form verisi okunamadı.");
    error.status = 400;
    throw error;
  }

  const chunks = [];
  let size = 0;
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES + 1024 * 1024) {
        reject(Object.assign(new Error("Dosya boyutu sınırı aşıldı."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  const body = Buffer.concat(chunks);
  const marker = Buffer.from(`--${boundary}`);
  let cursor = body.indexOf(marker);
  while (cursor >= 0) {
    const next = body.indexOf(marker, cursor + marker.length);
    if (next < 0) break;
    const part = body.subarray(cursor + marker.length + 2, next - 2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd >= 0) {
      const headerText = part.subarray(0, headerEnd).toString("utf8");
      const content = part.subarray(headerEnd + 4);
      if (/name="file"/.test(headerText)) {
        const fileName = headerText.match(/filename="([^"]*)"/)?.[1] || "upload";
        const mimeType = headerText.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
        return { fileName, mimeType, buffer: content };
      }
    }
    cursor = next;
  }

  const error = new Error("Yüklenecek dosya bulunamadı.");
  error.status = 400;
  throw error;
}

function validateUploadedFile(file) {
  const extension = file.fileName.split(".").pop().toLocaleLowerCase("tr-TR");
  if (!allowedExtensions.has(extension)) {
    return "Sadece CSV, XLSX ve XLS dosyaları yüklenebilir.";
  }
  if (file.buffer.length > MAX_UPLOAD_BYTES) {
    return `Dosya en fazla ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB olabilir.`;
  }
  if (file.mimeType && !allowedMimeTypes.has(file.mimeType)) {
    return "Dosya tipi desteklenmiyor.";
  }
  return "";
}

function getFriendlyApiError(error) {
  const message = String(error?.message || "");
  const normalized = message.toLocaleLowerCase("en-US");
  if (normalized.includes("email rate limit")) {
    return "Kısa sürede çok fazla doğrulama e-postası istendi. Lütfen birkaç dakika sonra tekrar deneyin.";
  }
  if (normalized.includes("rate limit")) {
    return "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.";
  }
  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Bu e-posta adresiyle daha önce kayıt olunmuş. Giriş yapmayı deneyin.";
  }
  return message || "İşlem tamamlanamadı.";
}

function getMinimumPasswordLength() {
  return isSupabaseConfigured(false) ? 8 : 6;
}

function isIyzicoConfigured() {
  return Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY && process.env.IYZICO_BASE_URL);
}

function getPromoHelpers() {
  if (isSupabaseConfigured(true)) {
    return {
      createPromoCode: supabaseCreatePromoCode,
      findPromoCode: supabaseFindPromoCode,
      isPromoCodeUsable: supabaseIsPromoCodeUsable,
      listPromoCodes: supabaseListPromoCodes,
      normalizePromoCode: supabaseNormalizePromoCode,
    };
  }
  return {
    createPromoCode: localAuth.createPromoCode,
    findPromoCode: localAuth.findPromoCode,
    isPromoCodeUsable: localAuth.isPromoCodeUsable,
    listPromoCodes: localAuth.listPromoCodes,
    normalizePromoCode: localAuth.normalizePromoCode,
  };
}

async function handleApi(req, res, pathname) {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (!checkRateLimit(req, res, pathname, { limit: pathname.includes("/upload") ? 20 : 90, windowMs: 60_000 })) return;

  if (pathname === "/api/health" && req.method === "GET") {
    const supabase = isSupabaseConfigured(false);
    return setJson(res, 200, { ok: true, supabase, authMode: supabase ? "supabase" : "local" }, corsHeaders);
  }

  if (pathname === "/api/me" && req.method === "GET") {
    return setJson(res, 200, { user: await getCurrentUser(req) }, corsHeaders);
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const minPasswordLength = getMinimumPasswordLength();
    if (!isValidEmail(email)) return setJson(res, 400, { error: "Geçerli bir e-posta girin." }, corsHeaders);
    if (password.length < minPasswordLength) return setJson(res, 400, { error: `Şifre en az ${minPasswordLength} karakter olmalı.` }, corsHeaders);
    if (!isSupabaseConfigured(false)) {
      const user = localAuth.login({ email, password });
      return setJson(res, 200, { user }, { ...corsHeaders, "Set-Cookie": localSessionCookie(user.email) });
    }
    const data = await signIn({ email, password });
    return setJson(res, 200, { user: publicUser(data.user) }, { ...corsHeaders, "Set-Cookie": sessionCookies(data) });
  }

  if (pathname === "/api/register" && req.method === "POST") {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const minPasswordLength = getMinimumPasswordLength();
    if (!name) return setJson(res, 400, { error: "Ad soyad yazın." }, corsHeaders);
    if (!isValidEmail(email)) return setJson(res, 400, { error: "Geçerli bir e-posta girin." }, corsHeaders);
    if (password.length < minPasswordLength) return setJson(res, 400, { error: `Şifre en az ${minPasswordLength} karakter olmalı.` }, corsHeaders);

    if (!isSupabaseConfigured(false)) {
      const user = localAuth.register({ email, password, name });
      return setJson(res, 200, { user }, { ...corsHeaders, "Set-Cookie": localSessionCookie(user.email) });
    }

    const data = await signUp({ email, password, name });
    if (!data.session && !data.access_token) {
      return setJson(res, 200, { user: null, message: "Kayıt alındı. Supabase e-posta doğrulaması açıksa gelen kutusunu kontrol edin." }, corsHeaders);
    }
    return setJson(res, 200, { user: publicUser(data.user) }, { ...corsHeaders, "Set-Cookie": sessionCookies(data.session || data) });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    localAuth.deleteSession(getCookie(req, localAuth.LOCAL_SESSION_COOKIE));
    return setJson(res, 200, { ok: true }, { ...corsHeaders, "Set-Cookie": clearAllSessionCookies() });
  }

  if (pathname === "/api/upgrade-demo" && req.method === "POST") {
    if (isSupabaseConfigured(false)) {
      return setJson(res, 403, { error: "Production ortamında demo Pro tanımlama kapalı. Planı yönetici panelinden değiştirin." }, corsHeaders);
    }
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return setJson(res, 401, { error: "Pro tanımlamak için önce giriş yapın." }, corsHeaders);
    const user = localAuth.setUserPlan(currentUser.email, "pro");
    return setJson(res, 200, { user }, corsHeaders);
  }

  if (pathname === "/api/pro-trial/start" && req.method === "POST") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return setJson(res, 401, { error: "Promosyon kodu kullanmak için önce giriş yapın." }, corsHeaders);
    const body = await readJsonBody(req);
    const helpers = getPromoHelpers();
    const code = helpers.normalizePromoCode(body.code);
    if (!code) return setJson(res, 400, { error: "Promosyon kodu girin." }, corsHeaders);
    const promoCode = await helpers.findPromoCode(code);
    if (!helpers.isPromoCodeUsable(promoCode)) {
      return setJson(res, 400, { error: "Promosyon kodu geçersiz, süresi dolmuş veya kullanım limiti bitmiş." }, corsHeaders);
    }
    if (!isIyzicoConfigured()) {
      return setJson(res, 200, {
        ok: true,
        paymentReady: false,
        promoCode,
        message: `${promoCode.trialDays} günlük Pro deneme kodu geçerli. Iyzico bağlanınca kart doğrulama ekranına yönlendirilecek.`,
      }, corsHeaders);
    }
    return setJson(res, 501, {
      error: "Iyzico ödeme bağlantısı bir sonraki adımda aktif edilecek.",
      promoCode,
    }, corsHeaders);
  }

  if (pathname === "/api/files/upload" && req.method === "POST") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return setJson(res, 401, { error: "Dosya yüklemek için giriş yapın." }, corsHeaders);
    const file = await parseMultipartFile(req);
    const validationError = validateUploadedFile(file);
    if (validationError) return setJson(res, 400, { error: validationError }, corsHeaders);
    if (!isSupabaseConfigured(true)) {
      return setJson(res, 200, {
        ok: true,
        localOnly: true,
        file: {
          name: file.fileName,
          size: file.buffer.length,
          expiresAt: null,
        },
      }, corsHeaders);
    }
    const upload = await uploadUserFile({ user: currentUser, ...file });
    return setJson(res, 200, {
      ok: true,
      file: {
        name: file.fileName,
        size: file.buffer.length,
        expiresAt: upload.expires_at,
      },
    }, corsHeaders);
  }

  if (pathname === "/api/admin/users" && req.method === "GET") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.isAdmin) return setJson(res, 403, { error: "Bu alan için yönetici yetkisi gerekir." }, corsHeaders);
    const users = isSupabaseConfigured(true) ? await supabaseListUsers() : localAuth.listUsers();
    return setJson(res, 200, { users }, corsHeaders);
  }

  if (pathname === "/api/admin/users" && req.method === "POST") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.isAdmin) return setJson(res, 403, { error: "Bu alan için yönetici yetkisi gerekir." }, corsHeaders);
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const plan = body.plan === "pro" ? "pro" : "free";
    const minPasswordLength = getMinimumPasswordLength();
    if (!name) return setJson(res, 400, { error: "Ad soyad yazın." }, corsHeaders);
    if (!isValidEmail(email)) return setJson(res, 400, { error: "Geçerli bir e-posta girin." }, corsHeaders);
    if (password.length < minPasswordLength) return setJson(res, 400, { error: `Şifre en az ${minPasswordLength} karakter olmalı.` }, corsHeaders);
    const user = isSupabaseConfigured(true)
      ? await supabaseCreateUser({ email, password, name, plan })
      : localAuth.createUser({ email, password, name, plan });
    const users = isSupabaseConfigured(true) ? await supabaseListUsers() : localAuth.listUsers();
    return setJson(res, 200, { user, users }, corsHeaders);
  }

  if (pathname === "/api/admin/users/plan" && req.method === "POST") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.isAdmin) return setJson(res, 403, { error: "Bu alan için yönetici yetkisi gerekir." }, corsHeaders);
    const body = await readJsonBody(req);
    const user = isSupabaseConfigured(true) ? await supabaseFindUserByEmail(body.email) : localAuth.findUserByEmail(body.email);
    if (!user) return setJson(res, 404, { error: "Kullanıcı bulunamadı." }, corsHeaders);
    const plan = body.plan === "pro" ? "pro" : "free";
    if (isSupabaseConfigured(true)) {
      await supabaseUpdateUserPlan(user.id, plan);
    } else {
      localAuth.setUserPlan(user.email, plan);
    }
    const users = isSupabaseConfigured(true) ? await supabaseListUsers() : localAuth.listUsers();
    return setJson(res, 200, { users }, corsHeaders);
  }

  if (pathname === "/api/admin/users/delete" && req.method === "POST") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.isAdmin) return setJson(res, 403, { error: "Bu alan için yönetici yetkisi gerekir." }, corsHeaders);
    const body = await readJsonBody(req);
    const user = isSupabaseConfigured(true) ? await supabaseFindUserByEmail(body.email) : localAuth.findUserByEmail(body.email);
    if (!user) return setJson(res, 404, { error: "Kullanıcı bulunamadı." }, corsHeaders);
    if (user.email === currentUser.email || user.isAdmin) return setJson(res, 400, { error: "Admin hesabı silinemez." }, corsHeaders);
    if (isSupabaseConfigured(true)) {
      await supabaseDeleteUser(user.id);
    } else {
      localAuth.deleteUser(user.email);
    }
    const users = isSupabaseConfigured(true) ? await supabaseListUsers() : localAuth.listUsers();
    return setJson(res, 200, { ok: true, users }, corsHeaders);
  }

  if (pathname === "/api/admin/promo-codes" && req.method === "GET") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.isAdmin) return setJson(res, 403, { error: "Bu alan için yönetici yetkisi gerekir." }, corsHeaders);
    const promoCodes = await getPromoHelpers().listPromoCodes();
    return setJson(res, 200, { promoCodes }, corsHeaders);
  }

  if (pathname === "/api/admin/promo-codes" && req.method === "POST") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.isAdmin) return setJson(res, 403, { error: "Bu alan için yönetici yetkisi gerekir." }, corsHeaders);
    const body = await readJsonBody(req);
    const promoCode = await getPromoHelpers().createPromoCode({
      code: body.code,
      trialDays: body.trialDays,
      maxRedemptions: body.maxRedemptions,
      expiresAt: body.expiresAt,
      active: body.active !== false,
    });
    const promoCodes = await getPromoHelpers().listPromoCodes();
    return setJson(res, 200, { promoCode, promoCodes }, corsHeaders);
  }

  if (pathname === "/api/cron/cleanup-files" && ["GET", "POST"].includes(req.method)) {
    if (!requireSupabase(res, corsHeaders, true)) return;
    const expectedSecret = process.env.CRON_SECRET || "";
    const incomingSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
    if (expectedSecret && incomingSecret !== expectedSecret) {
      return setJson(res, 401, { error: "Cron yetkisi geçersiz." }, corsHeaders);
    }
    return setJson(res, 200, await cleanupExpiredFiles(), corsHeaders);
  }

  return setJson(res, 404, { error: "API bulunamadı." }, corsHeaders);
}

async function safeHandleApi(req, res, pathname) {
  try {
    await handleApi(req, res, pathname);
  } catch (error) {
    const friendlyError = getFriendlyApiError(error);
    console.error(JSON.stringify({
      level: "error",
      message: error.message,
      friendlyMessage: friendlyError,
      path: pathname,
      status: error.status || 500,
    }));
    setJson(res, error.status || 500, {
      error: error.status && error.status < 500 ? friendlyError : "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
    }, getCorsHeaders(req));
  }
}

module.exports = { safeHandleApi };
