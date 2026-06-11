-- =============================================
-- CRAFT & GARDEN — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- PLANTS
create table if not exists plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'other',
  notes text,
  watering_frequency_days int,
  last_watered timestamptz,
  acquired_date date,
  location text,
  emoji text,
  created_at timestamptz default now()
);

-- PLANT LOGS
create table if not exists plant_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete cascade not null,
  action text not null,
  note text,
  logged_at timestamptz default now()
);

-- RECIPES
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('skincare', 'soap', 'laundry')),
  description text,
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'advanced')),
  prep_time_min int,
  tags text[],
  created_at timestamptz default now()
);

-- RECIPE INGREDIENTS
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  ingredient_name text not null,
  amount text not null,
  unit text,
  notes text,
  sort_order int default 0
);

-- RECIPE STEPS
create table if not exists recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  step_number int not null,
  instruction text not null
);

-- =============================================
-- RLS POLICIES (no auth — open access)
-- =============================================

alter table plants enable row level security;
alter table plant_logs enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;

create policy "allow all plants"            on plants            for all using (true) with check (true);
create policy "allow all plant_logs"        on plant_logs        for all using (true) with check (true);
create policy "allow all recipes"           on recipes           for all using (true) with check (true);
create policy "allow all recipe_ingredients" on recipe_ingredients for all using (true) with check (true);
create policy "allow all recipe_steps"      on recipe_steps      for all using (true) with check (true);

-- =============================================
-- SAMPLE SEED DATA (optional — delete if not needed)
-- =============================================

-- Sample skincare recipe
insert into recipes (name, category, description, difficulty, prep_time_min, tags)
values (
  'Simple Rose Water Toner',
  'skincare',
  'A gentle, hydrating toner with rose water and aloe vera. Great for all skin types.',
  'easy', 5,
  array['toner', 'hydrating', 'rose', 'beginner']
) on conflict do nothing;

-- Get that recipe's id and add ingredients + steps
do $$
declare r_id uuid;
begin
  select id into r_id from recipes where name = 'Simple Rose Water Toner' limit 1;

  insert into recipe_ingredients (recipe_id, ingredient_name, amount, unit, notes, sort_order) values
    (r_id, 'Rose water', '1/2', 'cup', 'pure, food-grade preferred', 0),
    (r_id, 'Aloe vera gel', '2', 'tbsp', 'fresh or store-bought', 1),
    (r_id, 'Vegetable glycerin', '1', 'tsp', 'optional — adds slip', 2),
    (r_id, 'Witch hazel', '1', 'tbsp', 'alcohol-free', 3);

  insert into recipe_steps (recipe_id, step_number, instruction) values
    (r_id, 1, 'Combine rose water, aloe vera gel, and witch hazel in a clean bowl and stir gently.'),
    (r_id, 2, 'Add vegetable glycerin if using and mix until fully incorporated.'),
    (r_id, 3, 'Pour into a clean spray bottle or pump bottle using a funnel.'),
    (r_id, 4, 'Store in the refrigerator for up to 2 weeks. Apply to clean skin morning and evening.');
end $$;

-- Sample laundry recipe
insert into recipes (name, category, description, difficulty, prep_time_min, tags)
values (
  'Basic Laundry Powder',
  'laundry',
  'A simple, effective laundry powder base using washing soda and sodium percarbonate. Fragrance-free and gentle.',
  'easy', 10,
  array['powder', 'fragrance-free', 'washing-soda', 'sensitive-skin']
) on conflict do nothing;

do $$
declare r_id uuid;
begin
  select id into r_id from recipes where name = 'Basic Laundry Powder' limit 1;

  insert into recipe_ingredients (recipe_id, ingredient_name, amount, unit, notes, sort_order) values
    (r_id, 'Washing soda (sodium carbonate)', '2', 'cups', 'not baking soda', 0),
    (r_id, 'Sodium percarbonate', '1/2', 'cup', 'oxygen booster / brightener', 1),
    (r_id, 'SLSA (sodium lauryl sulfoacetate)', '1/4', 'cup', 'mild surfactant, wear a mask when measuring', 2),
    (r_id, 'Salt (fine)', '1/4', 'cup', 'helps prevent clumping', 3);

  insert into recipe_steps (recipe_id, step_number, instruction) values
    (r_id, 1, 'Wear a dust mask — SLSA is a fine powder and should not be inhaled.'),
    (r_id, 2, 'Combine washing soda, sodium percarbonate, and salt in a large bowl. Stir well.'),
    (r_id, 3, 'Gently fold in the SLSA last, stirring slowly to avoid creating dust clouds.'),
    (r_id, 4, 'Transfer to an airtight jar or container. Store in a cool, dry place.'),
    (r_id, 5, 'Use 2–3 tablespoons per load. Add directly to drum before clothes for HE machines.');
end $$;

-- Sample soap recipe
insert into recipes (name, category, description, difficulty, prep_time_min, tags)
values (
  'Lavender Oat Melt & Pour Soap',
  'soap',
  'A beginner-friendly melt-and-pour soap with colloidal oats and lavender essential oil. Gentle and moisturizing.',
  'easy', 30,
  array['melt-and-pour', 'lavender', 'oat', 'beginner', 'moisturizing']
) on conflict do nothing;

do $$
declare r_id uuid;
begin
  select id into r_id from recipes where name = 'Lavender Oat Melt & Pour Soap' limit 1;

  insert into recipe_ingredients (recipe_id, ingredient_name, amount, unit, notes, sort_order) values
    (r_id, 'Shea butter melt & pour soap base', '16', 'oz', 'cut into cubes', 0),
    (r_id, 'Colloidal oatmeal', '2', 'tbsp', 'finely milled', 1),
    (r_id, 'Lavender essential oil', '30', 'drops', 'approx 1 tsp', 2),
    (r_id, 'Dried lavender buds', '1', 'tbsp', 'optional, for top decoration', 3);

  insert into recipe_steps (recipe_id, step_number, instruction) values
    (r_id, 1, 'Cut soap base into small cubes and place in a microwave-safe bowl.'),
    (r_id, 2, 'Microwave in 30-second bursts, stirring between each, until fully melted. Do not overheat.'),
    (r_id, 3, 'Let cool slightly (about 2 minutes) until a thin skin begins to form on top — this prevents the oats from sinking.'),
    (r_id, 4, 'Stir in colloidal oatmeal and lavender essential oil gently.'),
    (r_id, 5, 'Pour into soap molds. Sprinkle dried lavender buds on top if using.'),
    (r_id, 6, 'Allow to cool completely at room temperature for 2–4 hours before unmolding. Do not refrigerate.');
end $$;
