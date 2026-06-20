import { useEffect, useState } from 'react';
import { Leaf, BookOpen, Droplets, PawPrint, ShoppingCart, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

interface ReminderItem {
  id: string;
  label: string;
  detail: string;
  dueDate: Date;
  page: string;
  emoji: string;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    plants: 0,
    recipes: 0,
    pets: 0,
    groceryItems: 0,
    pantryItems: 0,
  });
  const [soonReminders, setSoonReminders] = useState<ReminderItem[]>([]);
  const [laterReminders, setLaterReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    async function loadStats() {
      const [plantsRes, recipesRes, petsRes, groceryRes, pantryRes, vaccinationsRes] = await Promise.all([
        supabase.from('plants').select('id, name, last_watered, watering_frequency_days'),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
        supabase.from('pets').select('id, name'),
        supabase.from('grocery_items').select('id', { count: 'exact', head: true }).eq('checked', false),
        supabase.from('pantry_items').select('id', { count: 'exact', head: true }),
        supabase.from('pet_vaccinations').select('id, name, pet_id, next_due'),
      ]);

      const plants = plantsRes.data || [];
      const pets = petsRes.data || [];
      const vaccinations = vaccinationsRes.data || [];
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
        pets: pets.length,
        groceryItems: groceryRes.count || 0,
        pantryItems: pantryRes.count || 0,
      });

      // Build reminder list: plant watering due/overdue + vaccines due
      const allReminders: ReminderItem[] = [];

      plants.forEach(p => {
        if (!p.last_watered || !p.watering_frequency_days) return;
        const last = new Date(p.last_watered);
        const dueDate = new Date(last.getTime() + p.watering_frequency_days * 86400000);
        allReminders.push({
          id: `plant-${p.id}`,
          label: p.name,
          detail: dueDate < today ? 'water overdue' : 'water due',
          dueDate,
          page: 'plants',
          emoji: '💧',
        });
      });

      vaccinations.forEach(v => {
        if (!v.next_due) return;
        const pet = pets.find(p => p.id === v.pet_id);
        allReminders.push({
          id: `vax-${v.id}`,
          label: `${pet?.name ?? 'Pet'} — ${v.name}`,
          detail: new Date(v.next_due) < today ? 'vaccine overdue' : 'vaccine due',
          dueDate: new Date(v.next_due),
          page: 'pets',
          emoji: '💉',
        });
      });

      const soon = allReminders
        .filter(r => {
          const diffDays = (r.dueDate.getTime() - today.getTime()) / 86400000;
          return diffDays <= 30;
        })
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      const later = allReminders
        .filter(r => {
          const diffDays = (r.dueDate.getTime() - today.getTime()) / 86400000;
          return diffDays > 30;
        })
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      setSoonReminders(soon);
      setLaterReminders(later);
    }
    loadStats();
  }, []);

  function formatDueLabel(date: Date) {
    const today = new Date();
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 30) return `in ${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Welcome back 🌸</h2>
          <p>Your craft & garden sanctuary</p>
        </div>
      </div>
      <div className="page-body">

        {(soonReminders.length > 0 || laterReminders.length > 0) && (
          <div style={{ marginBottom: 32 }}>

            {soonReminders.length > 0 && (
              <div style={{ marginBottom: laterReminders.length > 0 ? 14 : 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Soon
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {soonReminders.map(r => (
                    <div
                      key={r.id}
                      onClick={() => onNavigate(r.page)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--white)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontSize: '1.05rem' }}>{r.emoji}</span>
                      <span style={{ flex: 1, color: 'var(--ink)' }}>
                        {r.label} <span style={{ color: 'var(--ink-muted)' }}>· {r.detail}</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {formatDueLabel(r.dueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {laterReminders.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Later
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {laterReminders.map(r => (
                    <div
                      key={r.id}
                      onClick={() => onNavigate(r.page)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--cream)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
                        fontSize: '0.82rem', opacity: 0.8,
                      }}
                    >
                      <span style={{ fontSize: '0.95rem' }}>{r.emoji}</span>
                      <span style={{ flex: 1, color: 'var(--ink-soft)' }}>
                        {r.label} <span style={{ color: 'var(--ink-muted)' }}>· {r.detail}</span>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {formatDueLabel(r.dueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

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
