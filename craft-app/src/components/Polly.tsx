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
// (the wereham set was drawn first and is the most complete), so moods
// that don't have a dedicated pose fall back to the closest equivalent
// for that species rather than breaking the image.
const POLLY_IMAGES: Record<PollySpecies, Record<PollyMood, string>> = {
  wereham: {
    neutral: '/assets/pollywereham/pollyneutral.png',
    confused: '/assets/pollywereham/pollysearching.png',
    disappointed: '/assets/pollywereham/pollysad.png',
    searching: '/assets/pollywereham/pollysearching.png',
    mad: '/assets/pollywereham/pollymad.png',
    cheering: '/assets/pollywereham/pollyhappy.png',
    yawning: '/assets/pollywereham/pollysleeping.png',
    happy: '/assets/pollywereham/pollyhappy.png',
    sad: '/assets/pollywereham/pollysad.png',
    surprised: '/assets/pollywereham/pollyhappy.png',
    love: '/assets/pollywereham/pollyhappy.png',
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
  bunt: {
    neutral: '/assets/pollybunt/pollybuntneutral.png',
    confused: '/assets/pollybunt/pollybuntsurprised.png',
    disappointed: '/assets/pollybunt/pollybuntsad.png',
    searching: '/assets/pollybunt/pollybuntsearching.png',
    mad: '/assets/pollybunt/pollybuntmad.png',
    cheering: '/assets/pollybunt/pollybunthappy.png',
    yawning: '/assets/pollybunt/pollybuntsleeping.png',
    happy: '/assets/pollybunt/pollybunthappy.png',
    sad: '/assets/pollybunt/pollybuntsad.png',
    surprised: '/assets/pollybunt/pollybuntscared.png',
    love: '/assets/pollybunt/pollybunthappy.png',
  },
  wrendel: {
    neutral: '/assets/pollywrendel/pollywrendelneutral.png',
    confused: '/assets/pollywrendel/pollywrendelsurprised.png',
    disappointed: '/assets/pollywrendel/pollywrendelsad.png',
    searching: '/assets/pollywrendel/pollywrendelsearching.png',
    mad: '/assets/pollywrendel/pollywrendelmad.png',
    cheering: '/assets/pollywrendel/pollywrendelhappy.png',
    yawning: '/assets/pollywrendel/pollywrendelsleeping.png',
    happy: '/assets/pollywrendel/pollywrendelhappy.png',
    sad: '/assets/pollywrendel/pollywrendelsad.png',
    surprised: '/assets/pollywrendel/pollywrendelscared.png',
    love: '/assets/pollywrendel/pollywrendelhappy.png',
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