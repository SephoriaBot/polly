// LowEnergyChecklist.tsx
// No Energy Mode.
// Keeps the day small: priority tasks, a bite-sized work/rest timer,
// and a gentle dopamine menu of little things that may help.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import CheckMark from './CheckMark';

const CHECKLIST_KEY = 'polly-no-energy-checklist';
const DOPAMINE_KEY = 'polly-no-energy-dopamine';

interface BasicsState {
  date: string;
  ate: boolean;
  water: boolean;
  reset: boolean;
}

interface PriorityTask {
  id: string;
  label: string;
  done: boolean;
}

interface DopamineState {
  date: string;
  completed: string[];
}

interface DopamineItem {
  id: string;
  label: string;
  amount: number;
  emoji: string;
  tier: 'little' | 'medium' | 'big';
}

const DOPAMINE_ITEMS: DopamineItem[] = [
  // Little boosts
  {
    id: 'water',
    label: 'Drink a glass of water',
    amount: 5,
    emoji: '💧',
    tier: 'little',
  },
  {
    id: 'curtains',
    label: 'Open the curtains',
    amount: 5,
    emoji: '☀️',
    tier: 'little',
  },
  {
    id: 'comfy-clothes',
    label: 'Put on comfy clothes',
    amount: 5,
    emoji: '🧸',
    tier: 'little',
  },
  {
    id: 'teeth',
    label: 'Brush your teeth',
    amount: 5,
    emoji: '🪥',
    tier: 'little',
  },
  {
    id: 'face',
    label: 'Wash your face',
    amount: 5,
    emoji: '🫧',
    tier: 'little',
  },
  {
    id: 'song',
    label: 'Put on a favorite song',
    amount: 5,
    emoji: '🎧',
    tier: 'little',
  },

  // Medium boosts
  {
    id: 'get-dressed',
    label: 'Get dressed',
    amount: 10,
    emoji: '👗',
    tier: 'medium',
  },
  {
    id: 'snack',
    label: 'Make a snack',
    amount: 10,
    emoji: '🍓',
    tier: 'medium',
  },
  {
    id: 'tiny-tidy',
    label: 'Tidy one tiny area',
    amount: 10,
    emoji: '🧺',
    tier: 'medium',
  },
  {
    id: 'bed',
    label: 'Make your bed',
    amount: 10,
    emoji: '🛏️',
    tier: 'medium',
  },
  {
    id: 'tea',
    label: 'Make tea or coffee',
    amount: 10,
    emoji: '☕',
    tier: 'medium',
  },
  {
    id: 'stretch',
    label: 'Do a 5-minute stretch',
    amount: 10,
    emoji: '🌷',
    tier: 'medium',
  },

  // Bigger boosts
  {
    id: 'meal',
    label: 'Eat a real meal',
    amount: 20,
    emoji: '🍲',
    tier: 'big',
  },
  {
    id: 'shower',
    label: 'Take a shower',
    amount: 20,
    emoji: '🚿',
    tier: 'big',
  },
  {
    id: 'walk',
    label: 'Go for a little walk',
    amount: 20,
    emoji: '🌿',
    tier: 'big',
  },
  {
    id: 'hair',
    label: 'Wash your hair',
    amount: 20,
    emoji: '🧴',
    tier: 'big',
  },
  {
    id: 'creative',
    label: 'Do something creative',
    amount: 20,
    emoji: '🎨',
    tier: 'big',
  },
  {
    id: 'outside',
    label: 'Leave the house for a little while',
    amount: 20,
    emoji: '🌸',
    tier: 'big',
  },
];

