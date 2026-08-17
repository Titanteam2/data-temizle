const state = {
  user: null,
  users: [],
  promoCodes: [],
  loading: false,
  promoLoading: false,
  error: "",
  promoError: "",
  search: "",
};

const els = {
  appError: document.querySelector("#appError"),
  gate: document.querySelector("#adminGate"),
  dashboard: document.querySelector("#adminDashboard"),
  promoDashboard: document.querySelector("#promoDashboard"),
  logoutButton: document.querySelector("#adminLogoutButton"),
  refreshButton: document.querySelector("#refreshAdminButton"),
  refreshPromoButton: document.querySelector("#refreshPromoButton"),
  search: document.querySelector("#adminSearch"),
  totalUsers: document.querySelector("#adminTotalUsers"),
  proUsers: document.querySelector("#adminProUsers"),
  freeUsers: document.querySelector("#adminFreeUsers"),
  createForm: document.querySelector("#adminCreateForm"),
  createName: document.querySelector("#adminCreateName"),
  createEmail: document.querySelector("#adminCreateEmail"),
  createPassword: document.querySelector("#adminCreatePassword"),
  createPlan: document.querySelector("#adminCreatePlan"),
  table: document.querySelector("#adminTable"),
  status: document.querySelector("#adminStatus"),
  promoCreateForm: document.querySelector("#promoCreateForm"),
  promoCreateCode: document.querySelector("#promoCreateCode"),
  promoTrialDays: document.querySelector("#promoTrialDays"),
  promoMaxRedemptions: document.querySelector("#promoMaxRedemptions"),
  promoExpiresAt: document.querySelector("#promoExpiresAt"),
  promoActive: document.querySelector("#promoActive"),
  promoTable: document.querySelector("#promoTable"),
  promoStatus: document.querySelector("#promoStatus"),
};

els.refreshButton.addEventListener("click", loadUsers);
els.refreshPromoButton.addEventListener("click", loadPromoCodes);
els.search.addEventListener("input", () => {
  state.search = els.search.value;
  renderDashboard();
});
els.table.addEventListener("click", (event) => {
  const planButton = event.target.closest("[data-plan]");
  if (planButton) {
    setUserPlan(planButton.dataset.email, planButton.dataset.plan);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-user]");
  if (!deleteButton) return;
  deleteUser(deleteButton.dataset.email);
});
els.createForm.addEventListener("submit", createUser);
els.promoCreateForm.addEventListener("submit", createPromoCode);
els.logoutButton.addEventListener("click", logout);

init();
initGlobalErrorHandling();

function initGlobalErrorHandling() {
  window.addEventListener("error", () => showAppError("Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin."));
  window.addEventListener("unhandledrejection", () => showAppError("İşlem tamamlanamadı. Bağlantınızı kontrol edin."));
}

function showAppError(message) {
  if (!els.appError) return;
  els.appError.textContent = message;
  els.appError.classList.remove("hidden");
  window.setTimeout(() => els.appError.classList.add("hidden"), 7000);
}

async function init() {
  document.documentElement.dataset.theme = localStorage.getItem("listfix-theme") || "dark";
  try {
    const data = await apiFetch("/api/me");
    state.user = data.user || null;
    if (state.user?.isAdmin) {
      await Promise.all([loadUsers(), loadPromoCodes()]);
    }
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function loadPromoCodes() {
  state.promoLoading = true;
  renderPromoDashboard();
  try {
    const data = await apiFetch("/api/admin/promo-codes");
    state.promoCodes = data.promoCodes || [];
    state.promoError = "";
  } catch (error) {
    state.promoError = error.message;
  } finally {
    state.promoLoading = false;
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

async function loadUsers() {
  state.loading = true;
  renderDashboard();
  try {
    const data = await apiFetch("/api/admin/users");
    state.users = data.users || [];
    state.error = "";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function setUserPlan(email, plan) {
  state.loading = true;
  renderDashboard();
  try {
    const data = await apiFetch("/api/admin/users/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan }),
    });
    state.users = data.users || [];
    state.error = "";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderDashboard();
  }
}

async function createUser(event) {
  event.preventDefault();
  const name = els.createName.value.trim();
  const email = els.createEmail.value.trim();
  const password = els.createPassword.value;
  const plan = els.createPlan.value;
  if (!name || !email || password.length < 6) {
    state.error = "Ad soyad, geçerli e-posta ve en az 6 karakter şifre girin.";
    renderDashboard();
    return;
  }

  state.loading = true;
  renderDashboard();
  try {
    const data = await apiFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, plan }),
    });
    state.users = data.users || [];
    state.error = "";
    els.createForm.reset();
    els.createPlan.value = "free";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderDashboard();
  }
}

async function createPromoCode(event) {
  event.preventDefault();
  const code = els.promoCreateCode.value.trim();
  const trialDays = Number(els.promoTrialDays.value);
  const maxRedemptions = Number(els.promoMaxRedemptions.value);
  const expiresAt = els.promoExpiresAt.value ? new Date(`${els.promoExpiresAt.value}T23:59:59`).toISOString() : null;
  if (!code || !trialDays || !maxRedemptions) {
    state.promoError = "Kod, gün sayısı ve kullanım limiti girin.";
    renderPromoDashboard();
    return;
  }

  state.promoLoading = true;
  renderPromoDashboard();
  try {
    const data = await apiFetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        trialDays,
        maxRedemptions,
        expiresAt,
        active: els.promoActive.checked,
      }),
    });
    state.promoCodes = data.promoCodes || [];
    state.promoError = "";
    els.promoCreateForm.reset();
    els.promoTrialDays.value = "30";
    els.promoMaxRedemptions.value = "100";
    els.promoActive.checked = true;
  } catch (error) {
    state.promoError = error.message;
  } finally {
    state.promoLoading = false;
    renderPromoDashboard();
  }
}

