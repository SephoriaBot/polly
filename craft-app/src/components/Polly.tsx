import './Polly.css';
import { usePollyCompanion, type PollySpecies } from '../context/PollyCompanionContext';
import { resolveEquipRender, hatIdFromAssetKey, type Expression } from '../creatures/equipRender';

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

// Headwear only has 3 expressions (happy/sad/thinking) vs. the body's 11
// moods, so multiple moods collapse onto the same hat pose. "thinking" is
// used for anything puzzled/searching/neutral-ish; "sad" covers anything
// negative; everything upbeat gets "happy".
const MOOD_TO_EXPRESSION: Record<PollyMood, Expression> = {
  neutral: 'thinking',
  confused: 'thinking',
  searching: 'thinking',
  disappointed: 'sad',
  mad: 'sad',
  sad: 'sad',
  yawning: 'sad',
  cheering: 'happy',
  happy: 'happy',
  surprised: 'happy',
  love: 'happy',
};

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
  const { species: chosenSpecies, equippedHeadwear } = usePollyCompanion();
  const activeSpecies = species ?? chosenSpecies;

  const headwear = equippedHeadwear
    ? resolveEquipRender({
        species: activeSpecies,
        hatId: hatIdFromAssetKey(equippedHeadwear.assetKey),
        expression: MOOD_TO_EXPRESSION[mood],
      })
    : null;

  // Full-art hat sprites (isFallback: false) are complete character images —
  // noodle-wearing-the-hat, not just a hat graphic — so they replace the base
  // body image rather than stacking on it. Only the flat-icon fallback
  // (species without full art yet) overlays on top of the plain body sprite.
  const bodyImage =
    headwear?.imagePath && !headwear.isFallback ? headwear.imagePath : POLLY_IMAGES[activeSpecies][mood];
  const overlayIcon = headwear?.isFallback ? headwear.imagePath : null;

  return (
    <div
      className={`polly polly-${size} ${
        animate ? 'polly-animate' : ''
      } ${className}`}
    >
      <img src={bodyImage} alt={alt} className="polly-image" />
      {overlayIcon && (
        <img src={overlayIcon} alt="" className="polly-headwear-fallback" />
      )}
    </div>
  );
}