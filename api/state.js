// Shared key/value storage for the Up Board rotation state, backed by
// Upstash Redis (connected directly, not through @vercel/kv).
//
// Contract:
//   GET  /api/state?key=<key>
//     -> { value: string|null, version: number }
//   POST /api/state  { key, value, expectedVersion }
//     -> 200 { ok: true, version: number }              (write accepted)
//     -> 409 { error: "conflict", value, version }       (someone else wrote
//                                                          first — here is the
//                                                          current data; the
//                                                          caller should merge
//                                                          its change onto it
//                                                          and retry)
//
// Why versions: the app has multiple devices reading and writing the same
// location's data. Two devices can both read, both make a change, and both
// write — without a check, whichever write lands second silently erases the
// first one's change. Every value is paired with a version counter (stored
// under `<key>__v`) so a write only succeeds if nothing has changed since
// the caller last read the data. The check-and-write happens in a single
// Lua script so it's atomic even though requests arrive over plain HTTP.
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
  automaticDeserialization: false,
});

const CAS_SCRIPT = `
local cur = tonumber(redis.call('GET', KEYS[2]) or '0')
local expected = tonumber(ARGV[1])
if cur == expected then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[2], tostring(cur + 1))
  return cur + 1
else
  return -1
end
`;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    if (req.method === "GET") {
      const key = req.query.key;
      if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
      }
      const [value, verRaw] = await Promise.all([
        redis.get(key),
        redis.get(key + "__v"),
      ]);
      const version = verRaw ? parseInt(verRaw, 10) || 0 : 0;
      res.status(200).json({ value: value == null ? null : value, version, _backend: "upstash-direct-v3" });
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const { key, value, expectedVersion } = body;
      if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
      }
      if (typeof value !== "string") {
        res.status(400).json({ error: "value must be a string" });
        return;
      }
      const expected = Number.isFinite(expectedVersion) ? expectedVersion : 0;
      const result = await redis.eval(
        CAS_SCRIPT,
        [key, key + "__v"],
        [String(expected), value]
      );
      const newVersion = Number(result);

      if (newVersion === -1) {
        const [currentValue, currentVerRaw] = await Promise.all([
          redis.get(key),
          redis.get(key + "__v"),
        ]);
        const currentVersion = currentVerRaw ? parseInt(currentVerRaw, 10) || 0 : 0;
        res.status(409).json({
          error: "conflict",
          value: currentValue == null ? null : currentValue,
          version: currentVersion,
        });
        return;
      }

      res.status(200).json({ ok: true, version: newVersion });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("api/state error:", err);
    res.status(500).json({ error: "Storage request failed" });
  }
};
