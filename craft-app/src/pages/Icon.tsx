// Maps semantic icon names to the illustrated icon set (public/icons/*.png).
// Replaces emoji used throughout Polly with consistent cottagecore-kawaii artwork.

export type IconName =
  | 'alarm-clock' | 'apple-carrot' | 'basket' | 'calculator' | 'calculator-hearts'
  | 'calendar' | 'camera' | 'cleaning-spray' | 'clipboard-check' | 'clipboard-list'
  | 'cookbook' | 'cooking-pot' | 'dog-face' | 'dress-hanger' | 'egg' | 'egg-nest'
  | 'envelope-heart' | 'flower' | 'hamster-gray' | 'hamster-tan' | 'heart-medical'
  | 'house' | 'lavender' | 'lightning' | 'lock-heart' | 'map-pin' | 'medal-wings'
  | 'money-bag' | 'mood-anxious' | 'mood-happy' | 'mood-laughing' | 'mood-neutral'
  | 'mood-sad' | 'mood-tired' | 'moon-cloud' | 'music-note' | 'notebook-pen'
  | 'notepad-pencil' | 'piggy-bank' | 'potion' | 'potted-plant' | 'settings-gear'
  | 'sparkle-single' | 'sparkles-cluster' | 'spellbook' | 'sun-cloud' | 'trash-can'
  | 'trophy' | 'washing-machine';

interface IconProps {
  name: IconName;
  size?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Icon({ name, size = 20, alt = '', className, style }: IconProps) {
  return (
    <img
      src={`/icons/${name}.png`}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: '-0.2em',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}
