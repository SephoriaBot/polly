import { useState } from 'react';
import { ArrowLeft, ArrowRight, Wand2, RotateCcw, X, Clock, ChevronRight, BookmarkPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Recipe, RecipeIngredient, RecipeStep, RecipeCategory } from '../types';
import { INGREDIENT_DB } from '../api/ingredientDatabase';

const CATEGORY_META: Record<RecipeCategory, { label: string; emoji: string; className: string; badge: string }> = {
  skincare: { label: 'Skincare', emoji: '🌸', className: 'cat-skincare', badge: 'badge-pink' },
  soap:     { label: 'Soap Making', emoji: '🫧', className: 'cat-soap', badge: 'badge-lavender' },
  laundry:  { label: 'Laundry & Cleaning', emoji: '🧺', className: 'cat-laundry', badge: 'badge-green' },
};

interface WizardStep {
  id: string;
  question: string;
  subtitle?: string;
  options: string[];
  type: 'single' | 'multi';
  key: string;
}

interface FormulaIngredient {
  name: string;
  amount: string;
  unit: string;
  function: string;
  notes?: string;
}

interface Formula {
  name: string;
  description: string;
  difficulty: string;
  prep_time_min: number;
  ingredients: FormulaIngredient[];
  steps: string[];
  tips: string[];
}

