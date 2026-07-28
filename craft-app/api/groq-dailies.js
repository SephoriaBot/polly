export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject } = req.body || {};
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ error: 'subject is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  const prompt = `Search the web for the most important news from the last 24-48 hours about: "${subject}".

Return ONLY a JSON array (no markdown, no preamble, no code fences) of up to 5 items, most recent first. Each item must have this exact shape:
{"headline": string, "summary": string (1-2 sentences, plain language), "source_name": string, "source_url": string, "published": string (e.g. "2 hours ago" or "Jul 27, 2026")}

If you find no genuinely recent news on this subject, return an empty array [].`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'groq/compound',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return res.status(502).json({ error: `Groq API error: ${errText}` });
    }

    const data = await groqResponse.json();
    const rawText = data.choices?.[0]?.message?.content || '[]';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let articles;
    try {
      articles = JSON.parse(cleaned);
      if (!Array.isArray(articles)) articles = [];
    } catch {
      articles = [];
    }

    return res.status(200).json({ subject, articles, fetched_at: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
