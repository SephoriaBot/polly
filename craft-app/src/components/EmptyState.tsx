import Icon from '../Icon';

// src/components/EmptyState.tsx
interface EmptyStateProps {
  image: string;
  message: string;
  subMessage?: string;
}

export default function EmptyState({ image, message, subMessage }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '2rem 1rem',
    }}>
      <img src={image} alt="" style={{ width: '180px', marginBottom: '1rem' }} />
      <p style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '1.1rem',
        color: 'var(--color-text)',
        margin: 0,
      }}>{message}</p>
      {subMessage && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--color-text-muted)',
          marginTop: '0.25rem',
        }}>{subMessage}</p>
      )}
    </div>
  );
}