const FORMULAS: Record<string, Record<string, Record<string, Formula>>> = {
  skincare: {
    'Moisturizing & hydration': {
      'Face cream': {
        name: 'Hydrating Barrier Cream',
        description: 'A rich, nourishing face cream that restores moisture and supports your skin barrier.',
        difficulty: 'Intermediate',
        prep_time_min: 45,
        ingredients: [
          { name: 'Shea butter', amount: '20', unit: 'g', function: 'Occlusive — locks in moisture' },
          { name: 'BTMS-50 emulsifying wax', amount: '6', unit: 'g', function: 'Emulsifier — binds oil and water' },
          { name: 'Jojoba oil', amount: '10', unit: 'g', function: 'Emollient — softens and smooths' },
          { name: 'Distilled water', amount: '55', unit: 'g', function: 'Water phase base' },
          { name: 'Aloe vera gel', amount: '5', unit: 'g', function: 'Humectant — draws moisture in' },
          { name: 'Niacinamide', amount: '2', unit: 'g', function: 'Active — brightens, reduces pores' },
          { name: 'Vitamin E oil', amount: '1', unit: 'g', function: 'Antioxidant / preservative booster' },
          { name: 'Broad-spectrum preservative (e.g. Geogard)', amount: '1', unit: 'g', function: 'Prevents microbial growth' },
        ],
        steps: [
          'Weigh shea butter, BTMS-50, and jojoba oil into a heat-safe beaker. This is your oil phase.',
          'Weigh distilled water and aloe vera gel into a separate beaker. This is your water phase.',
          'Heat both phases separately to 70–75°C using a double boiler or microwave in 30-second bursts.',
          'Slowly pour the water phase into the oil phase while mixing continuously with a stick blender.',
          'Continue blending until the mixture turns white and creamy and begins to cool (around 40°C).',
          'Add niacinamide, vitamin E, and preservative. Stir well to incorporate.',
          'Pour into a sterilized jar or pump bottle. Allow to cool completely before sealing.',
          'Label with date and ingredients. Use within 3 months.',
        ],
        tips: [
          'Always sterilize your equipment with 70% isopropyl alcohol before starting.',
          'Never skip the preservative — water-based products grow bacteria quickly.',
          'pH should be 5–6 for skin compatibility. Test with pH strips if possible.',
          'Safe for cats if kept sealed — shea butter and jojoba are non-toxic.',
        ],
      },
      'Body lotion': {
        name: 'Silky Everyday Body Lotion',
        description: 'A lightweight, fast-absorbing body lotion perfect for daily use.',
        difficulty: 'Beginner',
        prep_time_min: 30,
        ingredients: [
          { name: 'Emulsifying wax NF', amount: '7', unit: 'g', function: 'Emulsifier' },
          { name: 'Sweet almond oil', amount: '10', unit: 'g', function: 'Emollient — skin softening' },
          { name: 'Fractionated coconut oil', amount: '5', unit: 'g', function: 'Light occlusive' },
          { name: 'Distilled water', amount: '75', unit: 'g', function: 'Water phase base' },
          { name: 'Glycerin', amount: '2', unit: 'g', function: 'Humectant' },
          { name: 'Broad-spectrum preservative', amount: '1', unit: 'g', function: 'Prevents microbial growth' },
          { name: 'Essential oil (optional)', amount: '0.5', unit: 'g', function: 'Scent — add at cool-down' },
        ],
        steps: [
          'Combine emulsifying wax, sweet almond oil, and fractionated coconut oil in a beaker. Heat to 70°C.',
          'Heat distilled water and glycerin to 70°C in a separate beaker.',
          'Pour water phase into oil phase slowly while stick blending.',
          'Blend until white and emulsified, then allow to cool to 40°C.',
          'Add preservative and fragrance if using. Stir to combine.',
          'Pour into pump bottles. Cool completely before capping.',
        ],
        tips: [
          'Fractionated coconut oil stays liquid and absorbs well without clogging pores.',
          'Keep usage rate of essential oils under 1% for body leave-on products.',
          'This makes about 100g — scale up as needed.',
        ],
      },
    },
    'Soothing sensitive skin': {
      'Face cream': {
        name: 'Calm & Gentle Sensitive Skin Cream',
        description: 'A minimal-ingredient, fragrance-free cream designed for reactive and sensitive skin.',
        difficulty: 'Intermediate',
        prep_time_min: 45,
        ingredients: [
          { name: 'Colloidal oat extract', amount: '5', unit: 'g', function: 'Soothing — reduces redness and itch' },
          { name: 'Cetyl alcohol', amount: '3', unit: 'g', function: 'Thickener / emollient' },
          { name: 'BTMS-50 emulsifying wax', amount: '5', unit: 'g', function: 'Emulsifier' },
          { name: 'Sunflower oil', amount: '10', unit: 'g', function: 'Emollient — high linoleic acid, ideal for sensitive skin' },
          { name: 'Distilled water', amount: '72', unit: 'g', function: 'Water phase base' },
          { name: 'Panthenol (vitamin B5)', amount: '2', unit: 'g', function: 'Healing and moisture retention' },
          { name: 'Allantoin', amount: '0.5', unit: 'g', function: 'Soothing, skin repair' },
          { name: 'Broad-spectrum preservative', amount: '1', unit: 'g', function: 'Microbial protection' },
          { name: 'Vitamin E', amount: '1', unit: 'g', function: 'Antioxidant' },
        ],
        steps: [
          'Combine cetyl alcohol, BTMS-50, sunflower oil, and vitamin E in your oil phase beaker. Heat to 72°C.',
          'Combine water, colloidal oat, allantoin, and panthenol in water phase beaker. Heat to 72°C.',
          'Pour water phase into oil phase while stick blending continuously.',
          'Blend until thick and white, then allow to cool to below 40°C.',
          'Add preservative. Stir well. Check pH (target 5–6).',
          'Jar and label. Best used within 3 months.',
        ],
        tips: [
          'No fragrance, no essential oils — these are common sensitizers.',
          'Sunflower oil is preferred over coconut for sensitive skin.',
          'Allantoin dissolves better in warm water — add it to the water phase early.',
        ],
      },
      'Body lotion': {
        name: 'Oat & Aloe Sensitive Body Lotion',
        description: 'Ultra-gentle, fragrance-free lotion for easily irritated skin.',
        difficulty: 'Beginner',
        prep_time_min: 30,
        ingredients: [
          { name: 'Emulsifying wax NF', amount: '6', unit: 'g', function: 'Emulsifier' },
          { name: 'Sunflower oil', amount: '12', unit: 'g', function: 'Gentle emollient' },
          { name: 'Distilled water', amount: '72', unit: 'g', function: 'Water phase base' },
          { name: 'Aloe vera gel', amount: '5', unit: 'g', function: 'Soothing humectant' },
          { name: 'Colloidal oatmeal', amount: '3', unit: 'g', function: 'Anti-itch, barrier support' },
          { name: 'Panthenol', amount: '1', unit: 'g', function: 'Skin healing' },
          { name: 'Broad-spectrum preservative', amount: '1', unit: 'g', function: 'Microbial protection' },
        ],
        steps: [
          'Melt emulsifying wax and sunflower oil together at 70°C.',
          'Warm water, aloe, colloidal oatmeal, and panthenol to 70°C separately.',
          'Pour water phase into oil phase while blending.',
          'Blend until emulsified and cool to 40°C.',
          'Add preservative and stir well.',
          'Bottle and label.',
        ],
        tips: [
          'Patch test on inner arm before full use.',
          'No fragrance — this is intentional for sensitive skin.',
          'Colloidal oatmeal must be finely milled to disperse properly.',
        ],
      },
    },
    'Acne-prone skin': {
      'Face cream': {
        name: 'Lightweight Balancing Gel Cream',
        description: 'An oil-free, non-comedogenic moisturizer that hydrates without clogging pores.',
        difficulty: 'Intermediate',
        prep_time_min: 40,
        ingredients: [
          { name: 'Niacinamide', amount: '4', unit: 'g', function: 'Reduces sebum, minimizes pores' },
          { name: 'Glycerin', amount: '5', unit: 'g', function: 'Humectant — water-based moisture' },
          { name: 'Sodium hyaluronate', amount: '1', unit: 'g', function: 'Humectant — plumping hydration' },
          { name: 'Allantoin', amount: '0.5', unit: 'g', function: 'Soothing, anti-inflammatory' },
          { name: 'Carbomer gel (pre-neutralized)', amount: '3', unit: 'g', function: 'Gel base — lightweight, oil-free' },
          { name: 'Distilled water', amount: '85', unit: 'g', function: 'Water base' },
          { name: 'Broad-spectrum preservative', amount: '1', unit: 'g', function: 'Microbial protection' },
          { name: 'Zinc PCA (optional)', amount: '0.5', unit: 'g', function: 'Sebum control' },
        ],
        steps: [
          'Disperse carbomer in distilled water and let hydrate for 30 minutes.',
          'Add glycerin, niacinamide, hyaluronate, allantoin, and zinc PCA to the water mixture.',
          'Mix gently until fully dissolved. Do not introduce air bubbles.',
          'Add preservative and stir.',
          'Check pH — target 5.5–6.5. Adjust with sodium hydroxide solution if needed.',
          'Package in a pump or airless bottle. Use within 3 months.',
        ],
        tips: [
          'This is water-based only — no oils — ideal for oily and acne-prone skin.',
          'Niacinamide at 4% is clinically effective for sebum reduction.',
          'Airless pump bottles keep formula contamination-free.',
        ],
      },
    },
  },
  laundry: {
    'Gentle on clothes': {
      'Laundry powder': {
        name: 'Gentle Everyday Laundry Powder',
        description: 'A simple, effective laundry powder that\'s kind to fabrics and sensitive skin.',
        difficulty: 'Beginner',
        prep_time_min: 15,
        ingredients: [
          { name: 'Washing soda (sodium carbonate)', amount: '2', unit: 'cups', function: 'Water softener / cleaning base' },
          { name: 'Baking soda (sodium bicarbonate)', amount: '1', unit: 'cup', function: 'Deodorizer / mild abrasive' },
          { name: 'Sodium percarbonate', amount: '½', unit: 'cup', function: 'Oxygen bleach — stain lifting' },
          { name: 'SLSA', amount: '¼', unit: 'cup', function: 'Gentle surfactant' },
          { name: 'Liquid castile soap', amount: '2', unit: 'tbsp', function: 'Add to drum separately — not the dry mix' },
        ],
        steps: [
          'Combine washing soda, baking soda, sodium percarbonate, and SLSA in a large bowl.',
          'Mix thoroughly until evenly distributed. Break up any clumps.',
          'Store dry mix in an airtight jar.',
          'To use: add 2–3 tbsp of powder to the drum before clothes.',
          'Add castile soap directly to the drum separately — do not mix into dry powder.',
          'Wash on your preferred cycle.',
        ],
        tips: [
          'Adding castile soap to the drum (not the drawer) prevents clumping.',
          'Sodium percarbonate activates best in water 40°C and above.',
          'Safe for HE machines — low sudsing formula.',
        ],
      },
    },
    'Eco-friendly formula': {
      'Laundry powder': {
        name: 'Eco Laundry Powder',
        description: 'A plant-based, biodegradable laundry powder with zero synthetic additives.',
        difficulty: 'Beginner',
        prep_time_min: 10,
        ingredients: [
          { name: 'Washing soda', amount: '2', unit: 'cups', function: 'Primary cleaner / water softener' },
          { name: 'Sodium percarbonate', amount: '½', unit: 'cup', function: 'Oxygen bleach' },
          { name: 'Baking soda', amount: '½', unit: 'cup', function: 'Deodorizer' },
          { name: 'Grated castile soap bar (optional)', amount: '¼', unit: 'cup', function: 'Extra cleaning power' },
        ],
        steps: [
          'Combine all dry ingredients and mix well.',
          'If using grated castile soap, add last and mix until evenly distributed.',
          'Store in a sealed glass jar away from moisture.',
          'Use 2–3 tbsp per load directly in the drum.',
        ],
        tips: [
          'All ingredients are biodegradable and septic-safe.',
          'Grated soap can clump in cold water — warm wash cycles work better.',
          'Add white vinegar to the rinse cycle as a natural fabric softener.',
        ],
      },
    },
    'Heavy-duty stain removal': {
      'Laundry powder': {
        name: 'Power Stain Laundry Powder',
        description: 'A heavy-duty formula with extra oxygen bleach for tough stains.',
        difficulty: 'Beginner',
        prep_time_min: 15,
        ingredients: [
          { name: 'Washing soda', amount: '2', unit: 'cups', function: 'Alkaline cleaner' },
          { name: 'Sodium percarbonate', amount: '1', unit: 'cup', function: 'Oxygen bleach — heavy stain lifting' },
          { name: 'Baking soda', amount: '½', unit: 'cup', function: 'Deodorizer' },
          { name: 'SLSA', amount: '¼', unit: 'cup', function: 'Surfactant' },
          { name: 'Borax (optional)', amount: '¼', unit: 'cup', function: 'Boosts cleaning power on tough stains' },
        ],
        steps: [
          'Combine all ingredients and mix thoroughly.',
          'Store in an airtight container.',
          'For regular loads: use 3 tbsp. For heavy stains: use 4–5 tbsp.',
          'Pre-soak heavily stained items for 30 minutes before washing.',
          'Wash on the warmest safe temperature for the fabric.',
        ],
        tips: [
          'Sodium percarbonate is doubled vs. gentle formula for extra stain power.',
          'Pre-soaking activates the oxygen bleach before the wash cycle.',
          'Safe for whites and colors — not a chlorine bleach.',
        ],
      },
    },
    'Fragrance-free / sensitive skin': {
      'Laundry powder': {
        name: 'Fragrance-Free Sensitive Laundry Powder',
        description: 'Completely unscented, minimal-ingredient powder for sensitive skin.',
        difficulty: 'Beginner',
        prep_time_min: 10,
        ingredients: [
          { name: 'Washing soda', amount: '2', unit: 'cups', function: 'Primary cleaner' },
          { name: 'Baking soda', amount: '1', unit: 'cup', function: 'Deodorizer / pH buffer' },
          { name: 'Sodium percarbonate', amount: '½', unit: 'cup', function: 'Oxygen bleach' },
        ],
        steps: [
          'Combine all three ingredients and mix well.',
          'Store in sealed container.',
          'Use 2–3 tbsp per load directly in drum.',
          'Add ¼ cup white vinegar to rinse cycle to soften fabrics naturally.',
        ],
        tips: [
          'Only 3 ingredients — minimal exposure for sensitive skin.',
          'No surfactants, no soap — ultra-clean rinse.',
          'Vinegar in the rinse neutralizes any alkaline residue.',
        ],
      },
    },
  },
  soap: {
    'Gentle & moisturizing': {
      'Melt & pour soap': {
        name: 'Creamy Shea Melt & Pour Bar',
        description: 'A beginner-friendly moisturizing soap bar — no lye required.',
        difficulty: 'Beginner',
        prep_time_min: 20,
        ingredients: [
          { name: 'Shea butter melt & pour soap base', amount: '454', unit: 'g', function: 'Soap base — already saponified' },
          { name: 'Shea butter', amount: '15', unit: 'g', function: 'Superfat — adds extra moisture' },
          { name: 'Jojoba oil', amount: '10', unit: 'g', function: 'Emollient — skin softening' },
          { name: 'Essential oil (optional)', amount: '10', unit: 'g', function: 'Scent' },
        ],
        steps: [
          'Cut soap base into 1-inch cubes and place in a microwave-safe bowl.',
          'Microwave in 30-second intervals, stirring between each, until fully melted.',
          'Add shea butter and jojoba oil. Stir until incorporated.',
          'Cool slightly to about 55°C before adding essential oil.',
          'Pour into soap molds. Spritz surface with 91% isopropyl alcohol to remove bubbles.',
          'Allow to harden for at least 2 hours before unmolding.',
          'Wrap in plastic wrap to prevent glycerin dew.',
        ],
        tips: [
          'Don\'t overheat the base — it scorches easily.',
          'Spritzing with alcohol gives a smooth, bubble-free surface.',
          'Totally safe around cats once cured — no lye to worry about.',
        ],
      },
    },
    'Exfoliating': {
      'Melt & pour soap': {
        name: 'Brown Sugar Exfoliating Bar',
        description: 'A gently exfoliating soap bar with brown sugar and oat for smooth skin.',
        difficulty: 'Beginner',
        prep_time_min: 25,
        ingredients: [
          { name: 'Goat milk melt & pour soap base', amount: '454', unit: 'g', function: 'Creamy, gentle soap base' },
          { name: 'Brown sugar', amount: '2', unit: 'tbsp', function: 'Physical exfoliant' },
          { name: 'Ground oat', amount: '1', unit: 'tbsp', function: 'Gentle exfoliant / soothing' },
          { name: 'Honey', amount: '1', unit: 'tsp', function: 'Humectant — moisture retention' },
          { name: 'Vanilla or almond fragrance oil', amount: '8', unit: 'g', function: 'Scent' },
        ],
        steps: [
          'Melt soap base in 30-second microwave intervals.',
          'Cool to about 55°C, then stir in brown sugar, ground oat, and honey.',
          'Add fragrance oil and stir gently.',
          'Pour into molds quickly — exfoliants cause the soap to thicken fast.',
          'Spritz with alcohol to remove bubbles.',
          'Allow to set for 2–4 hours before unmolding.',
        ],
        tips: [
          'Pour quickly after adding exfoliants — the mixture sets fast.',
          'Brown sugar dissolves slightly in use, making it very gentle.',
          'Avoid walnut shell powder — it can cause micro-tears in skin.',
        ],
      },
    },
  },
};

