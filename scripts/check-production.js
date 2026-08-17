const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "account.html",
  "admin.html",
  "pricing.html",
  "app.js",
  "account.js",
  "admin.js",
  "styles.css",
  "logo.svg",
  "scripts/build.js",
  "server/index.js",
  "server/api.js",
  "server/lib/env.js",
  "server/lib/http.js",
  "server/lib/rate-limit.js",
  "server/lib/supabase.js",
  "api/[...path].js",
  "vercel.json",
  "supabase/schema.sql",
  "xlsx.full.min.js",
  ".env.example",
  ".gitignore",
  "README.md",
];

const jsFiles = [
  "app.js",
  "account.js",
  "admin.js",
  "server/index.js",
  "server/api.js",
  "server/lib/env.js",
  "server/lib/http.js",
  "server/lib/rate-limit.js",
  "server/lib/supabase.js",
  "api/[...path].js",
  "scripts/build.js",
  "scripts/check-production.js",
];
const scanFiles = [
  "app.js",
  "account.js",
  "admin.js",
  "server/index.js",
  "server/api.js",
  "server/lib/supabase.js",
  "api/[...path].js",
  "index.html",
  "account.html",
  "admin.html",
  "pricing.html",
  "styles.css",
  "logo.svg",
  "README.md",
  ".env.example",
  "package.json",
  "vercel.json",
  "supabase/schema.sql",
];

const secretPatterns = [
  /sk_live_[A-Za-z0-9_]+/i,
  /sk_test_[A-Za-z0-9_]+/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /(?:STRIPE_SECRET_KEY|RESEND_API_KEY|SENDGRID_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(?!your-|replace-|$)[^#\s]+/i,
  /(?:PAYTR_[A-Z_]*KEY|IYZICO_[A-Z_]*KEY)\s*=\s*(?!your-|replace-|$)[^#\s]+/i,
];

function fail(message) {
  console.error(`Production check failed: ${message}`);
  process.exitCode = 1;
}

requiredFiles.forEach((file) => {
  if (!fs.existsSync(path.join(rootDir, file))) fail(`missing ${file}`);
});

jsFiles.forEach((file) => {
  const result = spawnSync(process.execPath, ["--check", path.join(rootDir, file)], { encoding: "utf8" });
  if (result.status !== 0) fail(`${file} syntax check failed\n${result.stderr || result.stdout}`);
});

scanFiles.forEach((file) => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  secretPatterns.forEach((pattern) => {
    if (pattern.test(content)) fail(`possible secret in ${file}: ${pattern}`);
  });
});

if (!process.exitCode) {
  console.log("Production check passed.");
}
