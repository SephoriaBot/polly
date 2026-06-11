import { useEffect, useState } from 'react';
import { Leaf, BookOpen, Droplets, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({ plants: 0, recipes: 0, needsWater: 0 });

  useEffect(() => {
    async function loadStats() {
      const [plantsRes, recipesRes] = await Promise.all([
        supabase.from('plants').select('id, last_watered, watering_frequency_days'),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
      ]);
      const plants = plantsRes.data || [];
      const today = new Date();
      const needsWater = plants.filter(p => {
        if (!p.last_watered || !p.watering_frequency_days) return false;
        const last = new Date(p.last_watered);
        const diff = (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= p.watering_frequency_days;
      }).length;
      setStats({ plants: plants.length, recipes: recipesRes.count || 0, needsWater });
    }
    loadStats();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Welcome back 🌸</h2>
          <p>Your craft & garden sanctuary</p>
        </div>
      </div>
      <div className="page-body">
        <div className="grid-3" style={{ marginBottom: 32 }}>
          <StatCard icon={<Leaf size={22} />} label="Plants" value={stats.plants} color="green" onClick={() => onNavigate('plants')} />
          <StatCard icon={<Droplets size={22} />} label="Need Water" value={stats.needsWater} color={stats.needsWater > 0 ? 'amber' : 'green'} onClick={() => onNavigate('plants')} />
          <StatCard icon={<BookOpen size={22} />} label="Recipes" value={stats.recipes} color="lavender" onClick={() => onNavigate('recipes')} />
        </div>

        <div className="grid-2">
          <QuickAction
            emoji="🌿"
            title="Garden"
            description="Track your plants, log waterings, and monitor growth."
            actions={[
              { label: 'View Plants', page: 'plants' },
            ]}
            onNavigate={onNavigate}
          />
          <QuickAction
            emoji="⚗️"
            title="Alchemy Lab"
            description="Browse recipes for skincare, soaps, and laundry — or run the wizard to find your perfect formula."
            actions={[
              { label: 'Browse Recipes', page: 'recipes' },
              { label: 'Start Wizard', page: 'wizard' },
            ]}
            onNavigate={onNavigate}
          />
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: '2rem' }}>✨</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>Add your first recipe</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                Build your personal apothecary — add skincare, soap, and laundry formulas to your library.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('add-recipe')}>
              <Sparkles size={15} /> Add Recipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: number; color: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    green: 'var(--green-light)',
    amber: 'var(--amber-light)',
    lavender: 'var(--lavender-light)',
    pink: 'var(--blush)',
  };
  const iconColorMap: Record<string, string> = {
    green: 'var(--green-dark)',
    amber: 'var(--amber)',
    lavender: 'var(--lavender-dark)',
    pink: 'var(--pink-dark)',
  };
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: colorMap[color], display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColorMap[color], flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--ink)' }}>{value}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ emoji, title, description, actions, onNavigate }: { emoji: string; title: string; description: string; actions: { label: string; page: string }[]; onNavigate: (p: string) => void }) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: '1.8rem' }}>{emoji}</span>
          <h3 style={{ fontSize: '1.1rem' }}>{title}</h3>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 16 }}>{description}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {actions.map(a => (
            <button key={a.page} className="btn btn-ghost btn-sm" onClick={() => onNavigate(a.page)}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
