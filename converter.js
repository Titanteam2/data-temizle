const state = { files: [], sourceFiles: [], runId: 0 };
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const delimiterValues = { comma: ",", semicolon: ";", tab: "\t" };

const els = {
  appError: document.querySelector("#appError"),
  toastStack: document.querySelector("#toastStack"),
  themeToggle: document.querySelector("#themeToggle"),
  outputFormat: document.querySelector("#formatOutputFormat"),
  inputDelimiter: document.querySelector("#formatInputDelimiter"),
  outputDelimiterGroup: document.querySelector("#formatOutputDelimiterGroup"),
  outputDelimiter: document.querySelector("#formatOutputDelimiter"),
  encodingGroup: document.querySelector("#formatEncodingGroup"),
  encoding: document.querySelector("#formatEncoding"),
  fileInput: document.querySelector("#formatFileInput"),
  uploadZone: document.querySelector("#formatUploadZone"),
  fileList: document.querySelector("#formatFileList"),
  status: document.querySelector("#formatStatus"),
  downloadButton: document.querySelector("#downloadConvertedButton"),
  clearButton: document.querySelector("#clearConvertedButton"),
};

const savedTheme = localStorage.getItem("listfix-theme");
if (savedTheme === "dark" || savedTheme === "light") document.documentElement.dataset.theme = savedTheme;
updateThemeButton();

els.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("listfix-theme", nextTheme);
  updateThemeButton();
});

els.fileInput.addEventListener("change", () => convertFiles(Array.from(els.fileInput.files || [])));
els.outputFormat.addEventListener("change", updateControls);
[els.inputDelimiter, els.outputDelimiter, els.encoding].forEach((element) => {
  element.addEventListener("change", () => {
    if (state.sourceFiles.length) convertFiles(state.sourceFiles, false);
  });
});

["dragenter", "dragover"].forEach((eventName) => {
  els.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.uploadZone.classList.add("is-dragging");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  els.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.uploadZone.classList.remove("is-dragging");
  });
});
els.uploadZone.addEventListener("drop", (event) => convertFiles(Array.from(event.dataTransfer?.files || [])));
els.fileList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-download-converted]");
  if (!button) return;
  const file = state.files[Number(button.dataset.downloadConverted)];
  if (file?.blob) downloadBlob(file.blob, file.name);
});
els.downloadButton.addEventListener("click", downloadAllFiles);
els.clearButton.addEventListener("click", clearFiles);

window.addEventListener("error", (event) => showAppError(event.error?.message || event.message));
window.addEventListener("unhandledrejection", (event) => showAppError(event.reason?.message || "Beklenmeyen bir hata oluştu."));

updateControls();
renderFiles();

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  els.themeToggle.setAttribute("aria-label", dark ? "Açık modu aç" : "Koyu modu aç");
  els.themeToggle.setAttribute("title", dark ? "Açık modu aç" : "Koyu modu aç");
}

function updateControls() {
  const isCsv = els.outputFormat.value === "csv";
  els.outputDelimiterGroup.classList.toggle("hidden", !isCsv);
  els.encodingGroup.classList.toggle("hidden", !isCsv);
  if (state.sourceFiles.length) convertFiles(state.sourceFiles, false);
}

async function convertFiles(files, rememberFiles = true) {
  if (!files.length) return;
  if (rememberFiles) state.sourceFiles = files;
  const runId = ++state.runId;
  const outputFormat = els.outputFormat.value;
  const outputDelimiter = delimiterValues[els.outputDelimiter.value] || ",";
  const addBom = els.encoding.value === "utf8-bom";
  const allowedExtensions = new Set(["csv", "tsv", "xlsx", "xls"]);

  els.uploadZone.classList.add("is-loading");
  els.status.textContent = files.length.toLocaleString("tr-TR") + " dosya dönüştürülüyor…";
  state.files = [];
  renderFiles();

  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr-TR");
    if (!allowedExtensions.has(extension)) {
      state.files.push({ name: file.name, error: "CSV, TSV, XLSX veya XLS dosyası seçin." });
      continue;
    }
    if (!file.size) {
      state.files.push({ name: file.name, error: "Dosya boş." });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      state.files.push({ name: file.name, error: "Dosya 100 MB sınırını aşıyor." });
      continue;
    }

    try {
      const records = await readRecords(file, extension);
      if (runId !== state.runId) return;
      if (!records.length || !records.some((row) => row.some((cell) => String(cell).length))) {
        throw new Error("Dosyada dönüştürülecek veri bulunamadı.");
      }
      const output = buildOutput(records, outputFormat, outputDelimiter, addBom);
      const name = makeUniqueName(buildFileName(file.name, outputFormat));
      state.files.push({
        name,
        blob: output.blob,
        bytes: output.bytes,
        rowCount: records.filter((row) => row.some((cell) => String(cell).length)).length,
      });
    } catch (error) {
      state.files.push({ name: file.name, error: error.message || "Dönüştürülemedi." });
    }
  }

  if (runId !== state.runId) return;
  els.uploadZone.classList.remove("is-loading", "is-dragging");
  renderFiles();
}

