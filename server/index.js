const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { safeHandleApi } = require("./api");
const { loadEnvFile } = require("./lib/env");
const { securityHeaders } = require("./lib/http");

loadEnvFile(path.join(__dirname, "..", ".env"));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT_DIR = path.resolve(__dirname, "..");

const staticFiles = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/admin.html", { file: "admin.html", type: "text/html; charset=utf-8" }],
  ["/account.html", { file: "account.html", type: "text/html; charset=utf-8" }],
  ["/pricing.html", { file: "pricing.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "application/javascript; charset=utf-8" }],
  ["/admin.js", { file: "admin.js", type: "application/javascript; charset=utf-8" }],
  ["/account.js", { file: "account.js", type: "application/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/xlsx.full.min.js", { file: "xlsx.full.min.js", type: "application/javascript; charset=utf-8" }],
]);

function handleStatic(req, res, pathname) {
  const asset = staticFiles.get(pathname);
  if (!asset) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders });
    res.end("Bulunamadı");
    return;
  }

  const filePath = path.join(ROOT_DIR, asset.file);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders });
      res.end("Dosya okunamadı");
      return;
    }

    res.writeHead(200, {
      "Content-Type": asset.type,
      "Cache-Control": "no-store",
      ...securityHeaders,
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await safeHandleApi(req, res, url.pathname);
    return;
  }
  handleStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Data Temizle: http://${HOST}:${PORT}/`);
});