async function deleteUser(email) {
  const user = state.users.find((item) => item.email === email);
  const label = user?.name ? `${user.name} (${email})` : email;
  if (!window.confirm(`${label} kullanıcısını silmek istiyor musun?`)) return;

  state.loading = true;
  renderDashboard();
  try {
    const data = await apiFetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    state.users = data.users || [];
    state.error = "";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderDashboard();
  }
}

async function logout() {
  await apiFetch("/api/logout", { method: "POST" });
  window.location.href = "/index.html";
}

function render() {
  const isAdmin = Boolean(state.user?.isAdmin);
  els.gate.classList.toggle("hidden", isAdmin);
  els.dashboard.classList.toggle("hidden", !isAdmin);
  els.promoDashboard.classList.toggle("hidden", !isAdmin);
  els.logoutButton.classList.toggle("hidden", !state.user);
  if (isAdmin) renderDashboard();
  if (isAdmin) renderPromoDashboard();
  if (!isAdmin && state.error) {
    els.gate.querySelector("p").textContent = state.error;
  }
}

function renderPromoDashboard() {
  els.refreshPromoButton.disabled = state.promoLoading;
  els.promoCreateForm.querySelector("button[type='submit']").disabled = state.promoLoading;

  if (state.promoLoading) {
    els.promoStatus.textContent = "Promosyon kodları yükleniyor.";
  } else if (state.promoError) {
    els.promoStatus.textContent = state.promoError;
  } else {
    els.promoStatus.textContent = `${state.promoCodes.length.toLocaleString("tr-TR")} promosyon kodu gösteriliyor.`;
  }

  if (!state.promoCodes.length) {
    els.promoTable.innerHTML = `<div class="admin-empty">Henüz promosyon kodu yok.</div>`;
    return;
  }

  els.promoTable.innerHTML = `
    <div class="admin-table-row admin-table-head promo-table-row">
      <span>Kod</span>
      <span>Deneme</span>
      <span>Kullanım</span>
      <span>Durum</span>
    </div>
    ${state.promoCodes.map(renderPromoRow).join("")}
  `;
}

function renderPromoRow(promoCode) {
  const expires = promoCode.expiresAt ? new Date(promoCode.expiresAt).toLocaleDateString("tr-TR") : "Süresiz";
  const active = promoCode.active ? "Aktif" : "Pasif";
  return `
    <div class="admin-table-row promo-table-row">
      <span>
        <strong>${escapeHtml(promoCode.code)}</strong>
        <small>${expires}</small>
      </span>
      <span>${Number(promoCode.trialDays || 0).toLocaleString("tr-TR")} gün Pro</span>
      <span>${Number(promoCode.redeemedCount || 0).toLocaleString("tr-TR")} / ${Number(promoCode.maxRedemptions || 0).toLocaleString("tr-TR")}</span>
      <span><i class="plan-badge ${promoCode.active ? "is-pro" : ""}">${active}</i></span>
    </div>
  `;
}

function renderDashboard() {
  const users = getFilteredUsers();
  const proCount = state.users.filter((user) => user.plan === "pro").length;
  const freeCount = state.users.length - proCount;

  els.refreshButton.disabled = state.loading;
  els.totalUsers.textContent = state.users.length.toLocaleString("tr-TR");
  els.proUsers.textContent = proCount.toLocaleString("tr-TR");
  els.freeUsers.textContent = freeCount.toLocaleString("tr-TR");

  if (state.loading) {
    els.status.textContent = "Kullanıcılar yükleniyor.";
  } else if (state.error) {
    els.status.textContent = state.error;
  } else {
    els.status.textContent = `${users.length.toLocaleString("tr-TR")} kullanıcı gösteriliyor.`;
  }

  if (!users.length) {
    els.table.innerHTML = `<div class="admin-empty">Kullanıcı bulunamadı.</div>`;
    return;
  }

  els.table.innerHTML = `
    <div class="admin-table-row admin-table-head">
      <span>Kullanıcı</span>
      <span>Plan</span>
      <span>Kayıt</span>
      <span>İşlem</span>
    </div>
    ${users.map(renderUserRow).join("")}
  `;
}

function renderUserRow(user) {
  const plan = user.plan === "pro" ? "pro" : "free";
  const nextPlan = plan === "pro" ? "free" : "pro";
  const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "Tarih yok";
  return `
    <div class="admin-table-row">
      <span>
        <strong>${escapeHtml(user.name || "İsimsiz kullanıcı")}</strong>
        <small>${escapeHtml(user.email)}${user.isAdmin ? " - Admin" : ""}</small>
      </span>
      <span><i class="plan-badge ${plan === "pro" ? "is-pro" : ""}">${plan === "pro" ? "Pro" : "Free"}</i></span>
      <span>${date}</span>
      <span>
        <button type="button" data-email="${escapeHtml(user.email)}" data-plan="${nextPlan}">
          ${plan === "pro" ? "Free Yap" : "Pro Yap"}
        </button>
        <button class="danger-button" type="button" data-delete-user data-email="${escapeHtml(user.email)}" ${user.isAdmin ? "disabled" : ""}>
          Sil
        </button>
      </span>
    </div>
  `;
}

function getFilteredUsers() {
  const query = state.search.trim().toLocaleLowerCase("tr-TR");
  if (!query) return state.users;
  return state.users.filter((user) => {
    return `${user.name || ""} ${user.email || ""} ${user.plan || ""}`.toLocaleLowerCase("tr-TR").includes(query);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
