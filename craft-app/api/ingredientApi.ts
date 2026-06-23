import { supabase } from "../src/lib/supabase";

export async function searchIngredient(ingredient: string) {
  const { data, error } = await supabase.functions.invoke(
    "ingredient-search",
    {
      body: { ingredient },
    }
  );

  if (error) throw error;
  return data;
}