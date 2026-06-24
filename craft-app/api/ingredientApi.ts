import { supabase } from "../src/lib/supabase";

export async function searchIngredient(ingredient: string) {
  const { data, error } = await supabase.functions.invoke("ingredient-search", {
    body: { ingredient }
  });

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}
