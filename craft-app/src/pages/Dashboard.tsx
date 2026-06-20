import { useEffect, useState } from 'react';
import { Leaf, BookOpen, Droplets, PawPrint, ShoppingCart, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    plants: 0,
    needsWater: 0,
    recipes: 0,
    pets: 0,
    groceryItems: 0,
    pantryItems: 0,
  });

  useEffect(() => {
    async function loadStats() {
      const [plantsRes, recipesRes, petsRes, groceryRes, pantryRes] = await Promise.all([
        supabase.from('plants').select('id, last_watered, watering_frequency_days'),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
        supabase.from('pets').select('id', { count: 'exact', head: true }),
        supabase.from('grocery_items').select('id', { count: 'exact', head: true }).eq('checked', false),
        supabase.from('pantry_items').select('id', { count: 'exact', head: true }),
      ]);

      const plants = plantsRes.data || [];
      const today = new Date();
      const needsWater = plants.filter(p => {
        if (!p.last_watered || !p.watering_frequency_days) return false;
        const last = new Date(p.last_watered);
        const diff = (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= p.watering_frequency_days;
      }).length;

      setStats({
        plants: plants.length,
        needsWater,
        recipes: recipesRes.count || 0,
        pets: petsRes.count || 0,
        groceryItems: groceryRes.count || 0,
        pantryItems: pantryRes.count || 0,
      });
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

        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Open Kitchen
        </div>
        <div className="grid-2" style={{ marginBottom: 28 }}>
          <StatCard icon={<ShoppingCart size={22} />} label="Grocery Items" value={stats.groceryItems} color="amber" onClick={() => onNavigate('grocery')} />
          <StatCard icon={<Archive size={22} />} label="Pantry Items" value={stats.pantryItems} color="green" onClick={() => onNavigate('pantry')} />
        </div>

        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Home
        </div>
        <div className="grid-3" style={{ marginBottom: 28 }}>
          <StatCard icon={<Leaf size={22} />} label="Plants" value={stats.plants} color="green" onClick={() => onNavigate('plants')} />
          <StatCard icon={<Droplets size={22} />} label="Need Water" value={stats.needsWater} color={stats.needsWater > 0 ? 'amber' : 'green'} onClick={() => onNavigate('plants')} />
          <StatCard icon={<PawPrint size={22} />} label="Pets" value={stats.pets} color="pink" onClick={() => onNavigate('pets')} />
        </div>

        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Craft Table
        </div>
        <div className="grid-2">
          <StatCard icon={<BookOpen size={22} />} label="Recipes" value={stats.recipes} color="lavender" onClick={() => onNavigate('recipes')} />
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
