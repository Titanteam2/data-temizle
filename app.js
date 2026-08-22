const state = {
  fileName: "",
  headers: [],
  rows: [],
  selectedColumn: "",
  analysis: null,
  lastCleanup: null,
  history: [],
  changePreview: [],
  showColumnsPanel: false,
  smsColumns: new Map(),
  editingSmsColumn: "",
  user: null,
  authLoading: false,
  authError: "",
  authMode: "login",
  splitColumnValue: "",
};

const FREE_ROW_LIMIT = 1000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const allowedUploadExtensions = new Set(["csv", "xlsx", "xls"]);

const exportTemplates = {
  current: { name: "Mevcut kolonlar", columns: [] },
  crm: { name: "Standart CRM", columns: ["Ad", "Soyad", "Telefon", "E-posta", "Şehir", "Not"] },
  whatsapp: { name: "WhatsApp Business", columns: ["First Name", "Last Name", "Phone", "Email"] },
  mailchimp: { name: "Mailchimp", columns: ["Email Address", "First Name", "Last Name", "Phone Number"] },
};

const sampleCsv = `Ad,Soyad,E-posta,Telefon,Şehir,Tutar
  ayse , Yilmaz, ayse@example.com, 0511 111 11 11, Istanbul, 1200
Mehmet, Kaya, mehmet@example, 5111111112, Ankara, 
Ayse,Yilmaz,ayse@example.com,05111111111,Istanbul,1200
Zeynep, Demir, zeynep@example.com, +90 511 111 11 13, Izmir, 950
Can, Toprak, , abc, Istanbul, 700`;

const els = {
  appError: document.querySelector("#appError"),
  toastStack: document.querySelector("#toastStack"),
  fileInput: document.querySelector("#fileInput"),
  uploadZone: document.querySelector(".upload-zone"),
  uploadStatus: document.querySelector("#uploadStatus"),
  fileName: document.querySelector("#fileName"),
  rowCount: document.querySelector("#rowCount"),
  columnCount: document.querySelector("#columnCount"),
  emptyCount: document.querySelector("#emptyCount"),
  duplicateCount: document.querySelector("#duplicateCount"),
  qualityScore: document.querySelector("#qualityScore"),
  emailIssueCount: document.querySelector("#emailIssueCount"),
  phoneIssueCount: document.querySelector("#phoneIssueCount"),
  themeToggle: document.querySelector("#themeToggle"),
  authTabs: document.querySelector("#authTabs"),
  authFields: document.querySelector("#authFields"),
  authModeButtons: document.querySelectorAll("[data-auth-mode]"),
  authName: document.querySelector("#authName"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  upgradeDemoButton: document.querySelector("#upgradeDemoButton"),
  promoCodeInput: document.querySelector("#promoCodeInput"),
  promoCodeButton: document.querySelector("#promoCodeButton"),
  promoStatus: document.querySelector("#promoStatus"),
  accountPlanBadge: document.querySelector("#accountPlanBadge"),
  accountName: document.querySelector("#accountName"),
  planStatus: document.querySelector("#planStatus"),
  usageLimitCard: document.querySelector("#usageLimitCard"),
  usageLimitLabel: document.querySelector("#usageLimitLabel"),
  usageLimitValue: document.querySelector("#usageLimitValue"),
  usageLimitBar: document.querySelector("#usageLimitBar"),
  usageLimitHint: document.querySelector("#usageLimitHint"),
  adminLink: document.querySelector("#adminLink"),
  applyClean: document.querySelector("#applyClean"),
  smartCleanButton: document.querySelector("#smartCleanButton"),
  cleanRecipe: document.querySelector("#cleanRecipe"),
  applyRecipeButton: document.querySelector("#applyRecipeButton"),
  trimWhitespace: document.querySelector("#trimWhitespace"),
  normalizeEmpty: document.querySelector("#normalizeEmpty"),
  removeDuplicates: document.querySelector("#removeDuplicates"),
  normalizeCase: document.querySelector("#normalizeCase"),
  phoneFormat: document.querySelector("#phoneFormat"),
  replaceColumn: document.querySelector("#replaceColumn"),
  findText: document.querySelector("#findText"),
  replaceText: document.querySelector("#replaceText"),
  replaceButton: document.querySelector("#replaceButton"),
  downloadFormat: document.querySelector("#downloadFormat"),
  downloadScopeGroup: document.querySelector("#downloadScopeGroup"),
  downloadScope: document.querySelector("#downloadScope"),
  exportTemplateGroup: document.querySelector("#exportTemplateGroup"),
  exportTemplate: document.querySelector("#exportTemplate"),
  downloadLimitGroup: document.querySelector("#downloadLimitGroup"),
  downloadLimit: document.querySelector("#downloadLimit"),
  downloadLimitManual: document.querySelector("#downloadLimitManual"),
  splitColumnGroup: document.querySelector("#splitColumnGroup"),
  splitColumn: document.querySelector("#splitColumn"),
  downloadInfo: document.querySelector("#downloadInfo"),
  downloadCenterButton: document.querySelector("#downloadCenterButton"),
  smsColumnName: document.querySelector("#smsColumnName"),
  smsTemplate: document.querySelector("#smsTemplate"),
  smsTokenColumn: document.querySelector("#smsTokenColumn"),
  smsPreview: document.querySelector("#smsPreview"),
  smsColumnList: document.querySelector("#smsColumnList"),
  insertSmsTokenButton: document.querySelector("#insertSmsTokenButton"),
  createSmsColumnButton: document.querySelector("#createSmsColumnButton"),
  sampleButton: document.querySelector("#sampleButton"),
  qualityScoreBar: document.querySelector("#qualityScoreBar"),
  lastActionLabel: document.querySelector("#lastActionLabel"),
  undoButton: document.querySelector("#undoButton"),
  cleanupResults: document.querySelector("#cleanupResults"),
  readySegmentCount: document.querySelector("#readySegmentCount"),
  issueSegmentCount: document.querySelector("#issueSegmentCount"),
  detectedFields: document.querySelector("#detectedFields"),
  issuesList: document.querySelector("#issuesList"),
  phoneDetailList: document.querySelector("#phoneDetailList"),
  changePreview: document.querySelector("#changePreview"),
  editorLayout: document.querySelector("#editorLayout"),
  columnTools: document.querySelector("#columnTools"),
  toggleColumnsButton: document.querySelector("#toggleColumnsButton"),
  columnsList: document.querySelector("#columnsList"),
  searchInput: document.querySelector("#searchInput"),
  rowFilter: document.querySelector("#rowFilter"),
  duplicateColumnFilter: document.querySelector("#duplicateColumnFilter"),
  visibleRows: document.querySelector("#visibleRows"),
  dataTable: document.querySelector("#dataTable"),
  emptyState: document.querySelector("#emptyState"),
  columnTemplate: document.querySelector("#columnTemplate"),
};

els.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  await loadFileWithStatus(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  els.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.uploadZone.classList.add("is-dragging");
    setUploadStatus("drop", "Dosyayı bırakın");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === "dragleave" && els.uploadZone.contains(event.relatedTarget)) return;
    els.uploadZone.classList.remove("is-dragging");
    if (eventName === "dragleave") setUploadStatus("idle", state.fileName ? "Dosya yüklendi" : "Dosya bekleniyor");
  });
});

els.uploadZone.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer.files;
  if (!file) return;
  await loadFileWithStatus(file);
});

els.sampleButton.addEventListener("click", () => loadCsv(sampleCsv, "ornek-veri.csv"));
els.authModeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});
els.loginButton?.addEventListener("click", login);
els.logoutButton?.addEventListener("click", logout);
els.upgradeDemoButton?.addEventListener("click", upgradeDemo);
els.promoCodeButton?.addEventListener("click", startPromoTrial);
els.applyClean.addEventListener("click", () => runHeavyAction("Veri temizleniyor", cleanData));
els.applyRecipeButton.addEventListener("click", applyCleanRecipe);
els.undoButton.addEventListener("click", undoLastAction);
els.smartCleanButton.addEventListener("click", () => runHeavyAction("CRM hazırlığı yapılıyor", smartCleanForCrm));
els.phoneFormat.addEventListener("change", () => runHeavyAction("Telefon formatı uygulanıyor", applySelectedPhoneFormat));
els.replaceButton.addEventListener("click", replaceInColumn);
els.changePreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-toggle-preview]");
  if (!button) return;
  els.changePreview.classList.toggle("is-open");
  button.textContent = els.changePreview.classList.contains("is-open") ? "Gizle" : "Detay";
});
els.downloadCenterButton.addEventListener("click", downloadFromCenter);
["change", "input"].forEach((eventName) => {
  [els.downloadFormat, els.downloadScope, els.exportTemplate, els.downloadLimit, els.downloadLimitManual, els.splitColumn].forEach((control) => {
    control.addEventListener(eventName, updateDownloadControls);
  });
});
els.splitColumn.addEventListener("change", () => {
  state.splitColumnValue = els.splitColumn.value;
  updateDownloadControls();
});
els.insertSmsTokenButton.addEventListener("click", insertSmsToken);
els.createSmsColumnButton.addEventListener("click", createSmsColumn);
els.smsTemplate.addEventListener("input", renderSmsPreview);
els.smsColumnName.addEventListener("input", updateSmsControls);
els.smsTokenColumn.addEventListener("change", renderSmsPreview);
els.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});
els.toggleColumnsButton.addEventListener("click", () => {
  state.showColumnsPanel = !state.showColumnsPanel;
  updateColumnsPanelState();
});
els.searchInput.addEventListener("input", renderTable);
els.rowFilter.addEventListener("change", () => {
  updateDuplicateFilterState();
  renderTable();
});

els.duplicateColumnFilter.addEventListener("change", () => {
  els.rowFilter.value = "duplicates";
  updateDuplicateFilterState();
  state.analysis = analyzeData();
  renderStats();
  renderInsights();
  renderTable();
});

initTheme();
initAuth();
initGlobalErrorHandling();

function initGlobalErrorHandling() {
  window.addEventListener("error", () => showAppError("Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin."));
  window.addEventListener("unhandledrejection", () => showAppError("İşlem tamamlanamadı. Bağlantınızı ve dosyanızı kontrol edin."));
}

