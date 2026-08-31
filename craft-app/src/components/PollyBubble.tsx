import './PollyBubble.css';

interface PollyBubbleProps {
  message?: string | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function PollyBubble({
  message,
  size = 'small',
  className = '',
}: PollyBubbleProps) {
  if (!message) return null;

  return (
    <div className={`polly-bubble polly-bubble-${size} ${className}`}>
      {message}
    </div>
  );
}