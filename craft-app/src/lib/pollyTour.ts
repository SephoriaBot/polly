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
  grocery: [
    {
    title: "This is your Grocery page",
    body: "Here you can build your shopping list, explore recipes, and let Smart Cart compare prices for you to find the cheapest trip.",
  },
],
  dailyplanner: [
    {
    title: "This is your Daily Planner",
    body: "Daily tasks, appointments, chores, event planning, goals, and appointment notes — if you can plan it or turn it into a checklist, it lives here.",
  },
],
  wallet: [
    {
    title: "Here is your Wallet",
    body: "Your bills, a personalized money calendar for planning with your projected income, and a customized debt payoff plan can all be found here.",
  },
],
  trackers: [
    {
    title: "This page is for your Trackers",
    body: "Keep tabs on habits and anything else you want to track over time. There are presets for sleep, cycle and weight- or make your own!",
  },
],
  decisions: [
    {
    title: "This page is for tough Decisions",
    body: "Work through it step by step here in a decision tree and weigh the best choice, or choose a simple battle for polly to make it for you.",
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