function showAppError(message) {
  if (!els.appError) return;
  els.appError.textContent = message;
  els.appError.classList.remove("hidden");
  window.setTimeout(() => els.appError.classList.add("hidden"), 7000);
}

function showToast(message, type = "info", title = "") {
  if (!els.toastStack) {
    console[type === "error" ? "error" : "log"](message);
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `
    <span class="toast-dot" aria-hidden="true"></span>
    <span class="toast-content">
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
      <span>${escapeHtml(message)}</span>
    </span>
    <button class="toast-close" type="button" aria-label="Bildirimi kapat">×</button>
  `;
  const close = () => {
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 180);
  };
  toast.querySelector(".toast-close").addEventListener("click", close);
  els.toastStack.append(toast);
  window.setTimeout(close, type === "error" ? 7200 : 5200);
}

function initTheme() {
  const savedTheme = localStorage.getItem("listfix-theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  const isDark = normalizedTheme === "dark";
  document.documentElement.dataset.theme = normalizedTheme;
  els.themeToggle.setAttribute("aria-label", isDark ? "Açık modu aç" : "Koyu modu aç");
  els.themeToggle.title = isDark ? "Açık modu aç" : "Koyu modu aç";
  localStorage.setItem("listfix-theme", normalizedTheme);
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
  if (!response.ok) throw new Error(data.error || "Üyelik sunucusu yanıt vermedi.");
  return data;
}

async function initAuth() {
  state.authLoading = true;
  updatePlanState();
  try {
    const data = await apiFetch("/api/me");
    state.user = data.user || null;
    state.authError = "";
  } catch (error) {
    state.user = null;
    state.authError = `${error.message} Üyelik için Node sunucusu açık olmalı.`;
  } finally {
    state.authLoading = false;
    updatePlanState();
    updateDownloadControls();
  }
}

function setAuthMode(mode) {
  state.authMode = mode === "register" ? "register" : "login";
  updatePlanState();
}

async function login() {
  if (!els.authEmail || !els.authPassword) return;
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const name = els.authName?.value.trim() || "";
  if (!email) {
    showToast("Giriş için e-posta adresi yazın.", "warning", "Eksik bilgi");
    return;
  }
  if (password.length < 6) {
    showToast("Şifre en az 6 karakter olmalı.", "warning", "Eksik bilgi");
    return;
  }
  if (state.authMode === "register" && !name) {
    showToast("Kayıt için ad soyad yazın.", "warning", "Eksik bilgi");
    return;
  }

  state.authLoading = true;
  updatePlanState();
  try {
    const endpoint = state.authMode === "register" ? "/api/register" : "/api/login";
    const data = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!data.user) {
      state.user = null;
      state.authError = data.message || "Kayıt alındı. Devam etmek için e-postanızı doğrulayın.";
      showToast(state.authError, "success", "Kayıt alındı");
      setAuthMode("login");
      return;
    }
    state.user = data.user;
    state.authError = "";
    els.authEmail.value = data.user.email;
    els.authPassword.value = "";
    setAuthMode("login");
    showToast("Giriş başarılı. Artık dosyalarınız hesabınıza bağlı çalışır.", "success", "Hoş geldiniz");
    render();
  } catch (error) {
    state.authError = error.message;
    showToast(error.message, "error", "İşlem tamamlanamadı");
  } finally {
    state.authLoading = false;
    updatePlanState();
    updateDownloadControls();
  }
}

async function logout() {
  state.authLoading = true;
  updatePlanState();
  try {
    await apiFetch("/api/logout", { method: "POST" });
    state.user = null;
    state.authError = "";
    if (els.authEmail) els.authEmail.value = "";
    if (els.authPassword) els.authPassword.value = "";
    if (els.authName) els.authName.value = "";
    render();
  } catch {
    state.authError = "Çıkış yapılırken sunucuya ulaşılamadı.";
  } finally {
    state.authLoading = false;
    updatePlanState();
    updateDownloadControls();
  }
}

async function upgradeDemo() {
  state.authLoading = true;
  updatePlanState();
  try {
    const data = await apiFetch("/api/upgrade-demo", { method: "POST" });
    state.user = data.user;
    state.authError = "";
    render();
  } catch (error) {
    state.authError = error.message;
    showToast(error.message, "error", "İşlem tamamlanamadı");
  } finally {
    state.authLoading = false;
    updatePlanState();
    updateDownloadControls();
  }
}

