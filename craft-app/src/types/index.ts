export type PlantType = 'herb' | 'flower' | 'succulent' | 'vegetable' | 'tropical' | 'other';
export type LogAction = 'watered' | 'fertilized' | 'repotted' | 'pruned' | 'note';
export type RecipeCategory = 'skincare' | 'soap' | 'laundry';
export type WizardOptionType = 'single' | 'multi';

export interface Plant {
  id: string;
  name: string;
  type: PlantType;
  notes: string | null;
  watering_frequency_days: number | null;
  last_watered: string | null;
  acquired_date: string | null;
  location: string | null;
  emoji: string | null;
  created_at: string;
}

export interface PlantLog {
  id: string;
  plant_id: string;
  action: LogAction;
  note: string | null;
  logged_at: string;
}

export type Recipe = {
  id: string
  title?: string
  description?: string
  prep_time_min?: number
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  amount: string;
  unit: string | null;
  notes: string | null;
  sort_order: number;
}

export type RecipeStep = {
  id?: string
  step_number?: number
  instruction?: string
}

export interface WizardQuestion {
  id: string;
  category: RecipeCategory;
  step: number;
  question: string;
  option_type: WizardOptionType;
  options: string[];
}

export interface WizardAnswer {
  question_id: string;
  question: string;
  answer: string | string[];
}
