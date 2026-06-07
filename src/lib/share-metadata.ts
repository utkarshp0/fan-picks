export type ShareInviteKind = "pool" | "match";

export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "https://fan-picks.vercel.app";
}

export function getShareImageUrl(kind: ShareInviteKind) {
  return createShareImageUrl(kind);
}

export function createShareImageUrl(kind: ShareInviteKind, inviteCode?: string) {
  const url = new URL("/api/share-image", getAppBaseUrl());

  url.searchParams.set("kind", kind);
  url.searchParams.set("v", "2");

  if (inviteCode) {
    url.searchParams.set("code", inviteCode);
  }

  return url.toString();
}

export function createShareImageMetadata(
  kind: ShareInviteKind,
  inviteCode?: string,
) {
  return {
    alt:
      kind === "match"
        ? "Fan Picks match prediction invite"
        : "Fan Picks pool invite",
    height: 630,
    type: "image/png",
    url: createShareImageUrl(kind, inviteCode),
    width: 1200,
  };
}