async function startPromoTrial() {
  if (!els.promoCodeInput || !els.promoStatus) return;
  const code = els.promoCodeInput.value.trim();
  if (!state.user) {
    showToast("Promosyon kodu kullanmak için önce giriş yapın.", "warning", "Giriş gerekli");
    return;
  }
  if (!code) {
    showToast("Promosyon kodunu yazın.", "warning", "Eksik bilgi");
    return;
  }

  state.authLoading = true;
  els.promoStatus.textContent = "Kod kontrol ediliyor.";
  updatePlanState();
  try {
    const data = await apiFetch("/api/pro-trial/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    els.promoStatus.textContent = data.message || "Kod geçerli. Kart doğrulama adımı hazırlanıyor.";
    showToast(els.promoStatus.textContent, "success", "Promosyon kodu geçerli");
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  } catch (error) {
    els.promoStatus.textContent = error.message;
    showToast(error.message, "error", "Kod kullanılamadı");
  } finally {
    state.authLoading = false;
    updatePlanState();
  }
}

async function loadFileWithStatus(file) {
  const validationError = validateUploadFile(file);
  if (validationError) {
    setUploadStatus("error", validationError);
    showToast(validationError, "warning", "Dosya yüklenemedi");
    return;
  }

  setUploadStatus("loading", `${file.name} okunuyor`);
  els.uploadZone.classList.add("is-loading");
  try {
    await loadFile(file);
    if (state.user) {
      setUploadStatus("loading", `${file.name} güvenli alana kaydediliyor`);
      await uploadOriginalFile(file);
      setUploadStatus("success", `${file.name} yüklendi ve hesabınıza kaydedildi`);
    } else {
      setUploadStatus("success", `${file.name} yerel olarak yüklendi`);
    }
  } catch (error) {
    console.error(error);
    const message = error.message || "Dosya okunamadı. Lütfen dosya formatını kontrol edin.";
    setUploadStatus("error", message);
    showToast(message, "error", "Dosya okunamadı");
  } finally {
    els.uploadZone.classList.remove("is-loading", "is-dragging");
  }
}

function setUploadStatus(status, message) {
  els.uploadStatus.textContent = message;
  els.uploadStatus.dataset.status = status;
}

function runHeavyAction(message, action) {
  setUploadStatus("loading", message);
  els.uploadZone.classList.add("is-loading");
  els.applyClean.disabled = true;
  els.smartCleanButton.disabled = true;
  window.setTimeout(() => {
    try {
      action();
      setUploadStatus("success", state.fileName ? "İşlem tamamlandı" : "Dosya bekleniyor");
    } catch (error) {
      console.error(error);
      setUploadStatus("error", "İşlem tamamlanamadı");
      showToast(error.message || "İşlem tamamlanamadı.", "error", "İşlem tamamlanamadı");
    } finally {
      els.uploadZone.classList.remove("is-loading");
      updatePlanState();
    }
  }, 30);
}

async function loadFile(file) {
  const extension = file.name.split(".").pop().toLocaleLowerCase("tr-TR");
  if (["xlsx", "xls"].includes(extension)) {
    await loadExcel(file);
    return;
  }

  if (extension !== "csv") {
    throw new Error("Unsupported file type");
  }

  const text = await decodeCsvFile(file);
  loadCsv(text, file.name);
}

function validateUploadFile(file) {
  const extension = file.name.split(".").pop().toLocaleLowerCase("tr-TR");
  if (!allowedUploadExtensions.has(extension)) return "Sadece CSV, XLSX ve XLS dosyası yükleyebilirsiniz.";
  if (file.size > MAX_UPLOAD_BYTES) return `Dosya boyutu en fazla ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB olabilir.`;
  if (!file.size) return "Boş dosya yüklenemez.";
  return "";
}

async function uploadOriginalFile(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(`${getApiBase()}/api/files/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawError = String(data.error || "");
    const friendlyError = rawError.includes("Invalid key")
      ? "Dosya adı güvenli alana uygun hale getirilemedi. Lütfen dosyayı tekrar yükleyin."
      : rawError || "Dosya güvenli alana kaydedilemedi.";
    throw new Error(friendlyError);
  }
  return data;
}

function loadCsv(text, fileName) {
  const delimiter = detectDelimiter(text);
  const records = parseCsv(text, delimiter);
  loadRecords(records, fileName);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const encodings = ["utf-8", "windows-1254", "iso-8859-9"];
  const decoded = encodings.map((encoding) => {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      return { encoding, text: stripBom(text), score: countDecodeProblems(text) };
    } catch {
      return null;
    }
  }).filter(Boolean);

  decoded.sort((a, b) => a.score - b.score);
  const best = decoded[0];
  if (best?.encoding && best.encoding !== "utf-8") {
    showToast(`${file.name} ${best.encoding.toUpperCase()} olarak okundu.`, "info", "Türkçe karakterler düzeltildi");
  }
  return best?.text || stripBom(await file.text());
}

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function countDecodeProblems(text) {
  const value = String(text || "");
  const replacementChars = (value.match(/\uFFFD/g) || []).length * 100;
  const mojibake = (value.match(/Ã.|Ä.|Å.|�/g) || []).length * 25;
  return replacementChars + mojibake;
}

async function loadExcel(file) {
  const xlsx = window.XLSX;
  if (!xlsx) {
    showToast("Excel desteği yüklenemedi. xlsx.full.min.js dosyasını kontrol edin.", "error", "Excel okunamadı");
    return;
  }

  const data = await file.arrayBuffer();
  const workbook = xlsx.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    showToast("Excel dosyasında okunabilir sayfa bulunamadı.", "warning", "Excel okunamadı");
    return;
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const records = xlsx.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  loadRecords(records, file.name);
}

function loadRecords(records, fileName) {
  const [headers = [], ...rows] = records
    .map((row) => row.map((cell) => String(cell ?? "")))
    .filter((row) => row.some((cell) => cell.trim()));

  state.fileName = fileName;
  state.headers = uniquifyHeaders(headers.map((header, index) => header.trim() || `Kolon ${index + 1}`));
  state.rows = rows.map((row) => normalizeRowLength(row, state.headers.length));
  state.selectedColumn = state.headers[0] || "";
  state.lastCleanup = null;
  state.changePreview = [];
  state.history = [];
  state.splitColumnValue = "";
  state.smsColumns.clear();
  state.editingSmsColumn = "";
  els.rowFilter.value = "all";
  els.duplicateColumnFilter.value = "__row__";

  render();
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function normalizeRowLength(row, length) {
  return Array.from({ length }, (_, index) => row[index] ?? "");
}

function uniquifyHeaders(headers) {
  const seen = new Map();
  return headers.map((header) => {
    const count = seen.get(header) || 0;
    seen.set(header, count + 1);
    return count ? `${header} ${count + 1}` : header;
  });
}

function pushHistory(label) {
  if (!state.headers.length && !state.rows.length) return;
  state.history.push({
    label,
    fileName: state.fileName,
    headers: [...state.headers],
    rows: state.rows.map((row) => [...row]),
    selectedColumn: state.selectedColumn,
    lastCleanup: state.lastCleanup ? { ...state.lastCleanup } : null,
    smsColumns: [...state.smsColumns.entries()].map(([header, config]) => [header, { ...config }]),
    editingSmsColumn: state.editingSmsColumn,
    showColumnsPanel: state.showColumnsPanel,
    rowFilter: els.rowFilter.value,
    duplicateColumnFilter: els.duplicateColumnFilter.value,
    splitColumnValue: state.splitColumnValue,
  });

  if (state.history.length > 20) state.history.shift();
}

function getPreviewSnapshot() {
  return {
    headers: [...state.headers],
    rows: state.rows.slice(0, 20).map((row) => [...row]),
  };
}

function captureChangePreview(action, before) {
  const changes = [];
  const maxRows = Math.max(before.rows.length, Math.min(state.rows.length, 20));
  const maxColumns = Math.max(before.headers.length, state.headers.length);

  for (let columnIndex = 0; columnIndex < maxColumns && changes.length < 4; columnIndex += 1) {
    const oldHeader = before.headers[columnIndex] ?? "";
    const newHeader = state.headers[columnIndex] ?? "";
    if (String(oldHeader) === String(newHeader)) continue;
    changes.push({
      action,
      rowNumber: 0,
      header: "Kolon başlığı",
      before: oldHeader,
      after: newHeader,
    });
  }

  for (let rowIndex = 0; rowIndex < maxRows && changes.length < 4; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < maxColumns && changes.length < 4; columnIndex += 1) {
      const header = state.headers[columnIndex] || before.headers[columnIndex] || `Kolon ${columnIndex + 1}`;
      const oldValue = before.rows[rowIndex]?.[columnIndex] ?? "";
      const newValue = state.rows[rowIndex]?.[columnIndex] ?? "";
      if (String(oldValue) === String(newValue)) continue;
      if (!shouldShowChangePreview(header, oldValue, newValue)) continue;
      changes.push({
        action,
        rowNumber: rowIndex + 1,
        header,
        before: oldValue,
        after: newValue,
      });
    }
  }

  state.changePreview = changes;
}

function shouldShowChangePreview(header, before, after) {
  const oldValue = String(before ?? "");
  const newValue = String(after ?? "");
  if (!oldValue.trim() || !newValue.trim()) return true;

  const normalizedHeader = normalizeHeader(header);
  if (["telefon", "phone", "gsm", "mobile", "cep"].some((pattern) => normalizedHeader.includes(pattern))) return true;
  if (["eposta", "e posta", "email", "mail"].some((pattern) => normalizedHeader.includes(pattern))) return true;
  if (oldValue.replace(/\D/g, "") !== newValue.replace(/\D/g, "")) return true;
  if (oldValue.trim().toLocaleLowerCase("tr-TR") === newValue.trim().toLocaleLowerCase("tr-TR")) return false;
  return Math.abs(oldValue.length - newValue.length) > 2;
}

function undoLastAction() {
  const snapshot = state.history.pop();
  if (!snapshot) return;

  state.fileName = snapshot.fileName;
  state.headers = [...snapshot.headers];
  state.rows = snapshot.rows.map((row) => [...row]);
  state.selectedColumn = snapshot.selectedColumn;
  state.lastCleanup = {
    action: `${snapshot.label} geri alındı`,
    scoreDelta: 0,
    removedRows: 0,
    emptyDelta: 0,
    duplicateDelta: 0,
    emailDelta: 0,
    phoneDelta: 0,
  };
  state.changePreview = [];
  state.smsColumns = new Map(snapshot.smsColumns.map(([header, config]) => [header, { ...config }]));
  state.editingSmsColumn = snapshot.editingSmsColumn;
  state.showColumnsPanel = snapshot.showColumnsPanel;
  state.splitColumnValue = snapshot.splitColumnValue;
  els.rowFilter.value = snapshot.rowFilter || "all";
  els.duplicateColumnFilter.value = snapshot.duplicateColumnFilter || "__row__";
  render();
}

function applyCleanRecipe() {
  const recipes = {
    sms: {
      trimWhitespace: true,
      normalizeEmpty: true,
      removeDuplicates: true,
      normalizeCase: false,
      phoneFormat: "localDigits",
      label: "SMS kampanya listesi",
    },
    crm: {
      trimWhitespace: true,
      normalizeEmpty: true,
      removeDuplicates: true,
      normalizeCase: true,
      phoneFormat: "international",
      label: "CRM aktarım listesi",
    },
    email: {
      trimWhitespace: true,
      normalizeEmpty: true,
      removeDuplicates: true,
      normalizeCase: true,
      phoneFormat: "international",
      label: "E-posta kampanyası",
    },
    call: {
      trimWhitespace: true,
      normalizeEmpty: true,
      removeDuplicates: true,
      normalizeCase: false,
      phoneFormat: "international",
      label: "Çağrı merkezi listesi",
    },
  };
  const recipe = recipes[els.cleanRecipe.value] || recipes.sms;
  els.trimWhitespace.checked = recipe.trimWhitespace;
  els.normalizeEmpty.checked = recipe.normalizeEmpty;
  els.removeDuplicates.checked = recipe.removeDuplicates;
  els.normalizeCase.checked = recipe.normalizeCase;
  els.phoneFormat.value = recipe.phoneFormat;
  state.lastCleanup = {
    action: `${recipe.label} reçetesi seçildi`,
    scoreDelta: 0,
    removedRows: 0,
    emptyDelta: 0,
    duplicateDelta: 0,
    emailDelta: 0,
    phoneDelta: 0,
  };
  state.changePreview = [];
  renderCleanupResults();
  renderChangePreview();
}

function cleanData() {
  if (!canUseFreeRows()) return showPlanLimitMessage();
  pushHistory("Temizle");
  const previewBefore = getPreviewSnapshot();
  const before = analyzeData();
  const beforeRows = state.rows.length;
  cleanRowsWithSelectedOptions();

  if (els.removeDuplicates.checked) {
    const seen = new Set();
    state.rows = state.rows.filter((row) => {
      const key = getDuplicateKey(row);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  captureCleanupResult("Temizle", before, beforeRows);
  captureChangePreview("Temizle", previewBefore);
  render();
}

function smartCleanForCrm() {
  if (!canUseFreeRows()) return showPlanLimitMessage();
  pushHistory("CRM İçin Hazırla");
  const previewBefore = getPreviewSnapshot();
  const before = analyzeData();
  const beforeRows = state.rows.length;
  cleanRowsWithSelectedOptions();
  const fields = detectFields();

  state.rows = state.rows.map((row) => {
    const next = [...row];
    [fields.firstName, fields.lastName, fields.city].forEach((index) => {
      if (index >= 0) next[index] = toTitleCase(String(next[index]).trim());
    });
    if (fields.email >= 0) next[fields.email] = String(next[fields.email]).trim().toLocaleLowerCase("tr-TR");
    if (fields.phone >= 0) next[fields.phone] = normalizePhone(next[fields.phone], els.phoneFormat.value);
    return next;
  });

  const seen = new Set();
  state.rows = state.rows.filter((row) => {
    const keyParts = [fields.email, fields.phone]
      .filter((index) => index >= 0)
      .map((index) => row[index])
      .filter(Boolean);
    const key = keyParts.length ? keyParts.join("|") : JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  captureCleanupResult("CRM İçin Hazırla", before, beforeRows);
  captureChangePreview("CRM İçin Hazırla", previewBefore);
  render();
}

function cleanRowsWithSelectedOptions() {
  state.rows = state.rows.map((row) =>
    row.map((cell) => {
      let value = cell;
      if (els.trimWhitespace.checked) value = value.trim().replace(/\s+/g, " ");
      if (els.normalizeEmpty.checked && ["", "null", "undefined", "n/a", "na", "-"].includes(value.toLowerCase())) {
        value = "";
      }
      if (els.normalizeCase.checked && shouldTitleCase(value)) {
        value = toTitleCase(value);
      }
      return value;
    }),
  );
  formatPhoneRows();
}

function applySelectedPhoneFormat() {
  if (!state.rows.length) return;
  if (!canUseFreeRows()) return showPlanLimitMessage();
  const fields = detectFields();
  if (fields.phone < 0) {
    showToast("Kolon adında Telefon, GSM, Mobile veya Cep gibi bir başlık olmalı.", "warning", "Telefon kolonu bulunamadı");
    return;
  }

  pushHistory("Telefon Formatı");
  const previewBefore = getPreviewSnapshot();
  const before = analyzeData();
  const beforeRows = state.rows.length;
  formatPhoneRows(fields.phone);
  captureCleanupResult("Telefon Formatı", before, beforeRows);
  captureChangePreview("Telefon Formatı", previewBefore);
  render();
}

function formatPhoneRows(phoneIndex = detectFields().phone) {
  if (phoneIndex < 0) return;
  state.rows = state.rows.map((row) => {
    const next = [...row];
    next[phoneIndex] = normalizePhone(next[phoneIndex], els.phoneFormat.value);
    return next;
  });
}

function captureCleanupResult(action, before, beforeRows) {
  const after = analyzeData();
  state.lastCleanup = {
    action,
    scoreDelta: after.score - before.score,
    removedRows: Math.max(0, beforeRows - state.rows.length),
    emptyDelta: Math.max(0, before.emptyCells - after.emptyCells),
    duplicateDelta: Math.max(0, before.duplicates - after.duplicates),
    emailDelta: Math.max(0, before.emailIssues - after.emailIssues),
    phoneDelta: Math.max(0, before.phoneIssues - after.phoneIssues),
  };
}

function toTitleCase(value) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

function shouldTitleCase(value) {
  if (!value || !Number.isNaN(Number(value))) return false;
  if (value.includes("@") || /^https?:\/\//i.test(value)) return false;
  return /[a-zA-ZığüşöçİĞÜŞÖÇ]/.test(value);
}

function normalizePhone(value, format = "international") {
  const local = getLocalPhoneDigits(value);
  if (!local) return "";
  if (local.length !== 10) return String(value).trim();
  if (format === "localDigits") return local;
  return `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
}

function getLocalPhoneDigits(value) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("90") && local.length === 12) local = local.slice(2);
  if (local.startsWith("0") && local.length === 11) local = local.slice(1);
  return local;
}

