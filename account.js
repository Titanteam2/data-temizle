const state = {
  user: null,
  authMode: "login",
  loading: false,
  error: "",
};

const els = {
  appError: document.querySelector("#appError"),
  toastStack: document.querySelector("#toastStack"),
  accountTitle: document.querySelector("#accountTitle"),
  accountSubtitle: document.querySelector("#accountSubtitle"),
  authTabs: document.querySelector("#authTabs"),
  authModeButtons: document.querySelectorAll("[data-auth-mode]"),
  authName: document.querySelector("#authName"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  authStatus: document.querySelector("#authStatus"),
  planName: document.querySelector("#planName"),
  planBadge: document.querySelector("#planBadge"),
  promoCodeInput: document.querySelector("#promoCodeInput"),
  promoCodeButton: document.querySelector("#promoCodeButton"),
  promoStatus: document.querySelector("#promoStatus"),
};

els.authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.authMode = button.dataset.authMode === "register" ? "register" : "login";
    state.error = "";
    render();
  });
});
els.loginButton.addEventListener("click", submitAuth);
els.logoutButton.addEventListener("click", logout);
els.promoCodeButton.addEventListener("click", startPromoTrial);

init();
initGlobalErrorHandling();

function initGlobalErrorHandling() {
  window.addEventListener("error", () => showAppError("Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin."));
  window.addEventListener("unhandledrejection", () => showAppError("İşlem tamamlanamadı. Bağlantınızı kontrol edin."));
}

function showAppError(message) {
  els.appError.textContent = message;
  els.appError.classList.remove("hidden");
  window.setTimeout(() => els.appError.classList.add("hidden"), 7000);
}

function showToast(message, type = "info", title = "") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `
    <span class="toast-dot" aria-hidden="true"></span>
    <span class="toast-content">
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
      <span>${escapeHtml(message)}</span>
    </span>
    <button class="toast-close" type="button" aria-label="Bildirimi kapat">x</button>
  `;
  const close = () => {
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 180);
  };
  toast.querySelector(".toast-close").addEventListener("click", close);
  els.toastStack.append(toast);
  window.setTimeout(close, type === "error" ? 7200 : 5200);
}

async function init() {
  document.documentElement.dataset.theme = localStorage.getItem("listfix-theme") || "dark";
  state.loading = true;
  render();
  try {
    const data = await apiFetch("/api/me");
    state.user = data.user || null;
    state.error = "";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function getApiBase() {
  if (window.location.protocol === "file:") return "http://127.0.0.1:3000";
  return "";
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Sunucu yanıt vermedi.");
  return data;
}

async function submitAuth() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const name = els.authName.value.trim();
  if (!email) return showToast("E-posta adresi yazın.", "warning", "Eksik bilgi");
  if (password.length < 6) return showToast("Şifre en az 6 karakter olmalı.", "warning", "Eksik bilgi");
  if (state.authMode === "register" && !name) return showToast("Ad soyad yazın.", "warning", "Eksik bilgi");

  state.loading = true;
  render();
  try {
    const endpoint = state.authMode === "register" ? "/api/register" : "/api/login";
    const data = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!data.user) {
      state.user = null;
      state.error = data.message || "Kayıt alındı. Devam etmek için e-postanızı doğrulayın.";
      state.authMode = "login";
      showToast(state.error, "success", "Kayıt alındı");
      return;
    }
    state.user = data.user;
    state.error = "";
    state.authMode = "login";
    els.authPassword.value = "";
    showToast("Giriş başarılı.", "success", "Hoş geldiniz");
  } catch (error) {
    state.error = error.message;
    showToast(error.message, "error", "İşlem tamamlanamadı");
  } finally {
    state.loading = false;
    render();
  }
}

async function logout() {
  state.loading = true;
  render();
  try {
    await apiFetch("/api/logout", { method: "POST" });
    state.user = null;
    state.error = "";
    els.authEmail.value = "";
    els.authPassword.value = "";
    els.authName.value = "";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function startPromoTrial() {
  const code = els.promoCodeInput.value.trim();
  if (!state.user) return showToast("Promosyon kodu kullanmak için önce giriş yapın.", "warning", "Giriş gerekli");
  if (!code) return showToast("Promosyon kodunu yazın.", "warning", "Eksik bilgi");

  state.loading = true;
  els.promoStatus.textContent = "Kod kontrol ediliyor.";
  render();
  try {
    const data = await apiFetch("/api/pro-trial/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    els.promoStatus.textContent = data.message || "Kod geçerli. Kart doğrulama adımı hazırlanıyor.";
    showToast(els.promoStatus.textContent, "success", "Promosyon kodu geçerli");
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
  } catch (error) {
    els.promoStatus.textContent = error.message;
    showToast(error.message, "error", "Kod kullanılamadı");
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const isLoggedIn = Boolean(state.user);
  const isPro = state.user?.plan === "pro";
  const accountLabel = state.user?.name || state.user?.email || "";

  els.authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === state.authMode);
  });
  els.authTabs.classList.toggle("hidden", isLoggedIn);
  document.querySelector("#authFields").classList.toggle("hidden", isLoggedIn);
  els.authName.classList.toggle("hidden", state.authMode !== "register");
  els.loginButton.classList.toggle("hidden", isLoggedIn);
  els.logoutButton.classList.toggle("hidden", !isLoggedIn);
  els.loginButton.textContent = state.authMode === "register" ? "Kayıt Ol" : "Giriş Yap";
  els.authPassword.autocomplete = state.authMode === "register" ? "new-password" : "current-password";
  els.authEmail.disabled = state.loading || isLoggedIn;
  els.authName.disabled = state.loading || isLoggedIn;
  els.authPassword.disabled = state.loading || isLoggedIn;
  els.loginButton.disabled = state.loading;
  els.logoutButton.disabled = state.loading;
  els.promoCodeInput.disabled = state.loading || !isLoggedIn || isPro;
  els.promoCodeButton.disabled = state.loading || !isLoggedIn || isPro;

  if (state.user) els.authEmail.value = state.user.email;

  els.accountTitle.textContent = isLoggedIn ? accountLabel : "Giriş yapın";
  els.accountSubtitle.textContent = isLoggedIn
    ? "Dosyalarınız ve üyelik bilgileriniz hesabınıza bağlı çalışır."
    : "Hesabınız yoksa Kayıt Ol sekmesini kullanın.";
  els.planName.textContent = isPro ? "Pro" : "Free";
  els.planBadge.textContent = isPro ? "Pro" : "Free";
  els.planBadge.classList.toggle("is-pro", isPro);

  if (state.loading) {
    els.authStatus.textContent = "Üyelik bilgisi kontrol ediliyor.";
  } else if (state.error) {
    els.authStatus.textContent = state.error;
  } else if (isLoggedIn) {
    els.authStatus.textContent = `${isPro ? "Pro" : "Free"} hesap: ${accountLabel}`;
  } else {
    els.authStatus.textContent = state.authMode === "register"
      ? "Yeni hesap ücretsiz başlar."
      : "Giriş yapınca plan ve promosyon işlemleri açılır.";
  }

  if (!isLoggedIn) {
    els.promoStatus.textContent = "Kod kullanmak için önce giriş yapın.";
  } else if (isPro) {
    els.promoStatus.textContent = "Pro hesabınız aktif olduğu için promosyon kodu gerekmez.";
  } else if (!els.promoStatus.textContent || els.promoStatus.textContent.includes("giriş yapın")) {
    els.promoStatus.textContent = "Kod geçerliyse kart doğrulama adımına geçilir.";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
