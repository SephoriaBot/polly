export interface PollyTourStep {
  title: string;
  body: string;
}

export const POLLY_TOUR_CONTENT: Record<string, PollyTourStep[]> = {
  dashboard: [
    {
      title: "Welcome home! This is your Dashboard",
      body: "Your focuses, a weather widget, and an at-a-glance summary of your space can be found here.",
    },
    {
      title: "One more thing!",
      body: "At the top of the page you have Brain Dump, where you can give me your run-on thoughts and I will sort them into tasks for you. You can also change your theme here!",
    },
  ],
  dailyplanner: [
    {
    title: "This is your Planning page",
    body: "Daily tasks, appointments, chores, event planning, goals, and trackers for habits, sleep, cycle and weight — if you can plan it, check it off, or keep tabs on it, it lives here.",
  },
],
  wallet: [
    {
    title: "Here is your Wallet",
    body: "Your bills, a personalized money calendar for planning with your projected income, and a customized debt payoff plan can all be found here.",
  },
],
  habitat: [
    {
    title: "This is my favorite part- the Habitat",
    body: "This is my home! Decorate my shelf with items you collect on your journey, visit the breeder, train your creatures in tournaments and watch them evolve with training points.",
  },
  {
    title: "Hmmm..",
    body: "The breeder said they just got a surprise litter, we should go check it out!",
  },
],
};