function replaceInColumn() {
  if (!canUseFreeRows()) return showPlanLimitMessage();
  const column = els.replaceColumn.value;
  const find = els.findText.value;
  if (!column || find === "") return;

  pushHistory("Bul ve Değiştir");
  const previewBefore = getPreviewSnapshot();
  const columnIndex = state.headers.indexOf(column);
  state.rows = state.rows.map((row) => {
    const next = [...row];
    next[columnIndex] = String(next[columnIndex]).replaceAll(find, els.replaceText.value);
    return next;
  });

  captureChangePreview("Bul ve Değiştir", previewBefore);
  render();
}

function renameColumn(oldName, newName) {
  const cleanName = newName.trim();
  if (!cleanName) return;

  const index = state.headers.indexOf(oldName);
  if (index < 0) return;

  pushHistory("Kolon Adlandır");
  const previewBefore = getPreviewSnapshot();
  const nextHeaders = [...state.headers];
  nextHeaders[index] = cleanName;
  state.headers = uniquifyHeaders(nextHeaders);
  state.selectedColumn = state.headers[index];
  if (state.smsColumns.has(oldName)) {
    const config = state.smsColumns.get(oldName);
    state.smsColumns.delete(oldName);
    state.smsColumns.set(state.headers[index], config);
    if (state.editingSmsColumn === oldName) state.editingSmsColumn = state.headers[index];
  }
  captureChangePreview("Kolon Adlandır", previewBefore);
  render();
}

function renderSmsOptions() {
  const currentValue = els.smsTokenColumn.value;
  els.smsTokenColumn.replaceChildren();

  if (!state.headers.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Kolon yok";
    els.smsTokenColumn.append(option);
    updateSmsControls();
    return;
  }

  state.headers.forEach((header) => {
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    els.smsTokenColumn.append(option);
  });

  const values = new Set([...els.smsTokenColumn.options].map((option) => option.value));
  els.smsTokenColumn.value = values.has(currentValue) ? currentValue : state.headers[0];
  updateSmsControls();
}

function updateSmsControls() {
  const hasRows = state.rows.length > 0;
  const hasTemplate = els.smsTemplate.value.trim().length > 0;
  const hasColumnName = els.smsColumnName.value.trim().length > 0;
  els.insertSmsTokenButton.disabled = !isProPlan() || !state.headers.length;
  els.createSmsColumnButton.disabled = !isProPlan() || !hasRows || !hasTemplate || !hasColumnName;
  els.createSmsColumnButton.textContent = state.editingSmsColumn ? "SMS Kolonunu Güncelle" : "SMS Kolonu Oluştur";
}

function insertSmsToken() {
  const header = els.smsTokenColumn.value;
  if (!header) return;

  const token = `{${header}}`;
  const start = els.smsTemplate.selectionStart ?? els.smsTemplate.value.length;
  const end = els.smsTemplate.selectionEnd ?? els.smsTemplate.value.length;
  els.smsTemplate.value = `${els.smsTemplate.value.slice(0, start)}${token}${els.smsTemplate.value.slice(end)}`;
  els.smsTemplate.focus();
  els.smsTemplate.setSelectionRange(start + token.length, start + token.length);
  renderSmsPreview();
  updateSmsControls();
}

function renderSmsPreview() {
  updateSmsControls();
  if (!state.rows.length) {
    els.smsPreview.textContent = "Veri yükleyince SMS önizlemesi burada görünür.";
    return;
  }

  const template = els.smsTemplate.value.trim();
  if (!template) {
    els.smsPreview.textContent = "SMS metni yazınca ilk satır önizlemesi burada görünür.";
    return;
  }

  els.smsPreview.textContent = renderTemplateForRow(template, state.rows[0]);
}

function renderSmsColumnList() {
  els.smsColumnList.replaceChildren();
  if (!state.smsColumns.size) return;

  state.smsColumns.forEach((config, header) => {
    const item = document.createElement("div");
    item.className = "sms-column-item";

    const label = document.createElement("span");
    label.textContent = header;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Düzenle";
    editButton.addEventListener("click", () => editSmsColumn(header));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Sil";
    deleteButton.addEventListener("click", () => deleteColumn(header));

    item.append(label, editButton, deleteButton);
    els.smsColumnList.append(item);
  });
}

function createSmsColumn() {
  if (!isProPlan()) return showProRequiredMessage("SMS metni Pro pakette kullanılabilir.");
  const template = els.smsTemplate.value.trim();
  const columnName = els.smsColumnName.value.trim();
  if (!template || !columnName || !state.rows.length) return;

  const editingIndex = state.editingSmsColumn ? state.headers.indexOf(state.editingSmsColumn) : -1;
  pushHistory(editingIndex >= 0 ? "SMS Kolonu Güncelle" : "SMS Kolonu Oluştur");
  const previewBefore = getPreviewSnapshot();
  let smsColumnName = "";
  if (editingIndex >= 0) {
    const nextHeaders = [...state.headers];
    nextHeaders[editingIndex] = columnName;
    state.headers = uniquifyHeaders(nextHeaders);
    smsColumnName = state.headers[editingIndex];
    state.rows = state.rows.map((row) => {
      const next = [...row];
      next[editingIndex] = renderTemplateForRow(template, row);
      return next;
    });
    state.smsColumns.delete(state.editingSmsColumn);
  } else {
    const nextHeaders = uniquifyHeaders([...state.headers, columnName]);
    smsColumnName = nextHeaders[nextHeaders.length - 1];
    state.headers = nextHeaders;
    state.rows = state.rows.map((row) => [...row, renderTemplateForRow(template, row)]);
  }
  state.smsColumns.set(smsColumnName, { template });
  state.editingSmsColumn = "";
  state.selectedColumn = smsColumnName;
  state.lastCleanup = {
    action: editingIndex >= 0 ? "SMS Kolonu Güncelle" : "SMS Kolonu Oluştur",
    scoreDelta: 0,
    removedRows: 0,
    emptyDelta: 0,
    duplicateDelta: 0,
    emailDelta: 0,
    phoneDelta: 0,
  };
  captureChangePreview(state.lastCleanup.action, previewBefore);
  render();
}

function editSmsColumn(header) {
  const config = state.smsColumns.get(header);
  if (!config) return;
  els.smsColumnName.value = header;
  els.smsTemplate.value = config.template;
  state.editingSmsColumn = header;
  state.showColumnsPanel = false;
  render();
  els.smsTemplate.focus();
}

function deleteColumn(header) {
  const index = state.headers.indexOf(header);
  if (index < 0) return;
  pushHistory("Kolon Sil");
  const previewBefore = getPreviewSnapshot();
  state.headers.splice(index, 1);
  state.rows = state.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index));
  state.smsColumns.delete(header);
  if (state.editingSmsColumn === header) {
    state.editingSmsColumn = "";
    els.smsColumnName.value = "SMS Metni";
    els.smsTemplate.value = "";
  }
  state.selectedColumn = state.headers[0] || "";
  state.lastCleanup = {
    action: "Kolon Sil",
    scoreDelta: 0,
    removedRows: 0,
    emptyDelta: 0,
    duplicateDelta: 0,
    emailDelta: 0,
    phoneDelta: 0,
  };
  captureChangePreview("Kolon Sil", previewBefore);
  render();
}

function renderTemplateForRow(template, row) {
  return template.replace(/\{([^{}]+)\}/g, (match, header) => {
    const index = findHeaderIndex(header);
    if (index < 0) return "";
    return String(row[index] ?? "").trim();
  });
}

function findHeaderIndex(header) {
  const normalizedTarget = normalizeHeader(header);
  return state.headers.findIndex((candidate) => normalizeHeader(candidate) === normalizedTarget);
}

function render() {
  els.fileName.textContent = state.fileName || "Henüz dosya seçilmedi";
  renderDuplicateOptions();
  updateDuplicateFilterState();
  state.analysis = analyzeData();
  renderStats();
  renderSegments();
  renderColumns();
  renderReplaceOptions();
  renderSplitOptions();
  renderSmsOptions();
  renderSmsPreview();
  renderSmsColumnList();
  renderInsights();
  renderCleanupResults();
  renderChangePreview();
  renderTable();
  updatePlanState();
  updateDownloadControls();
}

function isProPlan() {
  return state.user?.plan === "pro";
}

function canUseFreeRows() {
  return isProPlan() || state.rows.length <= FREE_ROW_LIMIT;
}

