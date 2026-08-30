export interface PollyTourStep {
  title: string;
  body: string;
}

export const POLLY_TOUR_CONTENT: Record<string, PollyTourStep> = {
  dashboard: {
    title: "This is your Dashboard",
    body: "Your focuses for today, a quick weather and moon phase check, and anything else on your radar all live here.",
  },
  grocery: {
    title: "Grocery",
    body: "Build your shopping list, explore recipes, and let Smart Cart compare prices for you.",
  },
  dailyplanner: {
    title: "Daily Planner",
    body: "Daily tasks, appointments, scheduled chores, event planning, goals, and appointment notes — all your schedule stuff lives here.",
  },
  wallet: {
    title: "Wallet",
    body: "Bills, your money calendar, and a debt payoff plan, all in one place.",
  },
  trackers: {
    title: "Trackers",
    body: "Keep tabs on habits and anything else you want to track over time.",
  },
  decisions: {
    title: "Decision Tree",
    body: "Stuck on a choice? Work through it step by step here, or choose a simple battle for polly to make it for you.",
  },
  habitat: {
    title: "Habitat",
    body: "This is my home! Decorate my shelf with items you collect on your journey and make yourself comfortable. As you complete your tasks, you will hatch more hamsters to fill this space with. Be careful though, there are wild hamsters!",
  },
};