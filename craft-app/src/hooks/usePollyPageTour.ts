import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function usePollyPageTour(page: string) {
  const [showTour, setShowTour] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecked(false);
    setShowTour(false);

    async function checkTour() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setChecked(true); return; }

      const { data, error } = await supabase
        .from('polly_page_tours')
        .select('page')
        .eq('user_id', user.id)
        .eq('page', page)
        .maybeSingle();

      if (error) console.error('Polly tour check failed:', error);

      if (!cancelled) {
        setShowTour(!data);
        setChecked(true);
      }
    }

    checkTour();
    return () => { cancelled = true; };
  }, [page]);

  const dismissTour = useCallback(async () => {
    setShowTour(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('polly_page_tours')
      .upsert({ user_id: user.id, page, seen_at: new Date().toISOString() });
    if (error) console.error('Polly tour dismiss failed:', error);
  }, [page]);

  return { showTour: checked && showTour, dismissTour };
}