function updatePlanState() {
  const hasRows = state.rows.length > 0;
  const freeLimitReached = hasRows && !canUseFreeRows();
  const canUseBasic = hasRows && canUseFreeRows();
  const canUsePro = hasRows && isProPlan();

  els.authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === state.authMode);
  });
  els.authTabs?.classList.toggle("hidden", Boolean(state.user));
  els.authFields?.classList.toggle("hidden", Boolean(state.user));
  els.authName?.classList.toggle("hidden", state.authMode !== "register");
  if (els.authEmail) els.authEmail.disabled = state.authLoading || Boolean(state.user);
  if (els.authName) els.authName.disabled = state.authLoading || Boolean(state.user);
  if (els.authPassword) els.authPassword.disabled = state.authLoading || Boolean(state.user);
  if (els.loginButton) els.loginButton.disabled = state.authLoading;
  if (els.logoutButton) els.logoutButton.disabled = state.authLoading;
  if (els.upgradeDemoButton) els.upgradeDemoButton.disabled = state.authLoading;
  if (els.promoCodeInput) els.promoCodeInput.disabled = state.authLoading || !state.user || isProPlan();
  if (els.promoCodeButton) els.promoCodeButton.disabled = state.authLoading || !state.user || isProPlan();
  els.loginButton?.classList.toggle("hidden", Boolean(state.user));
  els.logoutButton?.classList.toggle("hidden", !state.user);
  els.upgradeDemoButton?.classList.toggle("hidden", !state.user || isProPlan());
  els.adminLink.classList.toggle("hidden", !state.user?.isAdmin);
  if (els.loginButton) els.loginButton.textContent = state.authMode === "register" ? "Kayıt Ol" : "Giriş Yap";
  if (els.authPassword) els.authPassword.autocomplete = state.authMode === "register" ? "new-password" : "current-password";

  if (state.user && els.authEmail) {
    els.authEmail.value = state.user.email;
  }

  const accountLabel = state.user?.name || state.user?.email;
  if (els.accountName) els.accountName.textContent = accountLabel || "Giriş yapılmadı";
  if (els.accountPlanBadge) {
    els.accountPlanBadge.textContent = isProPlan() ? "Pro" : "Free";
    els.accountPlanBadge.classList.toggle("is-pro", isProPlan());
  }
  if (state.authLoading) {
    els.planStatus.textContent = "Üyelik bilgisi kontrol ediliyor.";
  } else if (state.authError) {
    els.planStatus.textContent = state.authError;
  } else if (!state.user) {
    els.planStatus.textContent = state.authMode === "register"
      ? "Yeni hesap ücretsiz başlar. Pro özellikler ödeme bağlanınca lisansla açılır."
      : "Hesabınız varsa giriş yapın; yoksa Kayıt Ol sekmesini kullanın.";
    if (els.promoStatus) els.promoStatus.textContent = "Promosyon kodu kullanmak için önce giriş yapın.";
  } else if (freeLimitReached) {
    els.planStatus.textContent = `${state.rows.length.toLocaleString("tr-TR")} satır yüklendi. Ücretsiz paket 1.000 satıra kadar çalışır; Pro lisans gerekir.`;
  } else if (isProPlan()) {
    els.planStatus.textContent = `Pro aktif: ${accountLabel}`;
    if (els.promoStatus) els.promoStatus.textContent = "Pro hesabınız aktif olduğu için promosyon kodu gerekmez.";
  } else if (!hasRows) {
    els.planStatus.textContent = `Ücretsiz hesap: ${accountLabel}`;
    if (els.promoStatus && (!els.promoStatus.textContent || els.promoStatus.textContent.includes("giriş yapın"))) {
      els.promoStatus.textContent = "Kod geçerliyse kart doğrulama adımına geçilir.";
    }
  } else {
    els.planStatus.textContent = `${state.rows.length.toLocaleString("tr-TR")} / ${FREE_ROW_LIMIT.toLocaleString("tr-TR")} satır kullanılıyor. Excel, ZIP, SMS ve segment indirme Pro özelliği olarak gösterilir.`;
    if (els.promoStatus && (!els.promoStatus.textContent || els.promoStatus.textContent.includes("giriş yapın"))) {
      els.promoStatus.textContent = "Kod geçerliyse kart doğrulama adımına geçilir.";
    }
  }

  els.applyClean.disabled = !canUseBasic;
  els.smartCleanButton.disabled = !canUseBasic;
  els.replaceButton.disabled = !canUseBasic;
  els.downloadCenterButton.disabled = !canDownloadFromCenter();
  updateSmsControls();
  updateUsageLimitCard();
}

function updateUsageLimitCard() {
  const rowCount = state.rows.length;
  const isPro = isProPlan();
  const usageRatio = isPro ? 1 : Math.min(rowCount / FREE_ROW_LIMIT, 1);
  const percent = Math.round(usageRatio * 100);

  els.usageLimitCard.classList.toggle("is-pro", isPro);
  els.usageLimitCard.classList.toggle("is-over", !isPro && rowCount > FREE_ROW_LIMIT);
  els.usageLimitBar.style.width = `${percent}%`;

  if (isPro) {
    els.usageLimitLabel.textContent = "Pro kullanım";
    els.usageLimitValue.textContent = "Sınırsız";
    els.usageLimitHint.textContent = rowCount
      ? `${rowCount.toLocaleString("tr-TR")} satırlık dosya Pro kapsamında işlenebilir.`
      : "Pro hesapta Excel, ZIP, SMS ve sınırsız satır açıktır.";
    return;
  }

  els.usageLimitLabel.textContent = "Ücretsiz satır hakkı";
  els.usageLimitValue.textContent = `${rowCount.toLocaleString("tr-TR")} / ${FREE_ROW_LIMIT.toLocaleString("tr-TR")}`;
  if (!rowCount) {
    els.usageLimitHint.textContent = "Dosya yükleyince kullanım durumu görünür.";
  } else if (rowCount > FREE_ROW_LIMIT) {
    els.usageLimitHint.textContent = `${(rowCount - FREE_ROW_LIMIT).toLocaleString("tr-TR")} satır limit dışında. Pro ile sınırsız işlem açılır.`;
  } else {
    els.usageLimitHint.textContent = `${(FREE_ROW_LIMIT - rowCount).toLocaleString("tr-TR")} satır ücretsiz hakkın kaldı.`;
  }
}

function updateDownloadControls() {
  const hasRows = state.rows.length > 0;
  const format = els.downloadFormat.value;
  const scope = els.downloadScope.value;
  const selectedRows = getRowsForDownloadScope(scope);
  const needsPro = downloadNeedsPro(format, scope);
  const showScope = ["csv", "xlsx"].includes(format);
  const showTemplate = format === "template";
  const showLimit = format !== "report";
  const showSplit = format === "splitZip";

  els.downloadScopeGroup.classList.toggle("hidden", !showScope);
  els.exportTemplateGroup.classList.toggle("hidden", !showTemplate);
  els.downloadLimitGroup.classList.toggle("hidden", !showLimit);
  els.splitColumnGroup.classList.toggle("hidden", !showSplit);
  els.exportTemplate.disabled = format !== "template";
  els.downloadScope.disabled = ["report", "template", "splitZip"].includes(format);
  els.splitColumn.disabled = !state.headers.length;
  els.downloadLimit.disabled = format === "report";
  els.downloadLimitManual.classList.toggle("hidden", els.downloadLimit.value !== "manual");
  els.downloadLimitManual.disabled = format === "report" || els.downloadLimit.value !== "manual";
  els.downloadCenterButton.disabled = !canDownloadFromCenter();

  if (!hasRows) {
    els.downloadInfo.textContent = "Veri yükleyince indirme seçenekleri hazırlanır.";
  } else if (!hasValidDownloadLimit()) {
    els.downloadInfo.textContent = "Manuel satır limiti için 1 veya daha büyük bir sayı girin.";
  } else if (needsPro && !isProPlan()) {
    els.downloadInfo.textContent = "Bu indirme seçeneği Pro üyelikte açılır.";
  } else if (format === "report") {
    els.downloadInfo.textContent = "Kalite raporu TXT olarak indirilecek.";
  } else if (format === "template") {
    els.downloadInfo.textContent = `CRM şablonu ${applyDownloadLimit(state.rows).length.toLocaleString("tr-TR")} satırla indirilecek.`;
  } else if (format === "splitZip") {
    const groups = groupRowsByColumn(Number(els.splitColumn.value));
    els.downloadInfo.textContent = `${groups.size.toLocaleString("tr-TR")} Excel dosyası tek ZIP içinde indirilecek${getDownloadLimitLabel()}.`;
  } else {
    els.downloadInfo.textContent = `${selectedRows.length.toLocaleString("tr-TR")} satır ${format === "xlsx" ? "Excel" : "CSV"} olarak indirilecek${getDownloadLimitLabel()}.`;
  }
}

function canDownloadFromCenter() {
  if (!state.rows.length) return false;
  const format = els.downloadFormat.value;
  const scope = els.downloadScope.value;
  if (downloadNeedsPro(format, scope) && !isProPlan()) return false;
  if (!canUseFreeRows() && !isProPlan()) return false;
  if (!hasValidDownloadLimit()) return false;
  if (format === "splitZip") return state.headers.length > 0;
  if (format === "report" || format === "template") return true;
  return getRowsForDownloadScope(scope).length > 0;
}

function downloadNeedsPro(format, scope) {
  if (["xlsx", "template", "splitZip", "report"].includes(format)) return true;
  return !["all", "visible"].includes(scope);
}

function showPlanLimitMessage() {
  showToast(`Ücretsiz paket ${FREE_ROW_LIMIT.toLocaleString("tr-TR")} satıra kadar çalışır. Daha büyük dosyalar için Pro üyelik gerekir.`, "warning", "Paket limiti");
}

function showProRequiredMessage(message) {
  const suffix = state.user ? "Bu hesabı Pro yapmanız gerekir." : "Önce giriş yapıp Pro üyelik tanımlamanız gerekir.";
  showToast(`${message} ${suffix}`, "warning", "Pro gerekli");
}

function updateColumnsPanelState() {
  els.editorLayout.classList.toggle("columns-collapsed", !state.showColumnsPanel);
  els.columnTools.classList.toggle("is-collapsed", !state.showColumnsPanel);
  els.toggleColumnsButton.textContent = state.showColumnsPanel ? "Kapat" : "Aç";
}

function updateDuplicateFilterState() {
  els.duplicateColumnFilter.classList.toggle("hidden", els.rowFilter.value !== "duplicates");
}

function renderStats() {
  els.qualityScore.textContent = state.analysis.score.toLocaleString("tr-TR");
  els.qualityScoreBar.style.width = `${state.analysis.score}%`;
  els.rowCount.textContent = state.rows.length.toLocaleString("tr-TR");
  els.columnCount.textContent = state.headers.length.toLocaleString("tr-TR");
  els.emptyCount.textContent = state.analysis.emptyCells.toLocaleString("tr-TR");
  els.duplicateCount.textContent = state.analysis.duplicates.toLocaleString("tr-TR");
  els.emailIssueCount.textContent = state.analysis.emailIssues.toLocaleString("tr-TR");
  els.phoneIssueCount.textContent = state.analysis.phoneIssues.toLocaleString("tr-TR");
}

