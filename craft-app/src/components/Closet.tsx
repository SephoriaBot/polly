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
import { outfitIconPath, hatIdFromAssetKey } from '../creatures/equipRender';
import Polly from './Polly';

type CosmeticSlot = 'headwear' | 'outfits';

interface OwnedCosmetic {
  cosmeticId: string;
  name: string;
  assetKey: string;
  rarity: string | null;
  slot: CosmeticSlot;
}

export default function Closet() {
  const { user } = useAuth();
  const { equippedHeadwear, setEquippedHeadwear, equippedOutfit, setEquippedOutfit } = usePollyCompanion();
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
        .select('cosmetic_id, cosmetics(id, name, asset_key, rarity, slot)')
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
            slot: (cosmetic?.slot ?? 'headwear') as CosmeticSlot,
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

  async function handleEquip(item: OwnedCosmetic, alreadyEquipped: boolean) {
    setPendingId(item.cosmeticId);
    const { error } =
      item.slot === 'outfits'
        ? await setEquippedOutfit(alreadyEquipped ? null : item.cosmeticId)
        : await setEquippedHeadwear(alreadyEquipped ? null : item.cosmeticId);
    setPendingId(null);

    if (error) {
      showToast(`Couldn't equip ${item.name}: ${error}`, 'error');
    } else {
      showToast(alreadyEquipped ? `${item.name} removed` : `${item.name} equipped!`, 'success');
    }
  }

  function iconSrcFor(item: OwnedCosmetic): string {
    return item.slot === 'outfits'
      ? outfitIconPath(hatIdFromAssetKey(item.assetKey))
      : `/assets/cosmetics/headwear/${item.assetKey}.png`;
  }

  if (loading) {
    return <div className="section-label">Loading your closet…</div>;
  }

  if (owned.length === 0) {
    return (
      <div className="empty-state">
        <p>No cosmetics unlocked yet — complete quests to win headwear and outfits for your companion.</p>
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
          const isEquipped =
            item.slot === 'outfits'
              ? equippedOutfit?.id === item.cosmeticId
              : equippedHeadwear?.id === item.cosmeticId;
          const isPending = pendingId === item.cosmeticId;

          return (
            <button
              key={item.cosmeticId}
              onClick={() => handleEquip(item, isEquipped)}
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
                src={iconSrcFor(item)}
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
