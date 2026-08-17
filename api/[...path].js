const { safeHandleApi } = require("../server/api");

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "datatemizle.com"}`);
  await safeHandleApi(req, res, url.pathname);
};
