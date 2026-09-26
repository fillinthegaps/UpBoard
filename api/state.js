// Shared key/value storage for the Up Board rotation state, backed by
// Upstash Redis (connected directly, not through @vercel/kv). Mirrors the
// tiny contract the app already expects:
//   GET  /api/state?key=<key>        -> { value: string|null }
//   POST /api/state  { key, value }  -> { ok: true }
//
// The app only ever stores plain strings (it JSON.stringify()s its own
// state before calling storageSet), so this function must hand that exact
// string back unchanged on read. @vercel/kv silently auto-parses JSON
// strings back into objects, which broke that contract — connecting to
// Upstash directly with automaticDeserialization turned off guarantees
// plain strings in, plain strings out, with no hidden interpretation.
const { Redis } = require("@upstash/redis");
 
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
  automaticDeserialization: false,
});
 
module.exports = async function handler(req, res) {
  // Never let Vercel's edge network or a browser cache a storage response —
  // every read must hit Redis fresh.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    if (req.method === "GET") {
      const key = req.query.key;
      if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
      }
      const value = await redis.get(key);
      res.status(200).json({ value: value == null ? null : value, _backend: "upstash-direct-v2" });
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
      await redis.set(key, value);
      res.status(200).json({ ok: true });
      return;
    }
 
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("api/state error:", err);
    res.status(500).json({ error: "Storage request failed" });
  }
};
 
