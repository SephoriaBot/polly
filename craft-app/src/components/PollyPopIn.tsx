import Polly from './Polly';
import PollyBubble from './PollyBubble';
import { usePollyPopIn } from '../hooks/usePollyPopIn';
import './PollyPopIn.css';

export default function PollyPopIn({ page }: { page: string }) {
  const { visible, mood, message, dismiss } = usePollyPopIn(page);

  if (!visible) return null;

  return (
    <div
      className="polly-popin"
      onClick={dismiss}
      role="button"
      aria-label="Dismiss Polly"
    >
      <PollyBubble message={message} size="medium" />
      <Polly mood={mood} size="medium" />
    </div>
  );
}
