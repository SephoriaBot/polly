import { supabase } from './supabase';

// fetch() that attaches the signed-in user's Supabase session token.
// The server checks this token, so API keys can stay on the server.
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}

// Calls the server's Groq proxy. The server picks the model and holds the key;
// send only the prompt and optional temperature / max_tokens.
export function groqFetch(body: {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  temperature?: number;
  max_tokens?: number;
}): Promise<Response> {
  return authedFetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
