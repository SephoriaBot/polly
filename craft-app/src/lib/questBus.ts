// questBus.ts
// Location: craft-app/src/lib/questBus.ts
//
// Same idea as toastBus.ts: questSystem.ts runs as a plain lib module,
// not a component, so it can't call a hook to tell QuestBoard "go
// refetch." This is the bridge — QuestBoard subscribes once on mount,
// and claimQuest/maybeSpawnQuest call publishQuestChanged() whenever the
// active quest changes so the board never shows stale state.
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeQuestBus(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function publishQuestChanged() {
  listeners.forEach((fn) => fn());
}