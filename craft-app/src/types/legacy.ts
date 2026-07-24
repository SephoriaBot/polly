export interface WeekPlan {
  [day: string]: {
    breakfast: string | null
    lunch: string | null
    dinner: string | null
  }
}

export interface GroceryItem {
  id: string
  user_id?: string
  name: string
  qty: string
  checked: boolean
  created_at?: string
}