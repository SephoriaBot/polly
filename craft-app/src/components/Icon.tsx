// Maps semantic icon names to the illustrated icon set (public/icons/*.png).
// Replaces emoji used throughout Polly with consistent cottagecore-kawaii artwork.

export type IconName =
    'alarm-clock' | 'apple-carrot' | 'basket' | 'calculator' | 'calculator-hearts'
  | 'calendar' | 'camera' | 'cleaning-spray' | 'clipboard-check' | 'clipboard-list'
  | 'cookbook' | 'cooking-pot' | 'egg' | 'egg-nest' | 'flower' | 'hamster-wild'
  | 'heart-medical' | 'house' | 'lavender' | 'lightning' | 'lock-heart' | 'map-pin'
  | 'medal-wings' | 'money-bag' | 'mood-happy' | 'mood-neutral' | 'mood-sad'
  | 'moon-cloud' | 'moon-new' | 'moon-waxing-crescent' | 'moon-first-quarter'
  | 'moon-waxing-gibbous' | 'moon-full' | 'moon-waning-gibbous' | 'moon-last-quarter'
  | 'moon-waning-crescent' | 'notebook-pen' | 'notepad-pencil' | 'piggy-bank'
  | 'potted-plant' | 'settings-gear' | 'sparkle-single' | 'sparkles-cluster' | 'sun-cloud'
  | 'trophy' | 'washing-machine' | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo'
  | 'virgo' | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces'
  | 'groq_2' | 'groq_5' | 'groq_6' | 'groq_7' | 'groq_9' | 'empty_jar'
  | 'icon-alertcircle' | 'icon-archive' | 'icon-arrowleft' | 'icon-calendar'
  | 'icon-chefhat' | 'icon-chevrondown' | 'icon-chevronup' | 'icon-circle'
  | 'icon-clipboardlist' | 'icon-database' | 'icon-decisions' | 'icon-externallink'
  | 'icon-flower' | 'icon-folderplus' | 'icon-grocery' | 'icon-habitat' | 'icon-heart'
  | 'icon-home' | 'icon-link2' | 'icon-listchecks' | 'icon-loader2' | 'icon-mappin'
  | 'icon-meals' | 'icon-moon' | 'icon-notebook' | 'icon-package' | 'icon-planner'
  | 'icon-plus' | 'icon-search' | 'icon-slidershorizontal' | 'icon-trackers'
  | 'icon-trash2' | 'icon-wallet' | 'icon_housepet' | 'heartempty' | 'heartfull'
  | 'flowerfull' | 'icon-clear' | 'full_sun' | 'empty_sun' | 'full_moon' | 'empty_moon'
  | 'icon-recur' | 'shopping-cart' | 'pagedivider' | 'empty-wallet' | 'empty-dashboard'
  | 'empty-grocery' | 'empty-habitat' | 'empty-planner' | 'empty-trackers';


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
        maxWidth: 'none',
        ...style,
      }}
    />
  );
}
