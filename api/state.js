// Shared key/value storage for the Up Board rotation state, backed by
// Vercel KV / Upstash Redis. Mirrors the tiny contract the app already
// expects:
//   GET  /api/state?key=<key>        -> { value: string|null }
//   POST /api/state  { key, value }  -> { ok: true }
//
// The app only ever stores plain strings (it JSON.stringify()s its own
// state before calling storageSet), so this function never needs to
// understand the shape of what it's storing.
const { kv } = require("@vercel/kv");
 
module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const key = req.query.key;
      if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
      }
      const value = await kv.get(key);
      res.status(200).json({ value: value == null ? null : value });
      return;
    }
 
    if (req.method === "POST") {
      const body = req.body || {};
      const { key, value } = body;
      if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
      }
      if (typeof value !== "string") {
        res.status(400).json({ error: "value must be a string" });
        return;
      }
      await kv.set(key, value);
      res.status(200).json({ ok: true });
      return;
    }
 
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("api/state error:", err);
    // TEMPORARY: surfacing the real error message and a few relevant env
    // var presence flags to diagnose a setup issue. Safe to do short-term
    // since this reveals no secret values, only which variables exist —
    // but this should be reverted back to a generic message once the
    // underlying problem is found and fixed.
    res.status(500).json({
      error: "Storage request failed",
      debugMessage: err && err.message,
      debugName: err && err.name,
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN,
    });
  }
};
 
