// Helpers to recognise what kind of reference a link is (YouTube, Google, Instagram…).

export type LinkKind = "youtube" | "google" | "instagram" | "pinterest" | "facebook" | "drive" | "website";

export function normalizeUrl(input: string) {
  const v = input.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

export function isValidUrl(input: string) {
  try {
    const u = new URL(normalizeUrl(input));
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return url;
  }
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function linkKind(url: string): LinkKind {
  const host = hostOf(url);
  if (youtubeId(url) || host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (host.startsWith("drive.google") || host.startsWith("docs.google")) return "drive";
  if (/(^|\.)google\./.test(host) || host.startsWith("google.")) return "google";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.includes("pinterest.") || host === "pin.it") return "pinterest";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  return "website";
}

export const LINK_LABEL: Record<LinkKind, string> = {
  youtube: "YouTube",
  google: "Google",
  instagram: "Instagram",
  pinterest: "Pinterest",
  facebook: "Facebook",
  drive: "Google Drive",
  website: "Website",
};

/** Lower-case + Unicode-normalise so Hindi typed on any keyboard matches stored text. */
export function searchable(value: string | undefined | null) {
  return (value ?? "").normalize("NFC").toLowerCase();
}