function getFormula(category: string, goal: string, type: string): Formula | null {
  const cat = FORMULAS[category];
  if (!cat) return null;
  const goalMatch = cat[goal];
  if (!goalMatch) {
    const firstGoal = Object.keys(cat)[0];
    const firstType = Object.keys(cat[firstGoal] || {})[0];
    return cat[firstGoal]?.[firstType] || null;
  }
  const typeMatch = goalMatch[type];
  if (!typeMatch) {
    const firstType = Object.keys(goalMatch)[0];
    return goalMatch[firstType] || null;
  }
  return typeMatch;
}

const FLOW: WizardStep[] = [
  {
    id: 'category',
    question: 'What would you like to make?',
    subtitle: 'Choose your craft category to begin.',
    options: ['Skincare (lotions, serums, toners)', 'Soap Making', 'Laundry & Cleaning'],
    type: 'single',
    key: 'category',
  },
  {
    id: 'goal',
    question: 'What\'s your main goal?',
    subtitle: 'Pick all that apply.',
    options: [],
    type: 'multi',
    key: 'goal',
  },
  {
    id: 'type',
    question: 'What type of product?',
    subtitle: 'Choose the format you want to make.',
    options: [],
    type: 'single',
    key: 'type',
  },
];

const GOAL_OPTIONS: Record<string, string[]> = {
  'Skincare (lotions, serums, toners)': ['Moisturizing & hydration', 'Brightening', 'Anti-aging', 'Soothing sensitive skin', 'Acne-prone skin'],
  'Soap Making': ['Gentle & moisturizing', 'Exfoliating', 'Scented / aromatherapy', 'Unscented / fragrance-free'],
  'Laundry & Cleaning': ['Gentle on clothes', 'Heavy-duty stain removal', 'Scented with essential oils', 'Fragrance-free / sensitive skin', 'Eco-friendly formula'],
};

