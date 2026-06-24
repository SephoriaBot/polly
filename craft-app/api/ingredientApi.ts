import { supabase } from "../src/lib/supabase";

export async function searchIngredient(ingredient: string) {
  const result = await supabase.functions.invoke("swift-responder", {
    body: { ingredient }
  });

  return result;
}