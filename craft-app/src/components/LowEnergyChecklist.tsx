// LowEnergyChecklist.tsx
// No Energy Mode. Reduce the day down to priority tasks plus a few gentle basics.
// Includes a bite-sized 15-minute work / 5-minute rest timer that can repeat.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';
import CheckMark from './CheckMark';

const CHECKLIST_KEY = 'polly-no-energy-checklist';

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

type TimerMode = 'work' | 'rest';

const WORK_SECONDS = 15 * 60;
const REST_SECONDS = 5 * 60;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadBasics(): BasicsState {
  const today = todayISO();

  try {
    const stored = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || 'null');
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

export default function LowEnergyChecklist({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const [basics, setBasics] = useState<BasicsState>(loadBasics);
  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[] | null>(null);

  useEffect(() => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(basics));
  }, [basics]);

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
            t.id === task.id ? { ...t, done: newDone } : t
          )
        : prev
    );

    await supabase
      .from('daily_tasks')
      .update({ done: newDone })
      .eq('id', task.id);
  }

  function toggleBasic(key: 'ate' | 'water' | 'reset') {
    setBasics(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 4 }}>
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom:
              priorityTasks && priorityTasks.length > 0 ? 12 : 6,
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
                onToggle={() => togglePriorityTask(task)}
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
              <span style={{ fontSize: '1.2rem' }}>★</span>

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
                  onClick={() => onNavigate?.('dailyplanner')}
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

        <BiteSizedTimer />
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
        background: done ? 'var(--blush)' : 'var(--white)',
        border: `1.5px solid ${
          done ? 'var(--pink-light)' : 'var(--border)'
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
          color: done ? 'var(--ink-muted)' : 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function BiteSizedTimer() {
  const [mode, setMode] = useState<TimerMode>('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const [repeating, setRepeating] = useState(true);

  const totalSeconds =
    mode === 'work' ? WORK_SECONDS : REST_SECONDS;

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

    return () => window.clearInterval(interval);
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

  function toggleRepeating() {
    setRepeating(current => !current);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  const progress =
    totalSeconds > 0
      ? ((totalSeconds - secondsLeft) / totalSeconds) * 100
      : 0;

  const isWork = mode === 'work';

  return (
    <div
      style={{
        marginTop: 14,
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

            {isWork ? 'Tiny focus time' : 'Tiny rest time'}
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
          onClick={toggleRepeating}
          aria-label={
            repeating
              ? 'Turn repeating timer off'
              : 'Turn repeating timer on'
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
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