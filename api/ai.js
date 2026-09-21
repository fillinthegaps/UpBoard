// Server-side proxy to Anthropic's Messages API. Keeps ANTHROPIC_API_KEY on
// the server — the browser never sees it, only ever calls this endpoint.
// Used by "Draft reminder" (samples tracker) and "Ask the board" / "Weekly
// summary" (manager dashboard).
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Server is missing ANTHROPIC_API_KEY. Add it in the Vercel project's Environment Variables settings and redeploy.",
    });
    return;
  }

  const { prompt, maxTokens } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: typeof maxTokens === "number" ? maxTokens : 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("Anthropic API error:", data);
      res.status(upstream.status).json({ error: (data && data.error && data.error.message) || "Upstream request failed" });
      return;
    }
    // Passed through as-is — the client already knows how to read
    // Anthropic's Messages API response shape (data.content[].text).
    res.status(200).json(data);
  } catch (err) {
    console.error("api/ai error:", err);
    res.status(502).json({ error: "Failed to reach Claude API" });
  }
};