function countEmptyCells() {
  let emptyCells = 0;
  state.rows.forEach((row) => {
    row.forEach((cell) => {
      if (String(cell).trim() === "") emptyCells += 1;
    });
  });
  return emptyCells;
}

function countEmptyCellsByColumn() {
  return state.headers
    .map((header, index) => ({
      header,
      count: state.rows.filter((row) => String(row[index] ?? "").trim() === "").length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

function countDuplicates() {
  return buildDuplicateIndex().count;
}

function buildDuplicateIndex() {
  const seen = new Map();
  const duplicateRows = new Set();
  let count = 0;

  state.rows.forEach((row, index) => {
    const key = getDuplicateKey(row);
    if (!key) return;
    if (seen.has(key)) {
      duplicateRows.add(index);
      duplicateRows.add(seen.get(key));
      count += 1;
      return;
    }
    seen.set(key, index);
  });

  return { count, rows: duplicateRows };
}

function getDuplicateBasisLabel() {
  const basis = els.duplicateColumnFilter?.value || "__row__";
  if (basis === "__row__") return "tüm satır";
  const index = Number(basis);
  return state.headers[index] || "seçili kolon";
}

function getDuplicateKey(row) {
  const basis = els.duplicateColumnFilter?.value || "__row__";
  if (basis === "__row__") return JSON.stringify(row.map((cell) => String(cell).trim()));

  const index = Number(basis);
  if (!Number.isInteger(index) || index < 0) return "";

  const fields = detectFields();
  const rawValue = String(row[index] ?? "").trim();
  if (!rawValue) return "";
  if (index === fields.phone) return getLocalPhoneDigits(rawValue);
  if (index === fields.email) return rawValue.toLocaleLowerCase("tr-TR");
  return rawValue.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function renderColumns() {
  els.columnsList.replaceChildren();
  updateColumnsPanelState();

  state.headers.forEach((header) => {
    const item = els.columnTemplate.content.firstElementChild.cloneNode(true);
    const nameButton = item.querySelector(".column-name");
    const input = item.querySelector(".rename-input");
    const button = item.querySelector(".rename-button");
    const actions = item.querySelector(".column-actions");

    nameButton.textContent = header;
    nameButton.classList.toggle("is-selected", header === state.selectedColumn);
    input.value = header;
    nameButton.addEventListener("click", () => {
      state.selectedColumn = header;
      renderColumns();
    });
    button.addEventListener("click", () => renameColumn(header, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") renameColumn(header, input.value);
    });

    if (state.smsColumns.has(header)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Düzenle";
      editButton.addEventListener("click", () => editSmsColumn(header));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger-button";
      deleteButton.textContent = "Sil";
      deleteButton.addEventListener("click", () => deleteColumn(header));

      actions.append(editButton, deleteButton);
    }

    els.columnsList.append(item);
  });
}

function renderReplaceOptions() {
  els.replaceColumn.replaceChildren();
  state.headers.forEach((header) => {
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    els.replaceColumn.append(option);
  });
}

function renderSplitOptions() {
  const currentValue = state.splitColumnValue || els.splitColumn.value;
  els.splitColumn.replaceChildren();

  if (!state.headers.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Kolon yok";
    els.splitColumn.append(option);
    updateDownloadControls();
    return;
  }

  state.headers.forEach((header, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = header;
    els.splitColumn.append(option);
  });

  const values = new Set([...els.splitColumn.options].map((option) => option.value));
  const cityIndex = detectFields().city;
  els.splitColumn.value = values.has(currentValue) ? currentValue : String(cityIndex >= 0 ? cityIndex : 0);
  state.splitColumnValue = els.splitColumn.value;
  updateDownloadControls();
}

function renderDuplicateOptions() {
  const currentValue = els.duplicateColumnFilter.value || "__row__";
  els.duplicateColumnFilter.replaceChildren();

  const rowOption = document.createElement("option");
  rowOption.value = "__row__";
  rowOption.textContent = "Tekrar: tüm satır";
  els.duplicateColumnFilter.append(rowOption);

  state.headers.forEach((header, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Tekrar: ${header}`;
    els.duplicateColumnFilter.append(option);
  });

  const values = new Set([...els.duplicateColumnFilter.options].map((option) => option.value));
  els.duplicateColumnFilter.value = values.has(currentValue) ? currentValue : "__row__";
}

function autoDetectFields() {
  const findIndex = (patterns) =>
    state.headers.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return patterns.some((pattern) => normalized.includes(pattern));
    });

  return {
    customerId: findIndex(["musteri no", "müşteri no", "musteri kod", "müşteri kod", "customer id", "client id", "kod", "no"]),
    firstName: findIndex(["ad", "isim", "name"]),
    lastName: findIndex(["soyad", "surname", "lastname", "last name"]),
    email: findIndex(["eposta", "e posta", "email", "mail"]),
    phone: findIndex(["telefon", "phone", "gsm", "mobile", "cep"]),
    city: findIndex(["sehir", "şehir", "city", "province", "location"]),
  };
}

function detectFields() {
  return autoDetectFields();
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function analyzeData() {
  if (!state.rows.length) {
    return {
      score: 0,
      fields: detectFields(),
      emailIssues: 0,
      phoneIssues: 0,
      phoneDetails: [],
      emptyCells: 0,
      emptyByColumn: [],
      duplicates: 0,
      duplicateRows: new Set(),
      readyRows: 0,
      issueRows: 0,
      issues: ["CSV yüklendiğinde veri kalite analizi burada görünür."],
    };
  }

  const fields = detectFields();
  const duplicateIndex = buildDuplicateIndex();
  const duplicates = duplicateIndex.count;
  const emptyCounts = Array.from({ length: state.headers.length }, () => 0);
  const phoneBuckets = new Map();
  let emptyCells = 0;
  let emailIssues = 0;
  let phoneIssues = 0;
  let issueRows = 0;

  state.rows.forEach((row, rowIndex) => {
    let rowHasIssue = duplicateIndex.rows.has(rowIndex);
    row.forEach((cell, columnIndex) => {
      if (String(cell ?? "").trim() === "") {
        emptyCells += 1;
        emptyCounts[columnIndex] += 1;
        rowHasIssue = true;
      }
    });

    if (fields.email >= 0 && isInvalidEmailValue(row[fields.email])) {
      emailIssues += 1;
      rowHasIssue = true;
    }

    if (fields.phone >= 0) {
      const phoneValue = row[fields.phone];
      if (isInvalidPhoneValue(phoneValue)) {
        phoneIssues += 1;
        rowHasIssue = true;
      }
      const detail = classifyPhoneValue(phoneValue);
      if (detail) {
        phoneBuckets.set(detail.key, {
          label: detail.label,
          count: (phoneBuckets.get(detail.key)?.count || 0) + 1,
        });
      }
    }

    if (rowHasIssue) issueRows += 1;
  });

  const emptyByColumn = state.headers
    .map((header, index) => ({ header, count: emptyCounts[index] || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const phoneDetails = [...phoneBuckets.values()].sort((a, b) => b.count - a.count);
  const requiredMissing = [fields.firstName, fields.email, fields.phone].filter((index) => index < 0).length;
  const opportunity = Math.max(state.rows.length * 4 + state.headers.length, 1);
  const issueWeight = emptyCells * 0.5 + duplicates * 5 + emailIssues * 4 + phoneIssues * 4 + requiredMissing * 8;
  const score = Math.max(0, Math.round(100 - (issueWeight / opportunity) * 100));
  const issues = buildIssues({ fields, emptyByColumn, duplicates, emailIssues, phoneIssues, phoneDetails, requiredMissing });

  return {
    score,
    fields,
    emailIssues,
    phoneIssues,
    phoneDetails,
    emptyCells,
    emptyByColumn,
    duplicates,
    duplicateRows: duplicateIndex.rows,
    readyRows: Math.max(0, state.rows.length - issueRows),
    issueRows,
    issues,
  };
}

function countInvalidEmails(index) {
  return state.rows.filter((row) => {
    const value = String(row[index]).trim();
    return value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }).length;
}

function countInvalidPhones(index) {
  return state.rows.filter((row) => {
    const value = String(row[index]).trim();
    if (!value) return false;
    const normalized = normalizePhone(value);
    return !/^\+90 \d{3} \d{3} \d{2} \d{2}$/.test(normalized);
  }).length;
}

function analyzePhoneDetails(index) {
  const buckets = new Map();
  state.rows.forEach((row) => {
    const detail = classifyPhoneValue(row[index]);
    if (!detail) return;
    buckets.set(detail.key, {
      label: detail.label,
      count: (buckets.get(detail.key)?.count || 0) + 1,
    });
  });
  return [...buckets.values()].sort((a, b) => b.count - a.count);
}

function classifyPhoneValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { key: "noDigits", label: "Rakam bulunmayan telefon" };
  let local = digits;
  if (local.startsWith("90") && local.length === 12) local = local.slice(2);
  if (local.startsWith("0") && local.length === 11) local = local.slice(1);

  const hasRemovedChars = /[^\d\s+().-]/.test(raw);
  if (local.length < 10) return { key: "short", label: "Eksik haneli telefon" };
  if (local.length > 10) return { key: "long", label: "Fazla haneli telefon" };
  if (!local.startsWith("5")) return { key: "prefix", label: "5 ile başlamayan telefon" };
  if (hasRemovedChars) return { key: "cleanableChars", label: "Harf/simge temizlenerek düzelen telefon" };
  if (normalizePhone(raw) !== raw) return { key: "cleanableFormat", label: "Formatı düzenlenebilen telefon" };
  return null;
}

function buildIssues({ fields, emptyByColumn, duplicates, emailIssues, phoneIssues, phoneDetails, requiredMissing }) {
  const issues = [];
  if (requiredMissing) issues.push("Müşteri listesi için ad, e-posta veya telefon kolonlarından biri eksik görünüyor.");
  emptyByColumn.slice(0, 6).forEach(({ header, count }) => {
    issues.push(`${header}: ${count.toLocaleString("tr-TR")} eksik değer var.`);
  });
  if (emptyByColumn.length > 6) {
    issues.push(`${emptyByColumn.length - 6} kolonda daha eksik değer var.`);
  }
  if (duplicates) issues.push(`${getDuplicateBasisLabel()} bazlı ${duplicates.toLocaleString("tr-TR")} tekrar bulundu.`);
  if (emailIssues) issues.push(`${emailIssues.toLocaleString("tr-TR")} e-posta adresi geçersiz formatta.`);
  if (phoneIssues) issues.push(`${phoneIssues.toLocaleString("tr-TR")} telefon numarası standart formata uymuyor.`);
  phoneDetails.slice(0, 3).forEach(({ label, count }) => {
    issues.push(`${label}: ${count.toLocaleString("tr-TR")} kayıt.`);
  });
  if (!issues.length && state.rows.length) issues.push("Liste kampanya, arama veya CRM aktarımı için temiz görünüyor.");
  if (fields.phone >= 0) issues.push("CRM hazırlama telefonu Türkiye formatına çevirir: +90 5xx xxx xx xx.");
  return issues;
}

function renderInsights() {
  const { fields, issues, phoneDetails = [] } = state.analysis;
  const labels = [
    ["Ad", fields.firstName],
    ["Soyad", fields.lastName],
    ["E-posta", fields.email],
    ["Telefon", fields.phone],
    ["Şehir", fields.city],
  ]
    .filter(([, index]) => index >= 0)
    .map(([label, index]) => `${label}: ${state.headers[index]}`);

  els.detectedFields.textContent = labels.length ? labels.join(" · ") : "Kolon bekleniyor";
  els.issuesList.replaceChildren();
  issues.forEach((issue) => {
    const item = document.createElement("div");
    item.className = "issue-item";
    item.textContent = issue;
    els.issuesList.append(item);
  });

  els.phoneDetailList.replaceChildren();
  if (!phoneDetails.length) return;
  phoneDetails.slice(0, 5).forEach(({ label, count }) => {
    const item = document.createElement("div");
    item.className = "phone-detail-item";
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${count.toLocaleString("tr-TR")}</strong>`;
    els.phoneDetailList.append(item);
  });
}

function renderCleanupResults() {
  const result = state.lastCleanup;
  const lastSnapshot = state.history.at(-1);
  els.lastActionLabel.textContent = result ? result.action : "Henüz işlem yok";
  els.undoButton.disabled = !lastSnapshot;
  els.undoButton.title = lastSnapshot ? `${lastSnapshot.label} işlemini geri al` : "Geri alınacak işlem yok";
  els.cleanupResults.replaceChildren();

  const items = result
    ? [
        ["Skor değişimi", formatDelta(result.scoreDelta)],
        ["Kaldırılan kayıt", result.removedRows],
        ["Düzelen boş hücre", result.emptyDelta],
        ["Azalan tekrar", result.duplicateDelta],
        ["Düzelen e-posta", result.emailDelta],
        ["Düzelen telefon", result.phoneDelta],
      ]
    : [
        ["Skor değişimi", "0"],
        ["Kaldırılan kayıt", "0"],
        ["Düzelen boş hücre", "0"],
        ["Azalan tekrar", "0"],
        ["Düzelen e-posta", "0"],
        ["Düzelen telefon", "0"],
      ];

  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    els.cleanupResults.append(item);
  });
}

function renderChangePreview() {
  const changes = state.changePreview || [];
  els.changePreview.classList.toggle("hidden", !changes.length);
  if (!changes.length) {
    els.changePreview.innerHTML = "";
    return;
  }

  els.changePreview.innerHTML = `
    <div class="change-preview-head">
      <div>
        <strong>Önce / Sonra</strong>
        <span>${changes.length.toLocaleString("tr-TR")} önemli değişiklik örneği</span>
      </div>
      <button class="ghost-button small-button" type="button" data-toggle-preview>Detay</button>
    </div>
    <div class="change-preview-list">
      ${changes.map((change) => `
        <div class="change-preview-row">
          <span>${change.rowNumber ? `${change.rowNumber}. satır` : "Başlık"} · ${escapeHtml(change.header)}</span>
          <del>${escapeHtml(change.before || "Boş")}</del>
          <ins>${escapeHtml(change.after || "Boş")}</ins>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSegments() {
  els.readySegmentCount.textContent = (state.analysis?.readyRows || 0).toLocaleString("tr-TR");
  els.issueSegmentCount.textContent = (state.analysis?.issueRows || 0).toLocaleString("tr-TR");
}

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function renderTable() {
  const visibleSummary = getVisibleRowSummary(250);
  const previewItems = visibleSummary.items;

  els.emptyState.classList.toggle("hidden", state.headers.length > 0);
  els.visibleRows.textContent = `${visibleSummary.total.toLocaleString("tr-TR")} satır görünüyor`;

  const thead = els.dataTable.querySelector("thead");
  const tbody = els.dataTable.querySelector("tbody");
  thead.replaceChildren();
  tbody.replaceChildren();

  if (!state.headers.length) return;

  const headerRow = document.createElement("tr");
  const statusHeader = document.createElement("th");
  statusHeader.textContent = "Durum";
  headerRow.append(statusHeader);
  state.headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.append(th);
  });
  thead.append(headerRow);

  previewItems.forEach(({ row, index }) => {
    const tr = document.createElement("tr");
    const statusCell = document.createElement("td");
    statusCell.className = "status-cell";
    renderRowBadges(row, index).forEach((badge) => statusCell.append(badge));
    tr.append(statusCell);
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell || "boş";
      td.className = cell ? "" : "empty-cell";
      tr.append(td);
    });
    tbody.append(tr);
  });
}

