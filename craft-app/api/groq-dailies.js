export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { subject } = body || {};
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ error: 'subject is required' });
  }

  const apiKey = process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `Share interesting facts and tidbits about: "${subject}".

Return ONLY a JSON array (no markdown, no preamble, no code fences) of 6-8 items, covering a good variety of angles (history, science, quirks, lesser-known details). Each item must have this exact shape:
{"headline": string (a short, punchy title for the fact, under 8 words), "summary": string (2-3 sentences explaining the fact in an engaging, easy way), "source_name": string (a short category tag like "History" or "Science" or "Fun Fact"), "source_url": "", "published": ""}

Return an empty array [] only if you truly know nothing about this subject.`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
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
