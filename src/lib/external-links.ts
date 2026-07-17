export function normalizeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function openExternalUrl(value: string): Window | null {
  const safeUrl = normalizeExternalUrl(value);
  if (!safeUrl) return null;
  const opened = window.open(safeUrl, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  return opened;
}
