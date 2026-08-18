const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const staticFiles = [
  "index.html",
  "account.html",
  "admin.html",
  "pricing.html",
  "analytics-init.js",
  "app.js",
  "account.js",
  "admin.js",
  "styles.css",
  "logo.svg",
  "xlsx.full.min.js",
];

const check = spawnSync(process.execPath, [path.join(__dirname, "check-production.js")], {
  cwd: rootDir,
  encoding: "utf8",
  stdio: "inherit",
});

if (check.status !== 0) {
  process.exit(check.status || 1);
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

staticFiles.forEach((file) => {
  fs.copyFileSync(path.join(rootDir, file), path.join(publicDir, file));
});

console.log("Vercel public output prepared.");
