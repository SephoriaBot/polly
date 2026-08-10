// lifeEventTemplates.ts
// Tier 2, item 3: "I'm moving next month" → a temporary workspace instead
// of building everything by hand. Each template is a curated starter
// checklist — not precisely scheduled against the event date (v1 keeps
// this simple, a flat checklist per event), just a reasonable "here's what
// people usually need to think about" starting point the person edits from.

export interface LifeEventTemplate {
  key: string;
  label: string;
  icon: string;
  items: string[];
}

export const LIFE_EVENT_TEMPLATES: LifeEventTemplate[] = [
  {
    key: 'moving',
    label: 'Moving',
    icon: 'icon-package',
    items: [
      'Change your address',
      'Set up utilities at the new place',
      'Cancel or transfer utilities at the old place',
      'Start packing',
      'Deep clean before move-out',
      'Sort donations',
      'Buy packing supplies',
      'Update your budget for moving costs',
      'Schedule movers or a truck',
      'Note important dates (closing, move day)',
    ],
  },
  {
    key: 'vacation',
    label: 'Vacation',
    icon: 'map-pin',
    items: [
      'Book time off work',
      'Check passport/ID expiration',
      'Book flights or transportation',
      'Book lodging',
      'Make a packing list',
      'Arrange pet or plant care',
      'Set an out-of-office reply',
      'Budget for the trip',
    ],
  },
  {
    key: 'hosting',
    label: 'Holiday Hosting',
    icon: 'cooking-pot',
    items: [
      'Plan the menu',
      'Make the grocery list',
      'Clean the house',
      'Set up extra seating',
      'Plan decorations',
      'Confirm who\'s coming',
      'Budget for the gathering',
      'Prep make-ahead dishes',
    ],
  },
  {
    key: 'new-job',
    label: 'New Job',
    icon: 'medal-wings',
    items: [
      'Plan your first-day outfit',
      'Map your commute',
      'Prep questions for onboarding',
      'Update your work wardrobe',
      'Set up a morning routine',
      'Check on old job\'s benefits/COBRA',
      'Celebrate — you got it!',
    ],
  },
  {
    key: 'back-to-school',
    label: 'Back to School',
    icon: 'notebook-pen',
    items: [
      'Buy school supplies',
      'Set a morning routine',
      'Plan lunches',
      'Update the family calendar',
      'Organize a homework space',
      'Check uniform/dress code items',
      'Schedule any check-ups needed',
    ],
  },
  {
    key: 'new-pet',
    label: 'Adopting a Pet',
    icon: 'icon_housepet',
    items: [
      'Pet-proof the home',
      'Buy food and supplies',
      'Find a vet',
      'Set a feeding/walk schedule',
      'Budget for ongoing pet costs',
      'Buy an ID tag or microchip',
      'Set up a cozy space for them',
    ],
  },
  {
    key: 'home-project',
    label: 'Home Project',
    icon: 'house',
    items: [
      'Set a budget',
      'List needed materials',
      'Research or book a contractor',
      'Clear the workspace',
      'Set a rough timeline',
      'Take before photos',
    ],
  },
  {
    key: 'celebration',
    label: 'Birthday / Celebration',
    icon: 'sparkles-cluster',
    items: [
      'Plan the guest list',
      'Send invites',
      'Plan the menu',
      'Order or make a cake',
      'Plan decorations',
      'Buy the gift',
      'Budget for the celebration',
    ],
  },
  {
    key: 'camping',
    label: 'Camping Trip',
    icon: 'sun-cloud',
    items: [
      'Check the weather',
      'Pack the gear list',
      'Plan meals',
      'Buy ice and perishables',
      'Check campsite reservations',
      'Tell someone your plans',
      'Charge devices/flashlights',
    ],
  },
  {
    key: 'new-routine',
    label: 'Starting a New Routine',
    icon: 'alarm-clock',
    items: [
      'Define the routine clearly',
      'Pick a start date',
      'Set a reminder',
      'Prep anything needed in advance',
      'Track the first week',
      'Give yourself grace on off days',
    ],
  },
];