function getVisibleRowSummary(limit = 250) {
  const query = els.searchInput.value.trim().toLocaleLowerCase("tr-TR");
  const filter = els.rowFilter.value;
  if (!query && filter === "all") {
    return {
      total: state.rows.length,
      items: state.rows.slice(0, limit).map((row, index) => ({ row, index })),
    };
  }

  const items = [];
  let total = 0;
  state.rows.forEach((row, index) => {
    const matchesSearch = !query || row.some((cell) => String(cell).toLocaleLowerCase("tr-TR").includes(query));
    if (!matchesSearch || !matchesRowFilter(row, index)) return;
    total += 1;
    if (items.length < limit) items.push({ row, index });
  });
  return { total, items };
}

function getVisibleRowItems() {
  const query = els.searchInput.value.trim().toLocaleLowerCase("tr-TR");
  return state.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => {
      const matchesSearch = row.some((cell) => String(cell).toLocaleLowerCase("tr-TR").includes(query));
      return matchesSearch && matchesRowFilter(row, index);
    });
}

function renderRowBadges(row, index) {
  const issues = getRowIssueLabels(row, index);
  const labels = issues.length ? issues : [{ label: "Hazır", type: "ready" }];
  return labels.slice(0, 4).map(({ label, type }) => {
    const badge = document.createElement("span");
    badge.className = `row-badge ${type}`;
    badge.textContent = label;
    return badge;
  });
}

function getRowIssueLabels(row, index) {
  const fields = state.analysis?.fields || detectFields();
  const labels = [];
  const emptyHeaders = state.headers.filter((_, columnIndex) => String(row[columnIndex] ?? "").trim() === "");

  if (emptyHeaders.length) labels.push({ label: `Eksik: ${emptyHeaders.slice(0, 2).join(", ")}`, type: "missing" });
  if (fields.email >= 0 && isInvalidEmailValue(row[fields.email])) labels.push({ label: "Email hatalı", type: "error" });
  if (fields.phone >= 0 && isInvalidPhoneValue(row[fields.phone])) labels.push({ label: "Telefon hatalı", type: "error" });
  if (isDuplicateRow(index)) labels.push({ label: "Tekrar", type: "duplicate" });

  return labels;
}

function matchesRowFilter(row, index) {
  const filter = els.rowFilter.value;
  if (filter === "all") return true;
  if (filter === "empty") return row.some((cell) => String(cell).trim() === "");
  if (filter === "duplicates") return isDuplicateRow(index);

  const fields = state.analysis?.fields || detectFields();
  const hasEmailIssue = fields.email >= 0 && isInvalidEmailValue(row[fields.email]);
  const hasPhoneIssue = fields.phone >= 0 && isInvalidPhoneValue(row[fields.phone]);
  const hasEmpty = row.some((cell) => String(cell).trim() === "");
  const hasDuplicate = isDuplicateRow(index);

  if (filter === "email") return hasEmailIssue;
  if (filter === "phone") return hasPhoneIssue;
  if (filter === "issues") return hasEmailIssue || hasPhoneIssue || hasEmpty || hasDuplicate;
  return true;
}

function getRowsForSegment(segment) {
  if (!state.rows.length) return [];
  return state.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => matchesSegment(row, index, segment))
    .map(({ row }) => row);
}

function matchesSegment(row, index, segment) {
  if (segment === "all") return true;
  if (segment === "ready") return getRowIssueLabels(row, index).length === 0;
  if (segment === "issues") return getRowIssueLabels(row, index).length > 0;
  if (segment === "empty") return row.some((cell) => String(cell).trim() === "");
  if (segment === "duplicates") return isDuplicateRow(index);

  const fields = state.analysis?.fields || detectFields();
  if (segment === "email") return fields.email >= 0 && isInvalidEmailValue(row[fields.email]);
  if (segment === "phone") return fields.phone >= 0 && isInvalidPhoneValue(row[fields.phone]);
  return false;
}

function isDuplicateRow(index) {
  return Boolean(state.analysis?.duplicateRows?.has(index));
}

function downloadFromCenter() {
  if (!canDownloadFromCenter()) {
    if (!canUseFreeRows()) showPlanLimitMessage();
    return;
  }

  const format = els.downloadFormat.value;
  const scope = els.downloadScope.value;
  if (format === "report") return downloadReport();
  if (format === "template") return downloadTemplateCsv();
  if (format === "splitZip") return downloadSplitXlsx();

  const rows = getRowsForDownloadScope(scope);
  const suffix = getDownloadScopeSlug(scope);
  if (format === "xlsx") return downloadXlsx(state.headers, rows, suffix);
  return downloadRowsCsv(rows, suffix);
}

