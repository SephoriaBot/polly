import './PollyCompanionPicker.css';
import { usePollyCompanion, type PollySpecies } from '../context/PollyCompanionContext';

const OPTIONS: { species: PollySpecies; label: string; blurb: string; image: string }[] = [
  {
    species: 'hamster',
    label: 'Polly the Hamster',
    blurb: 'Cozy, cheerful, and always ready with a snack.',
    image: '/assets/pollyhamster/polly_7.png',
  },
  {
    species: 'noodle',
    label: 'Polly the Noodle',
    blurb: 'Wiggly, curious, and quietly excitable.',
    image: '/assets/pollynoodle/pollynoodle_happy.png',
  },
  {
    species: 'dragon',
    label: 'Polly the Dragon',
    blurb: 'Small, mighty, and fiercely on your side.',
    image: '/assets/pollydragon/pollydragon_happy.png',
  },
];

export default function PollyCompanionPicker() {
  const { chooseSpecies } = usePollyCompanion();

  return (
    <div className="companion-picker-overlay">
      <div className="companion-picker-card">
        <h1 className="companion-picker-title">Pick your companion</h1>
        <p className="companion-picker-subtitle">
          Who's coming along with you in Polly?
        </p>

        <div className="companion-picker-grid">
          {OPTIONS.map(opt => (
            <button
              key={opt.species}
              type="button"
              className="companion-picker-option"
              onClick={() => chooseSpecies(opt.species)}
            >
              <img
                src={opt.image}
                alt={opt.label}
                className="companion-picker-image"
              />
              <span className="companion-picker-text">
                <span className="companion-picker-label">{opt.label}</span>
                <span className="companion-picker-blurb">{opt.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}