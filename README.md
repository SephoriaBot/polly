# Polly

A full-stack household management application for organizing finances, meals, and daily routines in one place. Polly combines multiple household tools into a single responsive web app with cloud sync through Supabase.

**Live demo:** [polly-demo.vercel.app](https://polly-demo.vercel.app)

## Features

- 📊 Dashboard with household statistics and quick actions
- 💰 Personal finance and budgeting tools, including Anytime Pay ramp modeling and a day-by-day money calendar
- 🛒 Grocery list management with live price comparison and search caching
- 🍽️ Unified meal planning — plan, get AI suggestions, and cook, all in one place
- 📅 Daily planner with appointment notes
- 📈 Personal trackers (sleep, weight, period) with correlation analysis
- 🌳 Decision tree tool for expected-value based choices
- ☁️ Cloud-synced data persistence via Supabase
- 📱 Responsive design for desktop and mobile

## Built With

- React
- TypeScript
- Vite
- Supabase (PostgreSQL)
- Recharts
- Lucide React
- Groq AI

## Getting Started

Clone the repository:

```bash
git clone https://github.com/SephoriaBot/polly.git
cd polly/craft-app
```

Install dependencies:

```bash
npm install
```

Configure environment variables — create a `.env` file in `craft-app/`:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Start the development server:

```bash
npm run dev
```

## Tech Highlights

- Full CRUD functionality against a Supabase/PostgreSQL backend
- Modular React component architecture
- TypeScript for type safety
- Interactive dashboards and data visualization with Recharts
- AI-assisted features via Groq (meal suggestions, cleaning wizard)
- Real-time data persistence
- Deployed with Vercel

## Future Improvements

- Shared household accounts
- Push notifications and reminders
- Offline support
- Calendar integration
- Expanded analytics and reporting
- Export and backup functionality

## License

This project is licensed under the MIT License.
