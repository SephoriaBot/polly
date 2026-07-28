import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { GroqDailyArticle, GroqDailySubject, GroqDailyCacheEntry } from './types';

const STALE_MS = 24 * 60 * 60 * 1000;

interface SubjectFeed {
  subject: GroqDailySubject;
  articles: GroqDailyArticle[];
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
}

export function useGroqDailies() {
  const [feeds, setFeeds] = useState<SubjectFeed[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const refreshSubject = useCallback(async (subject: string) => {
    setFeeds((prev) =>
      prev.map((f) => (f.subject.subject === subject ? { ...f, loading: true, error: null } : f))
    );

    try {
      const res = await fetch('/api/groq-dailies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: GroqDailyCacheEntry = await res.json();

      await supabase
        .from('groq_dailies_cache')
        .upsert({ subject, articles: data.articles, fetched_at: data.fetched_at }, { onConflict: 'subject' });

      setFeeds((prev) =>
        prev.map((f) =>
          f.subject.subject === subject
            ? { ...f, articles: data.articles, fetchedAt: data.fetched_at, loading: false, error: null }
            : f
        )
      );
    } catch (err) {
      setFeeds((prev) =>
        prev.map((f) =>
          f.subject.subject === subject
            ? { ...f, loading: false, error: err instanceof Error ? err.message : 'Failed to refresh' }
            : f
        )
      );
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingSubjects(true);

    const { data: subjects, error: subjectsErr } = await supabase
      .from('groq_dailies_subjects')
      .select('*')
      .order('sort_order', { ascending: true });

    if (subjectsErr || !subjects) {
      setLoadingSubjects(false);
      return;
    }

    const { data: cacheRows } = await supabase.from('groq_dailies_cache').select('*');

    const cacheMap = new Map<string, GroqDailyCacheEntry>();
    (cacheRows || []).forEach((row: any) => {
      cacheMap.set(row.subject, { subject: row.subject, articles: row.articles || [], fetched_at: row.fetched_at });
    });

    const initialFeeds: SubjectFeed[] = subjects.map((s: GroqDailySubject) => {
      const cached = cacheMap.get(s.subject);
      return {
        subject: s,
        articles: cached?.articles || [],
        fetchedAt: cached?.fetched_at || null,
        loading: false,
        error: null,
      };
    });

    setFeeds(initialFeeds);
    setLoadingSubjects(false);

    initialFeeds.forEach((f) => {
      const isStale = !f.fetchedAt || Date.now() - new Date(f.fetchedAt).getTime() > STALE_MS;
      if (isStale) refreshSubject(f.subject.subject);
    });
  }, [refreshSubject]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addSubject = useCallback(
    async (subject: string) => {
      const trimmed = subject.trim();
      if (!trimmed) return;

      const { data, error } = await supabase
        .from('groq_dailies_subjects')
        .insert({ subject: trimmed, sort_order: feeds.length })
        .select()
        .single();

      if (error || !data) return;

      setFeeds((prev) => [...prev, { subject: data, articles: [], fetchedAt: null, loading: false, error: null }]);
      refreshSubject(trimmed);
    },
    [feeds.length, refreshSubject]
  );

  const removeSubject = useCallback(async (subject: string) => {
    await supabase.from('groq_dailies_subjects').delete().eq('subject', subject);
    setFeeds((prev) => prev.filter((f) => f.subject.subject !== subject));
  }, []);

  return { feeds, loadingSubjects, addSubject, removeSubject };
}
