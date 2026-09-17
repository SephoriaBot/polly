// Closet.tsx
// Location: craft-app/src/creatures/Closet.tsx
//
// Lets the user see every cosmetic they've unlocked (via quests) and equip
// one as headwear on their companion. Equipping calls
// PollyCompanionContext.setEquippedHeadwear, which updates
// polly_companion.equipped_headwear_id — every <Polly /> instance across the
// app (dashboard, popups, everywhere) picks the change up automatically.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePollyCompanion } from '../context/PollyCompanionContext';
import { useToast } from '../hooks/useToast';
import Polly from './Polly';

interface OwnedCosmetic {
  cosmeticId: string;
  name: string;
  assetKey: string;
  rarity: string | null;
}

export default function Closet() {
  const { user } = useAuth();
  const { equippedHeadwear, setEquippedHeadwear } = usePollyCompanion();
  const { showToast } = useToast();
  const [owned, setOwned] = useState<OwnedCosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('user_cosmetics')
        .select('cosmetic_id, cosmetics(id, name, asset_key, rarity)')
        .order('unlocked_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('Failed to load owned cosmetics:', error);
        setOwned([]);
      } else {
        const rows = (data ?? []).map((row: any) => {
          const cosmetic = Array.isArray(row.cosmetics) ? row.cosmetics[0] : row.cosmetics;
          return {
            cosmeticId: row.cosmetic_id as string,
            name: cosmetic?.name ?? 'Unknown item',
            assetKey: cosmetic?.asset_key ?? '',
            rarity: cosmetic?.rarity ?? null,
          };
        });
        setOwned(rows);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleEquip(cosmeticId: string, itemName: string, alreadyEquipped: boolean) {
    setPendingId(cosmeticId);
    const { error } = await setEquippedHeadwear(alreadyEquipped ? null : cosmeticId);
    setPendingId(null);

    if (error) {
      showToast(`Couldn't equip ${itemName}: ${error}`, 'error');
    } else {
      showToast(alreadyEquipped ? `${itemName} removed` : `${itemName} equipped!`, 'success');
    }
  }

  if (loading) {
    return <div className="section-label">Loading your closet…</div>;
  }

  if (owned.length === 0) {
    return (
      <div className="empty-state">
        <p>No cosmetics unlocked yet — complete quests to win headwear for your companion.</p>
      </div>
    );
  }

  return (
    <div className="closet">
      <div className="closet-preview">
        <Polly mood="happy" size="large" />
      </div>

      <div
        className="closet-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        {owned.map(item => {
          const isEquipped = equippedHeadwear?.id === item.cosmeticId;
          const isPending = pendingId === item.cosmeticId;

          return (
            <button
              key={item.cosmeticId}
              onClick={() => handleEquip(item.cosmeticId, item.name, isEquipped)}
              disabled={isPending}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: 10,
                borderRadius: 12,
                border: `1.5px solid ${isEquipped ? 'var(--primary)' : 'var(--border)'}`,
                background: isEquipped ? 'var(--primary-soft, rgba(0,0,0,0.04))' : 'transparent',
                cursor: isPending ? 'default' : 'pointer',
                opacity: isPending ? 0.6 : 1,
                color: 'var(--text, inherit)',
                font: 'inherit',
                textAlign: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <img
                src={`/assets/cosmetics/headwear/${item.assetKey}.png`}
                alt={item.name}
                style={{ width: 48, height: 48, objectFit: 'contain' }}
              />
              <span style={{ fontSize: 13, color: 'inherit' }}>{item.name}</span>
              <span style={{ fontSize: 11, opacity: 0.7, color: 'inherit' }}>
                {isPending ? '…' : isEquipped ? 'Equipped — tap to remove' : 'Tap to equip'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
