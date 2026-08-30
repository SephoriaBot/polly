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
  neutral: '/assets/pollyhamster/polly_0.PNG',
  confused: '/assets/pollyhamster/polly_1.JPG',
  disappointed: '/assets/pollyhamster/polly_2.JPG',
  searching: '/assets/pollyhamster/polly_3.JPG',
  mad: '/assets/pollyhamster/polly_4.JPG',
  cheering: '/assets/pollyhamster/polly_5.JPG',
  yawning: '/assets/pollyhamster/polly_6.JPG',
  happy: '/assets/pollyhamster/polly_7.JPG',
  sad: '/assets/pollyhamster/polly_8.JPG',
  surprised: '/assets/pollyhamster/polly_9.JPG',
  love: '/assets/pollyhamster/polly_10.JPG',
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