async function readRecords(file, extension) {
  if (extension === "xlsx" || extension === "xls") {
    if (!window.XLSX) throw new Error("Excel desteği yüklenemedi.");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", codepage: 1254 });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("Excel dosyasında okunabilir sayfa bulunamadı.");
    return window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, blankrows: true, defval: "", raw: false,
    });
  }
  const text = await decodeTextFile(file);
  const selected = els.inputDelimiter.value;
  const delimiter = selected === "auto"
    ? (extension === "tsv" ? "\t" : detectDelimiter(text))
    : (delimiterValues[selected] || ",");
  return parseDelimited(text, delimiter);
}

function buildOutput(records, outputFormat, delimiter, addBom) {
  if (outputFormat === "xlsx") {
    if (!window.XLSX) throw new Error("Excel desteği yüklenemedi.");
    const worksheet = window.XLSX.utils.aoa_to_sheet(records);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Veri");
    const bytes = new Uint8Array(window.XLSX.write(workbook, { bookType: "xlsx", type: "array" }));
    return { bytes, blob: new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
  }
  const content = records.map((row) => formatRow(row, delimiter)).join("\r\n");
  const bytes = new TextEncoder().encode((addBom ? "\ufeff" : "") + content);
  return { bytes, blob: new Blob([bytes], { type: "text/csv;charset=utf-8" }) };
}

function formatRow(row, delimiter) {
  return row.map((cell) => {
    const value = String(cell ?? "");
    return value.includes('"') || value.includes("\n") || value.includes("\r") || value.includes(delimiter)
      ? '"' + value.replaceAll('"', '""') + '"'
      : value;
  }).join(delimiter);
}

function buildFileName(fileName, outputFormat) {
  const safeName = String(fileName || "veri").replace(/[\\/:*?"<>|]+/g, "-");
  return (safeName.replace(/\.(csv|tsv|xlsx|xls)$/i, "") || "veri") + "." + outputFormat;
}

function makeUniqueName(fileName) {
  const used = new Set(state.files.filter((item) => item.blob).map((item) => item.name.toLocaleLowerCase("tr-TR")));
  if (!used.has(fileName.toLocaleLowerCase("tr-TR"))) return fileName;
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";
  let counter = 2;
  while (used.has((base + "-" + counter + extension).toLocaleLowerCase("tr-TR"))) counter += 1;
  return base + "-" + counter + extension;
}

function renderFiles() {
  const successful = state.files.filter((item) => item.blob);
  const failed = state.files.filter((item) => item.error);
  els.fileList.innerHTML = state.files.map((item, index) => {
    const status = item.error ? escapeHtml(item.error) : item.rowCount.toLocaleString("tr-TR") + " satır • hazır";
    const button = item.blob ? '<button type="button" data-download-converted="' + index + '">İndir</button>' : "";
    return '<article class="format-file-item ' + (item.error ? "has-error" : "") + '">' +
      '<span class="format-file-icon" aria-hidden="true">' + (item.error ? "!" : "✓") + '</span>' +
      '<span class="format-file-copy"><strong title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) +
      '</strong><small>' + status + '</small></span>' + button + '</article>';
  }).join("");
  els.downloadButton.disabled = successful.length === 0;
  els.downloadButton.textContent = successful.length > 1 ? "Tümünü ZIP indir" : "Dosyayı indir";
  els.clearButton.disabled = state.files.length === 0;
  if (!state.files.length) els.status.textContent = "Henüz dosya seçilmedi.";
  else if (!successful.length) els.status.textContent = "Seçilen dosyalar dönüştürülemedi.";
  else els.status.textContent = successful.length.toLocaleString("tr-TR") + " dosya hazır" +
    (failed.length ? ", " + failed.length.toLocaleString("tr-TR") + " dosyada hata var" : "") +
    ". Dosya adları korundu.";
}

function downloadAllFiles() {
  const files = state.files.filter((item) => item.blob);
  if (!files.length) return;
  if (files.length === 1) return downloadBlob(files[0].blob, files[0].name);
  downloadBlob(createZipBlob(files.map((item) => ({ name: item.name, data: item.bytes }))), "donusturulen-dosyalar.zip");
  showToast(files.length.toLocaleString("tr-TR") + " dosya ayrı ayrı ZIP'e eklendi.", "success", "Dönüştürme tamamlandı");
}

function clearFiles() {
  state.runId += 1;
  state.files = [];
  state.sourceFiles = [];
  els.fileInput.value = "";
  els.uploadZone.classList.remove("is-loading", "is-dragging");
  renderFiles();
}

async function decodeTextFile(file) {
  const buffer = await file.arrayBuffer();
  const decoded = ["utf-8", "windows-1254", "iso-8859-9"].map((encoding) => {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      return { encoding, text: stripBom(text), score: countDecodeProblems(text) };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => a.score - b.score);
  const best = decoded[0];
  if (best?.encoding && best.encoding !== "utf-8") {
    showToast(file.name + " " + best.encoding.toUpperCase() + " olarak okundu.", "info", "Türkçe karakterler düzeltildi");
  }
  return best?.text || stripBom(await file.text());
}

function stripBom(text) { return String(text || "").replace(/^\uFEFF/, ""); }
function countDecodeProblems(text) {
  const value = String(text || "");
  return (value.match(/\uFFFD/g) || []).length * 100 + (value.match(/Ã.|Ä.|Å.|�/g) || []).length * 25;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); rows.push(row);
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  return [",", ";", "\t"].map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function createZipBlob(files) {
  const encoder = new TextEncoder(), localParts = [], centralParts = [];
  let offset = 0;
  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data), localHeader = buildZipLocalHeader(nameBytes, data.length, crc);
    localParts.push(localHeader, data);
    centralParts.push(buildZipCentralHeader(nameBytes, data.length, crc, offset));
    offset += localHeader.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  return new Blob([...localParts, ...centralParts, buildZipEndRecord(files.length, centralSize, offset)], { type: "application/zip" });
}

function buildZipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length), view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, size, true);
  view.setUint32(22, size, true); view.setUint16(26, nameBytes.length, true); header.set(nameBytes, 30);
  return header;
}

function buildZipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length), view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true); view.setUint16(10, 0, true); view.setUint32(16, crc, true);
  view.setUint32(20, size, true); view.setUint32(24, size, true); view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true); header.set(nameBytes, 46); return header;
}

function buildZipEndRecord(fileCount, centralSize, centralOffset) {
  const record = new Uint8Array(22), view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, fileCount, true); view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, centralOffset, true); return record;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => { crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]; });
  return (crc ^ 0xffffffff) >>> 0;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function showToast(message, type = "info", title = "Bilgi") {
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.innerHTML = '<span class="toast-dot"></span><span class="toast-content"><strong>' + escapeHtml(title) +
    '</strong><span>' + escapeHtml(message) + '</span></span><button class="toast-close" type="button" aria-label="Bildirimi kapat">×</button>';
  const close = () => { toast.classList.add("is-hiding"); window.setTimeout(() => toast.remove(), 180); };
  toast.querySelector("button").addEventListener("click", close);
  els.toastStack.append(toast);
  window.setTimeout(close, 4500);
}

function showAppError(message) {
  els.appError.textContent = "Format Dönüştürücü başlatılamadı: " + message;
  els.appError.classList.remove("hidden");
}
