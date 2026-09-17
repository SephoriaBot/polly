// toastBus.ts
// Location: craft-app/src/lib/toastBus.ts
//
// useToast()'s showToast only works inside React components. questSystem.ts
// (and other plain lib modules) need to fire toasts too, so this is a tiny
// pub/sub bridge: ToastProvider subscribes once on mount, and anything else
// can call publishToast() regardless of where it runs.
type ToastType = 'success' | 'error';
type Listener = (message: string, type: ToastType) => void;

let listener: Listener | null = null;

export function subscribeToastBus(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function publishToast(message: string, type: ToastType = 'success') {
  listener?.(message, type);
}