function todayISO(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadBasics(): BasicsState {
  const today = todayISO();

  try {
    const stored = JSON.parse(
      localStorage.getItem(CHECKLIST_KEY) || 'null'
    );

    if (stored && stored.date === today) return stored;
  } catch {
    /* ignore */
  }

  return {
    date: today,
    ate: false,
    water: false,
    reset: false,
  };
}

function loadDopamine(): DopamineState {
  const today = todayISO();

  try {
    const stored = JSON.parse(
      localStorage.getItem(DOPAMINE_KEY) || 'null'
    );

    if (stored && stored.date === today) return stored;
  } catch {
    /* ignore */
  }

  return {
    date: today,
    completed: [],
  };
}

export default function LowEnergyChecklist({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const [basics, setBasics] = useState<BasicsState>(loadBasics);
  const [priorityTasks, setPriorityTasks] =
    useState<PriorityTask[] | null>(null);
  const [dopamine, setDopamine] =
    useState<DopamineState>(loadDopamine);

  useEffect(() => {
    localStorage.setItem(
      CHECKLIST_KEY,
      JSON.stringify(basics)
    );
  }, [basics]);

  useEffect(() => {
    localStorage.setItem(
      DOPAMINE_KEY,
      JSON.stringify(dopamine)
    );
  }, [dopamine]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('daily_tasks')
        .select('id,label,done')
        .eq('task_date', todayISO())
        .eq('priority', true)
        .order('created_at');

      setPriorityTasks((data as PriorityTask[]) ?? []);
    })();
  }, []);

  async function togglePriorityTask(task: PriorityTask) {
    const newDone = !task.done;

    setPriorityTasks(prev =>
      prev
        ? prev.map(t =>
            t.id === task.id
              ? { ...t, done: newDone }
              : t
          )
        : prev
    );

    await supabase
      .from('daily_tasks')
      .update({ done: newDone })
      .eq('id', task.id);
  }

  function toggleBasic(key: 'ate' | 'water' | 'reset') {
    setBasics(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function toggleDopamine(id: string) {
    setDopamine(prev => {
      const completed = prev.completed.includes(id)
        ? prev.completed.filter(item => item !== id)
        : [...prev.completed, id];

      return {
        ...prev,
        completed,
      };
    });
  }

  return (
    <div className="card">
      <div className="card-body">
        <div
          className="section-label"
          style={{ marginBottom: 4 }}
        >
          <Icon name="sparkle-single" size={16} /> Today, just this
        </div>

        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--ink-muted)',
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          Everything else can wait. This is the whole list.
        </p>

        {/* Priority tasks */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {priorityTasks === null ? (
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--ink-muted)',
              }}
            >
              Loading…
            </p>
          ) : priorityTasks.length > 0 ? (
            priorityTasks.map(task => (
              <ChecklistRow
                key={task.id}
                label={task.label}
                done={task.done}
                onToggle={() =>
                  togglePriorityTask(task)
                }
              />
            ))
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--cream)',
                border: '1.5px dashed var(--border)',
                borderRadius: 18,
                padding: '12px 14px',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>
                ★
              </span>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--ink-muted)',
                    fontWeight: 600,
                  }}
                >
                  Nothing starred as priority yet
                </div>

                <button
                  onClick={() =>
                    onNavigate?.('dailyplanner')
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--pink-dark)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: 0,
                    marginTop: 2,
                  }}
                >
                  Star one in the Planner →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bite-sized timer */}
        <BiteSizedTimer />

        {/* Dopamine menu */}
        <DopamineMenu
          completed={dopamine.completed}
          onToggle={toggleDopamine}
        />
      </div>
    </div>
  );
}

function ChecklistRow({
  label,
  done,
  onToggle,
}: {
  label: string;
  done: boolean;
  onToggle: () => void;
}) {
  useTheme();

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        background: done
          ? 'var(--blush)'
          : 'var(--white)',
        border: `1.5px solid ${
          done
            ? 'var(--pink-light)'
            : 'var(--border)'
        }`,
        borderRadius: 18,
        padding: '12px 14px',
      }}
    >
      <CheckMark completed={done} size={22} />

      <div
        style={{
          flex: 1,
          fontSize: '0.88rem',
          fontWeight: 600,
          color: done
            ? 'var(--ink-muted)'
            : 'var(--ink)',
          textDecoration: done
            ? 'line-through'
            : 'none',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function BiteSizedTimer() {
  const [mode, setMode] =
    useState<'work' | 'rest'>('work');
  const [secondsLeft, setSecondsLeft] =
    useState(15 * 60);
  const [running, setRunning] = useState(false);
  const [repeating, setRepeating] = useState(true);

  const WORK_SECONDS = 15 * 60;
  const REST_SECONDS = 5 * 60;

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current > 1) {
          return current - 1;
        }

        if (mode === 'work') {
          setMode('rest');
          return REST_SECONDS;
        }

        if (repeating) {
          setMode('work');
          return WORK_SECONDS;
        }

        setRunning(false);
        return 0;
      });
    }, 1000);

    return () =>
      window.clearInterval(interval);
  }, [running, mode, repeating]);

  function toggleRunning() {
    if (secondsLeft === 0) {
      setMode('work');
      setSecondsLeft(WORK_SECONDS);
    }

    setRunning(current => !current);
  }

  function resetTimer() {
    setRunning(false);
    setMode('work');
    setSecondsLeft(WORK_SECONDS);
  }

  const totalSeconds =
    mode === 'work'
      ? WORK_SECONDS
      : REST_SECONDS;

  const minutes = Math.floor(
    secondsLeft / 60
  );
  const seconds = secondsLeft % 60;

  const timeDisplay = `${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')}`;

  const progress =
    totalSeconds > 0
      ? ((totalSeconds - secondsLeft) /
          totalSeconds) *
        100
      : 0;

  const isWork = mode === 'work';

  return (
    <div
      style={{
        marginTop: 4,
        padding: '16px',
        borderRadius: 22,
        background: 'var(--cream)',
        border: '1.5px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--ink)',
            }}
          >
            <span style={{ fontSize: '1rem' }}>
              {isWork ? '🌷' : '☕'}
            </span>

            {isWork
              ? 'Tiny focus time'
              : 'Tiny rest time'}
          </div>

          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--ink-muted)',
              marginTop: 2,
            }}
          >
            {isWork
              ? 'Just 15 minutes. That’s all you need to do.'
              : 'You did enough for now. Take 5 minutes.'}
          </div>
        </div>

        <button
          onClick={() =>
            setRepeating(current => !current)
          }
          style={{
            border: '1px solid var(--border)',
            background: repeating
              ? 'var(--blush)'
              : 'var(--white)',
            color: 'var(--ink)',
            borderRadius: 14,
            padding: '6px 9px',
            fontSize: '0.68rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {repeating ? '↻ Repeat' : '↻ Once'}
        </button>
      </div>

      <div
        style={{
          width: '100%',
          height: 7,
          background: 'var(--white)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'var(--pink)',
            borderRadius: 999,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: '2rem',
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            margin: '4px 0 12px',
          }}
        >
          {timeDisplay}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
          }}
        >
          <button
            onClick={toggleRunning}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 15,
              padding: '10px 14px',
              background: 'var(--pink)',
              color: 'white',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {running
              ? 'Pause'
              : secondsLeft === 0
              ? 'Start again'
              : 'Start'}
          </button>

          <button
            onClick={resetTimer}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 15,
              padding: '10px 13px',
              background: 'var(--white)',
              color: 'var(--ink-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        <div
          style={{
            marginTop: 9,
            fontSize: '0.65rem',
            color: 'var(--ink-muted)',
            textAlign: 'center',
          }}
        >
          {repeating
            ? '15 min work → 5 min rest → repeat'
            : '15 min work → 5 min rest → done'}
        </div>
      </div>
    </div>
  );
}

