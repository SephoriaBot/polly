import { supabase } from "../lib/supabase";

export async function searchIngredient(ingredient: string) {
  const { data, error } = await supabase.functions.invoke(
    "swift-responder",
    {
      body: { ingredient },
    }
  );

  if (error) throw error;
  return data;
}