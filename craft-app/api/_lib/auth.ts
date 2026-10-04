/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

// Returns the signed-in user's id from a *verified* Supabase session token, or null.
// Supabase's own Auth server checks the token, so there's no secret to manage here.
export async function getUserId(req: VercelRequest): Promise<string | null> {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  // The URL and anon key are public values, so the VITE_ names work here too.
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('Supabase URL / anon key are not set on the server');
    return null;
  }

  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// Best-effort per-user throttle (resets when a server instance restarts).
const buckets = new Map<string, number[]>();
export function throttled(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return recent.length > max;
}
