import './Polly.css';

export type PollyMood =
  | 'neutral'
  | 'confused'
  | 'disappointed'
  | 'searching'
  | 'mad'
  | 'cheering'
  | 'yawning'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'love';

const POLLY_IMAGES: Record<PollyMood, string> = {
  neutral: '/assets/pollyhamster/polly_0.png',
  confused: '/assets/pollyhamster/polly_1.png',
  disappointed: '/assets/pollyhamster/polly_2.png',
  searching: '/assets/pollyhamster/polly_3.png',
  mad: '/assets/pollyhamster/polly_4.png',
  cheering: '/assets/pollyhamster/polly_5.png',
  yawning: '/assets/pollyhamster/polly_6.png',
  happy: '/assets/pollyhamster/polly_7.png',
  sad: '/assets/pollyhamster/polly_8.png',
  surprised: '/assets/pollyhamster/polly_9.png',
  love: '/assets/pollyhamster/polly_10.png',
};

interface PollyProps {
  mood?: PollyMood;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  className?: string;
  alt?: string;
  animate?: boolean;
}

export default function Polly({
  mood = 'neutral',
  size = 'medium',
  className = '',
  alt = 'Polly',
  animate = true,
}: PollyProps) {
  return (
    <div
      className={`polly polly-${size} ${
        animate ? 'polly-animate' : ''
      } ${className}`}
    >
      <img
        src={POLLY_IMAGES[mood]}
        alt={alt}
        className="polly-image"
      />
    </div>
  );
}