import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePollyMeeting() {
  const [hasMetPolly, setHasMetPolly] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkMeeting() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('polly_meetings')
        .select('has_met_polly, meet_count')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) console.error('Polly meeting check failed:', error);

      const alreadyMet = data?.has_met_polly ?? false;

      if (!cancelled) {
        setHasMetPolly(alreadyMet);
        setLoading(false);
      }

      await supabase.from('polly_meetings').upsert({
        user_id: user.id,
        has_met_polly: true,
        first_met_at: alreadyMet ? undefined : new Date().toISOString(),
        meet_count: (data?.meet_count ?? 0) + 1,
        last_seen_at: new Date().toISOString(),
      });
    }

    checkMeeting();
    return () => { cancelled = true; };
  }, []);

  return { hasMetPolly, loading };
}