function getRowsForDownloadScope(scope) {
  if (scope === "visible") return getVisibleRowItems().map(({ row }) => row);
  if (scope === "all") return state.rows;
  return getRowsForSegment(scope);
}

function getDownloadScopeSlug(scope) {
  const labels = {
    all: "tum-veri",
    visible: "gorunen-satirlar",
    ready: "temiz-kayitlar",
    issues: "sorunlu-kayitlar",
    email: "mail-sorunlular",
    phone: "telefon-sorunlular",
    duplicates: "tekrar-kayitlar",
  };
  return labels[scope] || "indirme";
}

function downloadCsv() {
  if (!canUseFreeRows()) return showPlanLimitMessage();
  downloadRowsCsv(state.rows, "temiz");
}

function downloadVisibleCsv() {
  if (!canUseFreeRows()) return showPlanLimitMessage();
  const rows = getVisibleRowItems().map(({ row }) => row);
  downloadRowsCsv(rows, `${getFilterSlug()}-satirlar`);
}

function downloadSegment(segment, format) {
  if (!isProPlan()) return showProRequiredMessage("Segment indirme Pro pakette kullanılabilir.");
  const rows = getRowsForSegment(segment);
  if (!rows.length) return;
  const suffix = segmentFileNames[segment] || segment;
  if (format === "xlsx") {
    downloadXlsx(state.headers, rows, suffix);
    return;
  }
  downloadRowsCsv(rows, suffix);
}

const segmentFileNames = {
  all: "tum-kayitlar",
  ready: "temiz-kayitlar",
  issues: "sorunlu-kayitlar",
  empty: "eksik-kayitlar",
  email: "mail-sorunlular",
  phone: "telefon-sorunlular",
  duplicates: "tekrar-kayitlar",
};

function downloadRowsCsv(rows, suffix) {
  const limitedRows = applyDownloadLimit(rows);
  const csv = [state.headers, ...limitedRows].map(formatCsvRow).join("\n");
  const blob = createCsvBlob(csv);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${getBaseFileName()}-${suffix}${getDownloadLimitSuffix(rows)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadXlsx(headers, rows, suffix) {
  if (!isProPlan()) return showProRequiredMessage("Excel çıktısı Pro pakette kullanılabilir.");
  const xlsx = window.XLSX;
  if (!xlsx) {
    showToast("Excel çıktısı hazırlanamadı. xlsx.full.min.js dosyasını kontrol edin.", "error", "Excel hazırlanamadı");
    return;
  }

  const worksheet = xlsx.utils.aoa_to_sheet([headers, ...applyDownloadLimit(rows)]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Veri");
  xlsx.writeFile(workbook, `${getBaseFileName()}-${suffix}${getDownloadLimitSuffix(rows)}.xlsx`);
}

function downloadSplitXlsx() {
  if (!isProPlan()) return showProRequiredMessage("Kolona göre Excel ZIP Pro pakette kullanılabilir.");
  if (!state.rows.length || !state.headers.length) return;
  const columnIndex = Number(els.splitColumn.value);
  if (!Number.isInteger(columnIndex) || columnIndex < 0) return;

  const groups = groupRowsByColumn(columnIndex);
  const files = [...groups].map(([value, rows]) => {
    const suffix = `${slugify(state.headers[columnIndex])}-${slugify(value) || "bos"}`;
    return {
      name: `${getBaseFileName()}-${suffix}${getDownloadLimitSuffix(rows)}.xlsx`,
      data: buildXlsxBytes(state.headers, applyDownloadLimit(rows)),
    };
  });
  const zipBlob = createZipBlob(files);
  downloadBlob(zipBlob, `${getBaseFileName()}-${slugify(state.headers[columnIndex])}-ayri-exceller.zip`);
  els.downloadInfo.textContent = `${files.length.toLocaleString("tr-TR")} Excel dosyası ZIP içinde hazırlandı${getDownloadLimitLabel()}.`;
}

function buildXlsxBytes(headers, rows) {
  const xlsx = window.XLSX;
  if (!xlsx) {
    showToast("Excel çıktısı hazırlanamadı. xlsx.full.min.js dosyasını kontrol edin.", "error", "Excel hazırlanamadı");
    return new Uint8Array();
  }

  const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Veri");
  return new Uint8Array(xlsx.write(workbook, { bookType: "xlsx", type: "array" }));
}

function groupRowsByColumn(columnIndex) {
  const groups = new Map();
  state.rows.forEach((row) => {
    const value = String(row[columnIndex] ?? "").trim() || "Bos";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  });
  return groups;
}

function getDownloadLimit() {
  const value = els.downloadLimit.value;
  if (value === "all") return Infinity;
  if (value === "manual") {
    const manualLimit = Number(els.downloadLimitManual.value);
    return Number.isInteger(manualLimit) && manualLimit > 0 ? manualLimit : NaN;
  }
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
}

function hasValidDownloadLimit() {
  const limit = getDownloadLimit();
  return Number.isFinite(limit) || limit === Infinity;
}

function applyDownloadLimit(rows) {
  const limit = getDownloadLimit();
  return Number.isFinite(limit) ? rows.slice(0, limit) : rows;
}

function getDownloadLimitSuffix(rows) {
  const limit = getDownloadLimit();
  if (!Number.isFinite(limit) || rows.length <= limit) return "";
  return `-ilk-${limit.toLocaleString("tr-TR").replace(/\./g, "")}`;
}

function getDownloadLimitLabel() {
  const limit = getDownloadLimit();
  return Number.isFinite(limit) ? `, her dosyada en fazla ${limit.toLocaleString("tr-TR")} satır` : "";
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const localHeader = buildZipLocalHeader(nameBytes, data.length, crc);
    localParts.push(localHeader, data);
    centralParts.push(buildZipCentralHeader(nameBytes, data.length, crc, offset));
    offset += localHeader.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = buildZipEndRecord(files.length, centralSize, offset);
  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

function buildZipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function buildZipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function buildZipEndRecord(fileCount, centralSize, centralOffset) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return record;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  });
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getBaseFileName() {
  return (state.fileName || "veri").replace(/\.(csv|xlsx|xls)$/i, "");
}

function getFilterSlug() {
  const filter = els.rowFilter.value;
  if (filter === "duplicates") return `tekrar-${slugify(getDuplicateBasisLabel())}`;
  const labels = {
    all: "tum",
    issues: "sorunlu",
    empty: "eksik",
    email: "email-sorunlu",
    phone: "telefon-sorunlu",
  };
  return labels[filter] || "gorunen";
}

function downloadTemplateCsv() {
  if (!isProPlan()) return showProRequiredMessage("CRM şablon çıktısı Pro pakette kullanılabilir.");
  const { headers, rows } = buildTemplateExport();
  const limitedRows = applyDownloadLimit(rows);
  const csv = [headers, ...limitedRows].map(formatCsvRow).join("\n");
  const blob = createCsvBlob(csv);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const template = exportTemplates[els.exportTemplate.value] || exportTemplates.current;
  link.href = url;
  link.download = `${state.fileName.replace(/\.csv$/i, "")}-${slugify(template.name)}${getDownloadLimitSuffix(rows)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createCsvBlob(csv) {
  return new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
}

function buildTemplateExport() {
  const templateKey = els.exportTemplate.value;
  if (templateKey === "current") return { headers: state.headers, rows: state.rows };

  const fields = detectFields();
  const map = {
    "Ad": fields.firstName,
    "First Name": fields.firstName,
    "Soyad": fields.lastName,
    "Last Name": fields.lastName,
    "Telefon": fields.phone,
    "Phone": fields.phone,
    "Phone Number": fields.phone,
    "E-posta": fields.email,
    "Email": fields.email,
    "Email Address": fields.email,
    "Şehir": fields.city,
    "Not": -1,
  };
  const headers = exportTemplates[templateKey].columns;
  const rows = state.rows.map((row) => headers.map((header) => (map[header] >= 0 ? row[map[header]] : "")));
  return { headers, rows };
}

function downloadReport() {
  if (!isProPlan()) return showProRequiredMessage("Kalite raporu Pro pakette kullanılabilir.");
  const analysis = state.analysis || analyzeData();
  const lines = [
    "Data Temizle Kalite Raporu",
    `Dosya: ${state.fileName || "Adsız"}`,
    `Satır: ${state.rows.length}`,
    `Kolon: ${state.headers.length}`,
    `Kalite skoru: ${analysis.score}/100`,
    `Boş hücre: ${analysis.emptyCells}`,
    `Tekrarlanan kayıt: ${analysis.duplicates}`,
    `E-posta sorunu: ${analysis.emailIssues}`,
    `Telefon sorunu: ${analysis.phoneIssues}`,
    `Kampanyaya hazır kayıt: ${getRowsForSegment("ready").length}`,
    `Düzeltilmesi gereken kayıt: ${getRowsForSegment("issues").length}`,
    state.lastCleanup ? `Son işlem: ${state.lastCleanup.action}` : "Son işlem: Yok",
    state.lastCleanup ? `Skor değişimi: ${formatDelta(state.lastCleanup.scoreDelta)}` : "Skor değişimi: 0",
    state.lastCleanup ? `Kaldırılan kayıt: ${state.lastCleanup.removedRows}` : "Kaldırılan kayıt: 0",
    "",
    "Kolon bazlı eksikler:",
    ...(analysis.emptyByColumn.length
      ? analysis.emptyByColumn.map(({ header, count }) => `- ${header}: ${count}`)
      : ["- Eksik değer yok"]),
    "",
    "Tespitler:",
    ...analysis.issues.map((issue) => `- ${issue}`),
    "",
    "Önerilen teklif:",
    "Bu liste CRM, WhatsApp veya e-posta kampanyasına aktarılmadan önce Data Temizle ile temizlendi.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.fileName.replace(/\.csv$/i, "") + "-rapor.txt";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatCsvRow(row) {
  return row
    .map((cell) => {
      const value = String(cell ?? "");
      if (/[",\n\r;]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
      return value;
    })
    .join(",");
}

function isInvalidEmailValue(value) {
  const email = String(value).trim();
  return email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isInvalidPhoneValue(value) {
  const phone = String(value).trim();
  if (!phone) return false;
  return !/^\+90 \d{3} \d{3} \d{2} \d{2}$/.test(normalizePhone(phone));
}
