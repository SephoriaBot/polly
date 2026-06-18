export type BaseEntity = {
  id: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

// Recipes
export type Recipe = BaseEntity & {
  name?: string
  description?: string
  category?: string
  difficulty?: string
  prep_time_min?: number
  tags?: string[]
}

export type RecipeIngredient = any
export type RecipeCategory = string

export type RecipeStep = BaseEntity & {
  step_number?: number
  instruction?: string
}

// Plants
export type Plant = BaseEntity & {
  name?: string
  species?: string
}

export type PlantType = string

export type PlantLog = any

export type LogAction = string

// Pets
export type Pet = BaseEntity & {
  name?: string
  type?: string
}

// Grocery
export type GroceryItem = BaseEntity & {
  name: string
  qty?: string
  checked?: boolean
}