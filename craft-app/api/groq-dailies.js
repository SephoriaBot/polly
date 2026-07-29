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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  const prompt = `You're helping someone stay informed about: "${subject}".

You do not have live internet access, so base this on what you know as of your training. Return ONLY a JSON array (no markdown, no preamble, no code fences) of up to 5 items that would help someone understand the current state, context, or background of this topic. Each item must have this exact shape:
{"headline": string, "summary": string (1-2 sentences, plain language), "source_name": string (use "AI summary" if not citing a specific outlet), "source_url": string (empty string "" if none), "published": string (use "background" if not date-specific)}

If you genuinely have nothing useful to say about this subject, return an empty array [].`;

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
