# Craft & Garden App

Your personal apothecary and garden tracker. React + TypeScript + Vite + Supabase + Vercel.

## Setup

### 1. Supabase
1. Create a new project at supabase.com
2. Open SQL Editor, paste and run supabase-schema.sql
3. Copy your Project URL and anon key from Settings > API

### 2. Local dev
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev

### 3. Vercel deploy
1. Push to GitHub, import in vercel.com
2. Add environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
3. Deploy