const TYPE_OPTIONS: Record<string, string[]> = {
  'Skincare (lotions, serums, toners)': ['Face cream', 'Body lotion', 'Serum', 'Toner', 'Face oil', 'Lip balm'],
  'Soap Making': ['Melt & pour soap', 'Cold process bar soap', 'Liquid soap', 'Shampoo bar'],
  'Laundry & Cleaning': ['Laundry powder', 'Laundry liquid', 'Fabric softener', 'All-purpose cleaner'],
};

const CAT_MAP: Record<string, RecipeCategory> = {
  'Skincare (lotions, serums, toners)': 'skincare',
  'Soap Making': 'soap',
  'Laundry & Cleaning': 'laundry',
};

interface IngredientMatch {
  name: string;
  score: number;
  reasons: string[];
}

export default function WizardPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [results, setResults] = useState<Recipe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);
  const [matches, setMatches] = useState<IngredientMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'library' | 'formula'>('formula');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentFlow = FLOW.map(f => {
    if (f.id === 'goal') return { ...f, options: GOAL_OPTIONS[answers['category'] as string] || [] };
    if (f.id === 'type') return { ...f, options: TYPE_OPTIONS[answers['category'] as string] || [] };
    return f;
  });

  const currentStep = currentFlow[step];
  const totalSteps = currentFlow.length;

  function toggleAnswer(key: string, option: string, type: 'single' | 'multi') {
    if (type === 'single') {
      setAnswers(a => ({ ...a, [key]: option }));
    } else {
      setAnswers(a => {
        const prev = (a[key] as string[]) || [];
        const has = prev.includes(option);
        return { ...a, [key]: has ? prev.filter(x => x !== option) : [...prev, option] };
      });
    }
  }

  function isSelected(key: string, option: string) {
    const val = answers[key];
    if (!val) return false;
    return Array.isArray(val) ? val.includes(option) : val === option;
  }

  function canProceed() {
    const val = answers[currentStep?.key];
    if (!val) return false;
    return Array.isArray(val) ? val.length > 0 : true;
  }

  async function saveFormulaToLibrary() {
    if (!formula) return;
    setSaving(true);

    const category = CAT_MAP[answers['category'] as string];
    const difficulty = DIFF_NORMALIZE[formula.difficulty] ?? 'easy';

    // Insert recipe
    const { data: recipe, error } = await supabase
      .from('recipes')
      .insert({
        name: formula.name,
        category,
        description: formula.description,
        difficulty,
        prep_time_min: formula.prep_time_min ?? null,
        tags: ['wizard-generated'],
      })
      .select()
      .single();

    if (error || !recipe) {
      setSaving(false);
      return;
    }

    // Insert ingredients
    await supabase.from('recipe_ingredients').insert(
      formula.ingredients.map((ing, i) => ({
        recipe_id: recipe.id,
        ingredient_name: ing.name,
        amount: ing.amount,
        unit: ing.unit || null,
        notes: ing.function || null,
        sort_order: i,
      }))
    );

    // Insert steps — tips appended as final steps
    const allSteps = [
      ...formula.steps.map((instruction, i) => ({
        recipe_id: recipe.id,
        step_number: i + 1,
        instruction,
      })),
      ...(formula.tips ?? []).map((tip, i) => ({
        recipe_id: recipe.id,
        step_number: formula.steps.length + i + 1,
        instruction: `💡 ${tip}`,
      })),
    ];

    await supabase.from('recipe_steps').insert(allSteps);

    setSaving(false);
    setSaved(true);
  }

  async function runSearch() {
  setLoading(true);

  const selectedGoals = answers.goal as string[];

  const scored = Object.values(INGREDIENT_DB)
  .map(ingredient => {
    let score = 0;
    const reasons: string[] = [];

    selectedGoals.forEach(goal => {
      const text = [
        ingredient.description,
        ingredient.category,
        ...ingredient.benefits,
        ...ingredient.best_for
      ]
        .join(' ')
        .toLowerCase();

      if (
        goal === 'Moisturizing & hydration' &&
        (
          text.includes('moistur') ||
          text.includes('hydrat') ||
          text.includes('humectant')
        )
      ) {
        score++;
        reasons.push('Supports hydration');
      }

      if (
        goal === 'Soothing sensitive skin' &&
        (
          text.includes('soothing') ||
          text.includes('sensitive') ||
          text.includes('anti-inflammatory')
        )
      ) {
        score++;
        reasons.push('Helps calm irritation');
      }

      if (
        goal === 'Acne-prone skin' &&
        (
          text.includes('acne') ||
          text.includes('sebum') ||
          text.includes('oil')
        )
      ) {
        score++;
        reasons.push('Helpful for acne-prone skin');
      }
    });

    return {
      name: ingredient.ingredient_name,
      score,
      reasons
    };
  })
  .filter(i => i.score > 0)
  .sort((a, b) => b.score - a.score);
  const scored = ingredientMap
    .map(item => ({
      name: item.name,
      score: item.goals.filter(g =>
        selectedGoals.includes(g)
      ).length,
      reasons: item.reasons
    }))
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score);

  setMatches(scored);
  setResults([]);
  setLoading(false);
}

  async function openRecipe(recipe: Recipe) {
    setSelected(recipe);
    const [ingRes, stepRes] = await Promise.all([
      supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipe.id).order('sort_order'),
      supabase.from('recipe_steps').select('*').eq('recipe_id', recipe.id).order('step_number'),
    ]);
    setIngredients(ingRes.data || []);
    setRecipeSteps(stepRes.data || []);
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setResults(null);
    setFormula(null);
    setSaved(false);
  }

  if (matches.length > 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2>Your Results ✨</h2>
            <p>Based on your preferences</p>
          </div>
          <button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} /> Start Over</button>
        </div>
        <div className="page-body">

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button className={`btn btn-sm ${activeTab === 'formula' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('formula')}>
              ⚗️ Generated Formula
            </button>
            <button className={`btn btn-sm ${activeTab === 'library' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('library')}>
              📖 My Library {results.length > 0 && `(${results.length})`}
            </button>
          </div>

          {/* Formula tab */}
          <div className="card">
  <div className="card-body">
    <h3>Recommended Ingredients</h3>

    {matches.map((item, i) => (
      <div
        key={i}
        style={{
          padding: 12,
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: 4
          }}
        >
          {item.name}
        </div>

        <div
          style={{
            fontSize: '.85rem',
            color: 'var(--ink-muted)'
          }}
        >
          Match Score: {item.score}
        </div>

        {item.reasons.map((reason, r) => (
          <div key={r}>
            • {reason}
          </div>
        ))}
      </div>
    ))}
  </div>
</div>

          {/* Library tab */}
          {activeTab === 'library' && (
            results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📖</div>
                <h3>No matches in your library</h3>
                <p>Generate a formula above and save it to start building your library.</p>
              </div>
            ) : (
              <div className="grid-3">
                {results.map(recipe => {
                  const meta = CATEGORY_META[recipe.category];
                  return (
                    <div key={recipe.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openRecipe(recipe)}>
                      <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                          <div className={`recipe-category-icon ${meta.className}`}>{meta.emoji}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{recipe.name}</div>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <span className={`badge ${DIFF_BADGE[recipe.difficulty]}`}>{recipe.difficulty}</span>
                              {recipe.prep_time_min && <span className="badge badge-lavender">{recipe.prep_time_min} min</span>}
                            </div>
                          </div>
                        </div>
                        {recipe.description && <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>{recipe.description}</p>}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <ChevronRight size={14} style={{ color: 'var(--pink)' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className={`recipe-category-icon ${CATEGORY_META[selected.category].className}`}>{CATEGORY_META[selected.category].emoji}</div>
                  <div>
                    <h3>{selected.name}</h3>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className={`badge ${DIFF_BADGE[selected.difficulty]}`}>{selected.difficulty}</span>
                      {selected.prep_time_min && <span className="badge badge-lavender"><Clock size={10} style={{ marginRight: 2 }} />{selected.prep_time_min} min</span>}
                    </div>
                  </div>
                </div>
                <button className="close-btn" onClick={() => setSelected(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                {selected.description && <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic' }}>{selected.description}</p>}
                {ingredients.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ingredients</div>
                    <div style={{ marginBottom: 24 }}>
                      {ingredients.map(ing => (
                        <div key={ing.id} className="ingredient-row">
                          <span className="ingredient-amount">{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</span>
                          <span>{ing.ingredient_name}</span>
                          {ing.notes && <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{ing.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {recipeSteps.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Steps</div>
                    {recipeSteps.map(s => (
                      <div key={s.id} className="step-row">
                        <div className="step-number">{s.step_number}</div>
                        <div className="step-text">{s.instruction}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Recipe Wizard 🪄</h2>
          <p>Answer a few questions to find your perfect formula</p>
        </div>
      </div>
      <div className="page-body">
        <div className="wizard-container">
          <div className="wizard-progress">
            {currentFlow.map((_, i) => (
              <div key={i} className={`wizard-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Step {step + 1} of {totalSteps}
          </div>

          <div className="wizard-question">{currentStep.question}</div>
          {currentStep.subtitle && <div className="wizard-subtitle">{currentStep.subtitle}</div>}

          {currentStep.options.length > 0 ? (
            <div className="wizard-options">
              {currentStep.options.map(opt => (
                <button key={opt} className={`wizard-option ${isSelected(currentStep.key, opt) ? 'selected' : ''}`}
                  onClick={() => toggleAnswer(currentStep.key, opt, currentStep.type)}>
                  <div className="wizard-option-check">
                    {isSelected(currentStep.key, opt) && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                  </div>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', padding: '20px 0' }}>
              Please select a category first to see options.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button className="btn btn-ghost" onClick={() => step === 0 ? reset() : setStep(s => s - 1)} disabled={loading}>
              <ArrowLeft size={14} /> {step === 0 ? 'Reset' : 'Back'}
            </button>
            {step < totalSteps - 1 ? (
              <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep(s => s + 1)}>
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary" disabled={!canProceed() || loading} onClick={runSearch}>
                {loading ? 'Finding…' : <><Wand2 size={14} /> Find Formula</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
