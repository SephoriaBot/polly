import { useState } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import { useGroqDailies } from './useGroqDailies';

export default function GroqDailies() {
  const { feeds, loadingSubjects, addSubject, removeSubject } = useGroqDailies();
  const [newSubject, setNewSubject] = useState('');

  const handleAdd = () => {
    if (!newSubject.trim()) return;
    addSubject(newSubject);
    setNewSubject('');
  };

  return (
    <div
      style={{
        background: 'var(--color-cream, #fdf6ec)',
        border: '1px solid var(--color-gold, #e8c78a)',
        borderRadius: 20,
        padding: '20px 22px',
        fontFamily: 'var(--font-body, "Nunito Sans", sans-serif)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Sparkles size={20} color="var(--color-pink, #e8a2b0)" />
        <h2
          style={{
            fontFamily: 'var(--font-heading, "Fraunces", serif)',
            fontSize: 20,
            margin: 0,
            color: 'var(--color-text, #4a3b32)',
          }}
        >
          Groq Dailies
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a subject to learn about…"
          style={{
            flex: 1,
            minWidth: 160,
            padding: '8px 12px',
            borderRadius: 999,
            border: '1px solid var(--color-gold, #e8c78a)',
            background: 'white',
            fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
            fontSize: 13,
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 14px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--color-pink, #e8a2b0)',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {loadingSubjects && <p style={{ opacity: 0.6 }}>Loading your subjects…</p>}

      {!loadingSubjects && feeds.length === 0 && (
        <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No subjects yet — add one above 🌼</p>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          maxHeight: 420,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        {feeds.map((feed) => (
          <div key={feed.subject.subject}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'sticky', top: 0, background: 'var(--color-cream, #fdf6ec)', paddingBottom: 4 }}>
              <span
                style={{
                  background: 'var(--color-apricot, #f6c9a0)',
                  color: '#5a4130',
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                }}
              >
                {feed.subject.subject}
              </span>
              {feed.loading && <span style={{ fontSize: 12, opacity: 0.6 }}>loading facts…</span>}
              <button
                onClick={() => removeSubject(feed.subject.subject)}
                aria-label={`Remove ${feed.subject.subject}`}
                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.5 }}
              >
                <X size={14} />
              </button>
            </div>

            {feed.error && <p style={{ color: '#c0685a', fontSize: 13 }}>Couldn't refresh: {feed.error}</p>}

            {!feed.loading && !feed.error && feed.articles.length === 0 && (
              <p style={{ opacity: 0.6, fontSize: 13 }}>No facts yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {feed.articles.map((article, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'white',
                    border: '1px solid var(--color-gold, #e8c78a)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'var(--font-heading, "Fraunces", serif)',
                      fontSize: 15,
                      marginBottom: 4,
                      color: 'var(--color-text, #4a3b32)',
                    }}
                  >
                    {article.source_name && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          background: 'var(--color-cream, #fdf6ec)',
                          padding: '2px 8px',
                          borderRadius: 999,
                          color: 'var(--color-pink, #e8a2b0)',
                        }}
                      >
                        {article.source_name}
                      </span>
                    )}
                    {article.headline}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>{article.summary}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
