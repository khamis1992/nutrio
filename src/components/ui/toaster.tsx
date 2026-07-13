export function Toaster() {
  // useToast now delegates to Sonner; toasts array is no longer managed here.
  // The actual toast UI is rendered by <Sonner /> in App.tsx.
  // This component is kept for backward-compat but renders nothing.
  return null;
}
