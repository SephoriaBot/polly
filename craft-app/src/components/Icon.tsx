// Maps semantic icon names to the illustrated icon set (public/icons/*.png).
// Replaces emoji used throughout Polly with consistent cottagecore-kawaii artwork.

export type IconName =
  | 'alarm-clock' | 'apple-carrot' | 'basket' | 'calculator' | 'calculator-hearts'
  | 'calendar' | 'camera' | 'cleaning-spray' | 'clipboard-check' | 'clipboard-list'
  | 'cookbook' | 'cooking-pot' | 'dog-face' | 'dress-hanger' | 'egg' | 'egg-nest'
  | 'envelope-heart' | 'flower' | 'hamster-gray' | 'hamster-tan' | 'hamster-wild' | 'heart-medical'
  | 'house' | 'lavender' | 'lightning' | 'lock-heart' | 'map-pin' | 'medal-wings'
  | 'money-bag' | 'mood-anxious' | 'mood-happy' | 'mood-laughing' | 'mood-neutral'
  | 'mood-sad' | 'mood-tired' | 'moon-cloud' | 'moon-new' | 'moon-waxing-crescent'
  | 'moon-first-quarter' | 'moon-waxing-gibbous' | 'moon-full' | 'moon-waning-gibbous'
  | 'moon-last-quarter' | 'moon-waning-crescent' | 'music-note' | 'notebook-pen'
  | 'notepad-pencil' | 'piggy-bank' | 'potion' | 'potted-plant' | 'settings-gear'
  | 'sparkle-single' | 'sparkles-cluster' | 'spellbook' | 'sun-cloud' | 'trash-can'
  | 'trophy' | 'washing-machine' | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces'
  | 'groq_1' | 'groq_2' | 'groq_3' | 'groq_4' | 'groq_5' | 'groq_6' | 'groq_7' | 'groq_8' | 'groq_9' | 'groq_10'
  | 'empty_jar'
  | 'icon-alertcircle' | 'icon-archive' | 'icon-arrowleft' | 'icon-calendar'
  | 'icon-calendardays' | 'icon-chefhat' | 'icon-chevrondown' | 'icon-chevronup'
  | 'icon-circle' | 'icon-clipboardlist' | 'icon-clock' | 'icon-database'
  | 'icon-decisions' | 'icon-externallink' | 'icon-flower' | 'icon-folderplus'
  | 'icon-grocery' | 'icon-habitat' | 'icon-heart' | 'icon-home'
  | 'icon-inbox' | 'icon-link2' | 'icon-listchecks' | 'icon-loader2'
  | 'icon-maidwizard' | 'icon-mappin' | 'icon-meals' | 'icon-moon'
  | 'icon-notebook' | 'icon-package' | 'icon-planner' | 'icon-plus'
  | 'icon-refreshcw' | 'icon-search' | 'icon-slidershorizontal' | 'icon-trackers'
  | 'icon-trash2' | 'icon-wallet'
  | 'icon_car' | 'icon_cellphone' | 'icon_computer' | 'icon_housepet'
  | 'icon_plant' | 'icon_toaster'
  | 'creamhamster' | 'pinkhamster' | 'cupempty' | 'cupfull'
  | 'picnicempty' | 'picnicfull' | 'shellempty' | 'shellfull'
  | 'sugarempty' | 'sugarfull' | 'heartempty' | 'heartfull' | 'flowerfull' | 'flowerempty' | 'icon-clear'
  | 'icon-recur' | 'shopping-cart' | 'toastempty' | 'toastfull'| 'empty2' | 'empty3' | 'empty4' |
  'empty5' | 'empty6' | 'empty7' | 'empty8' | 'empty9' | 'empty10' | 'pagedivider';


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
