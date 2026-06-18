// Base
export type BaseEntity = {
  id: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

// Recipes
export type Recipe = BaseEntity & {
  title?: string
  name?: string
  description?: string
  ingredients?: string[]
  steps?: RecipeStep[]
  prep_time_min?: number
  cook_time_min?: number
}

// Recipe steps
export type RecipeStep = BaseEntity & {
  step_number?: number
  instruction?: string
  text?: string
}

// Grocery
export type GroceryItem = BaseEntity & {
  name: string
  qty?: string
  checked?: boolean
}

// Pets
export type Pet = BaseEntity & {
  name?: string
  type?: string
  breed?: string
  age?: number
}

// Plants
export type Plant = BaseEntity & {
  name?: string
  species?: string
  water_schedule?: string
  notes?: string
}

// Saved lists
export type SavedList = BaseEntity & {
  name: string
  items: string[]
}

// Prices
export type PriceEntry = BaseEntity & {
  item_name: string
  store: string
  price: number
  updated_at?: string
}