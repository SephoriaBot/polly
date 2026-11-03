import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { localDateKey } from '../../lib/dateKey';

type Category = 'household' | 'personal_care';

interface Supply {
  id: string;
  name: string;
  category: Category;
  spares: number;
}

interface Cycle {
  id: string;
  supply_id: string;
  started_on: string;
  finished_on: string | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  household: 'Household',
  personal_care: 'Personal care',
};

const COMMON_ITEMS: Record<Category, string[]> = {
  household: [
    'Toilet paper', 'Paper towels', 'Dish soap', 'Laundry detergent', 'Dryer sheets',
    'Trash bags', 'Sponges', 'All-purpose cleaner', 'Dishwasher pods', 'Hand soap',
    'Light bulbs', 'Batteries',
  ],
  personal_care: [
    'Shampoo', 'Conditioner', 'Body wash', 'Toothpaste', 'Floss', 'Deodorant',
    'Face wash', 'Moisturizer', 'Sunscreen', 'Razors', 'Cotton rounds', 'Tampons/pads',
  ],
};

function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

function addDays(key: string, days: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function prettyDate(key: string): string {
  return parseDay(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Stats {
  avgDays: number | null;
  finishedCount: number;
  openCycle: Cycle | null;
  runOutOn: string | null;
  daysLeft: number | null;
}

function computeStats(supply: Supply, cycles: Cycle[], today: string): Stats {
  const mine = cycles.filter(c => c.supply_id === supply.id);
  const finished = mine.filter(c => c.finished_on);
  const openCycle = mine.find(c => !c.finished_on) ?? null;

  const lengths = finished.map(c => Math.max(1, daysBetween(c.started_on, c.finished_on!)));
  const avgDays = lengths.length
    ? Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length)
    : null;

  let runOutOn: string | null = null;
  let daysLeft: number | null = null;
  if (avgDays && openCycle) {
    runOutOn = addDays(openCycle.started_on, avgDays * (1 + supply.spares));
    daysLeft = daysBetween(today, runOutOn);
  }

  return { avgDays, finishedCount: finished.length, openCycle, runOutOn, daysLeft };
}

export default function SuppliesTab() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | Category>('all');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('household');

  const today = localDateKey();

  async function load() {
    const [s, c] = await Promise.all([
      supabase.from('supplies').select('id, name, category, spares').order('created_at', { ascending: true }),
      supabase.from('supply_cycles').select('id, supply_id, started_on, finished_on').order('started_on', { ascending: true }),
    ]);
    if (s.error || c.error) {
      setError((s.error ?? c.error)!.message);
    } else {
      setError(null);
      setSupplies((s.data ?? []) as Supply[]);
      setCycles((c.data ?? []) as Cycle[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error: err } = await action;
    if (err) setError(err.message);
    await load();
  }

  async function addSupply(nameOverride?: string) {
    const name = (nameOverride ?? newName).trim();
    if (!name) return;
    if (nameOverride === undefined) setNewName('');
    await run(supabase.from('supplies').insert({ name, category: newCategory }));
  }

  async function startUsing(supply: Supply) {
    // Opening a new one uses up a spare if you have one.
    if (supply.spares > 0) {
      await supabase.from('supplies').update({ spares: supply.spares - 1 }).eq('id', supply.id);
    }
    await run(supabase.from('supply_cycles').insert({ supply_id: supply.id, started_on: today }));
  }

  async function ranOut(supply: Supply, cycle: Cycle) {
    await supabase.from('supply_cycles').update({ finished_on: today }).eq('id', cycle.id);
    if (supply.spares > 0) {
      await supabase.from('supplies').update({ spares: supply.spares - 1 }).eq('id', supply.id);
      await run(supabase.from('supply_cycles').insert({ supply_id: supply.id, started_on: today }));
    } else {
      await load();
    }
  }

  async function setSpares(supply: Supply, spares: number) {
    if (spares < 0) return;
    await run(supabase.from('supplies').update({ spares }).eq('id', supply.id));
  }

  async function removeSupply(supply: Supply) {
    if (!window.confirm(`Delete "${supply.name}" and its history?`)) return;
    await run(supabase.from('supplies').delete().eq('id', supply.id));
  }

  const suggestions = useMemo(() => {
    const tracked = new Set(supplies.map(s => s.name.trim().toLowerCase()));
    return COMMON_ITEMS[newCategory].filter(n => !tracked.has(n.toLowerCase()));
  }, [supplies, newCategory]);

  const rows = useMemo(() => {
    return supplies
      .filter(s => filter === 'all' || s.category === filter)
      .map(s => ({ supply: s, stats: computeStats(s, cycles, today) }))
      .sort((a, b) => {
        // Soonest to run out first; unknowns last.
        const da = a.stats.daysLeft ?? Number.POSITIVE_INFINITY;
        const db = b.stats.daysLeft ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.supply.name.localeCompare(b.supply.name);
      });
  }, [supplies, cycles, filter, today]);

  const chipStyle = (active: boolean) => ({
    padding: '6px 12px',
    borderRadius: 999,
    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? 'var(--btn-ink)' : 'var(--ink-muted)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  });

  return (
    <>
      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1.5px solid var(--danger)', borderRadius: 16, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="section-label">Add a supply</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map(cat => (
              <button key={cat} type="button" onClick={() => setNewCategory(cat)} style={chipStyle(newCategory === cat)}>
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>

          {suggestions.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 12 }}>Tap to start tracking</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addSupply(name)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1.5px dashed var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="form-input"
              placeholder="Or type your own..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSupply(); }}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => addSupply()} disabled={!newName.trim()}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setFilter('all')} style={chipStyle(filter === 'all')}>All</button>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map(cat => (
          <button key={cat} type="button" onClick={() => setFilter(cat)} style={chipStyle(filter === cat)}>
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading...</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-muted)' }}>
            Nothing tracked yet. Add something above, tap "Start using" when you open it, and "Ran out" when it's gone.
          </div>
        </div>
      )}

      {rows.map(({ supply, stats }) => {
        const soon = stats.daysLeft !== null && stats.daysLeft <= 7;
        const accent = soon ? 'var(--danger)' : 'var(--green-dark)';

        let statusLine: string;
        if (!stats.openCycle) {
          statusLine = supply.spares > 0 ? 'Not started yet — you have spares' : 'Not in use yet';
        } else if (stats.avgDays === null) {
          statusLine = `In use since ${prettyDate(stats.openCycle.started_on)} — finish one to get an estimate`;
        } else if (stats.daysLeft !== null && stats.daysLeft < 0) {
          statusLine = `Past its usual lifespan (${-stats.daysLeft}d over)`;
        } else {
          statusLine = `About ${stats.daysLeft}d left — buy by ${prettyDate(stats.runOutOn!)}`;
        }

        return (
          <div className="card" key={supply.id}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{supply.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                    {CATEGORY_LABEL[supply.category]}
                    {stats.avgDays !== null && ` · lasts ~${stats.avgDays}d (${stats.finishedCount} tracked)`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSupply(supply)}
                  aria-label={`Delete ${supply.name}`}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: 16 }}
                >
                  ×
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginTop: 10 }}>{statusLine}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {stats.openCycle ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => ranOut(supply, stats.openCycle!)}>
                    Ran out
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => startUsing(supply)}>
                    Start using
                  </button>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-muted)' }}>
                  Spares
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSpares(supply, supply.spares - 1)} disabled={supply.spares === 0}>−</button>
                  <span style={{ minWidth: 14, textAlign: 'center', fontWeight: 800, color: 'var(--ink)' }}>{supply.spares}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSpares(supply, supply.spares + 1)}>+</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