function DopamineMenu({
  completed,
  onToggle,
}: {
  completed: string[];
  onToggle: (id: string) => void;
}) {
  const little = DOPAMINE_ITEMS.filter(
    item => item.tier === 'little'
  );

  const medium = DOPAMINE_ITEMS.filter(
    item => item.tier === 'medium'
  );

  const big = DOPAMINE_ITEMS.filter(
    item => item.tier === 'big'
  );

  const completedCount = completed.length;

  return (
    <div
      style={{
        marginTop: 16,
        padding: '16px',
        borderRadius: 22,
        background: 'var(--white)',
        border: '1.5px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--ink)',
            }}
          >
            <span style={{ fontSize: '1.05rem' }}>
              ✨
            </span>
            Dopamine menu
          </div>

          <p
            style={{
              fontSize: '0.7rem',
              lineHeight: 1.4,
              color: 'var(--ink-muted)',
              margin: '4px 0 0',
            }}
          >
            Pick something that sounds nice. Tiny things count.
          </p>
        </div>

        {completedCount > 0 && (
          <div
            style={{
              flexShrink: 0,
              background: 'var(--blush)',
              color: 'var(--pink-dark)',
              borderRadius: 999,
              padding: '5px 9px',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {completedCount} little win
            {completedCount === 1 ? '' : 's'}
          </div>
        )}
      </div>

      <DopamineSection
        title="♡ Tiny boost"
        subtitle="For when you have almost no energy"
        items={little}
        completed={completed}
        onToggle={onToggle}
      />

      <DopamineSection
        title="♡ A little more"
        subtitle="For when you have some energy to spare"
        items={medium}
        completed={completed}
        onToggle={onToggle}
      />

      <DopamineSection
        title="♡ Bigger boost"
        subtitle="Only if it feels doable today"
        items={big}
        completed={completed}
        onToggle={onToggle}
      />

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: '0.64rem',
          color: 'var(--ink-muted)',
          lineHeight: 1.4,
        }}
      >
        You don't have to earn anything.
        <br />
        These are just little suggestions for feeling a bit better. ♡
      </div>
    </div>
  );
}

function DopamineSection({
  title,
  subtitle,
  items,
  completed,
  onToggle,
}: {
  title: string;
  subtitle: string;
  items: DopamineItem[];
  completed: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ marginBottom: 7 }}>
        <div
          style={{
            fontSize: '0.73rem',
            fontWeight: 700,
            color: 'var(--ink)',
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: '0.61rem',
            color: 'var(--ink-muted)',
            marginTop: 1,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(2, minmax(0, 1fr))',
          gap: 7,
        }}
      >
        {items.map(item => {
          const isDone = completed.includes(item.id);

          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                textAlign: 'left',
                border: `1.5px solid ${
                  isDone
                    ? 'var(--pink-light)'
                    : 'var(--border)'
                }`,
                background: isDone
                  ? 'var(--blush)'
                  : 'var(--cream)',
                borderRadius: 15,
                padding: '9px 9px',
                cursor: 'pointer',
                opacity: isDone ? 0.72 : 1,
              }}
            >
              <span
                style={{
                  fontSize: '1rem',
                  flexShrink: 0,
                  filter: isDone
                    ? 'grayscale(0.3)'
                    : 'none',
                }}
              >
                {item.emoji}
              </span>

              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.67rem',
                    lineHeight: 1.25,
                    fontWeight: 600,
                    color: isDone
                      ? 'var(--ink-muted)'
                      : 'var(--ink)',
                    textDecoration: isDone
                      ? 'line-through'
                      : 'none',
                  }}
                >
                  {item.label}
                </span>

                <span
                  style={{
                    display: 'block',
                    marginTop: 3,
                    fontSize: '0.59rem',
                    lineHeight: 1,
                    fontWeight: 700,
                    color: 'var(--pink-dark)',
                  }}
                >
                  +{item.amount} dopamine
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}