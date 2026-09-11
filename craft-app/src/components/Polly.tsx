import './Polly.css';
import { usePollyCompanion, type PollySpecies } from '../context/PollyCompanionContext';

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

// Each species has its own set of expression art living in its own
// /public/assets folder. Not every species has a 1:1 pose for every mood
// (the hamster set was drawn first and is the most complete), so moods
// that don't have a dedicated pose fall back to the closest equivalent
// for that species rather than breaking the image.
const POLLY_IMAGES: Record<PollySpecies, Record<PollyMood, string>> = {
  hamster: {
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
  },
  noodle: {
    neutral: '/assets/pollynoodle/pollynoodle_neutral.png',
    confused: '/assets/pollynoodle/pollynoodle_curious.png',
    disappointed: '/assets/pollynoodle/pollynoodle_sad.png',
    searching: '/assets/pollynoodle/pollynoodle_curious.png',
    mad: '/assets/pollynoodle/pollynoodle_angry.png',
    cheering: '/assets/pollynoodle/pollynoodle_excited.png',
    yawning: '/assets/pollynoodle/pollynoodle_sleeping.png',
    happy: '/assets/pollynoodle/pollynoodle_happy.png',
    sad: '/assets/pollynoodle/pollynoodle_sad.png',
    surprised: '/assets/pollynoodle/pollynoodle_surprised.png',
    love: '/assets/pollynoodle/pollynoodle_wink.png',
  },
  dragon: {
    neutral: '/assets/pollydragon/pollydragon_neutral.png',
    confused: '/assets/pollydragon/pollydragon_surprised.png',
    disappointed: '/assets/pollydragon/pollydragon_scared.png',
    searching: '/assets/pollydragon/pollydragon_neutral.png',
    mad: '/assets/pollydragon/pollydragon_mad.png',
    cheering: '/assets/pollydragon/pollydragon_excited.png',
    yawning: '/assets/pollydragon/pollydragon_sleeping.png',
    happy: '/assets/pollydragon/pollydragon_happy.png',
    sad: '/assets/pollydragon/pollydragon_scared.png',
    surprised: '/assets/pollydragon/pollydragon_surprised.png',
    love: '/assets/pollydragon/pollydragon_happy.png',
  },
};

interface PollyProps {
  mood?: PollyMood;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  className?: string;
  alt?: string;
  animate?: boolean;
  /** Optional override — defaults to the user's chosen companion. */
  species?: PollySpecies;
}

export default function Polly({
  mood = 'neutral',
  size = 'medium',
  className = '',
  alt = 'Polly',
  animate = true,
  species,
}: PollyProps) {
  const { species: chosenSpecies } = usePollyCompanion();
  const activeSpecies = species ?? chosenSpecies;

  return (
    <div
      className={`polly polly-${size} ${
        animate ? 'polly-animate' : ''
      } ${className}`}
    >
      <img
        src={POLLY_IMAGES[activeSpecies][mood]}
        alt={alt}
        className="polly-image"
      />
    </div>
  );
}