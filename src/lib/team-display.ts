export type TeamRegion = "Africa" | "Americas" | "Asia/Oceania" | "Europe";

type TeamDisplayInfo = {
  flagCode?: string;
  region?: TeamRegion;
};

const teamDisplayInfo: Record<string, TeamDisplayInfo> = {
  algeria: { flagCode: "dz", region: "Africa" },
  argentina: { flagCode: "ar", region: "Americas" },
  australia: { flagCode: "au", region: "Asia/Oceania" },
  austria: { flagCode: "at", region: "Europe" },
  belgium: { flagCode: "be", region: "Europe" },
  "bosnia and herzegovina": { flagCode: "ba", region: "Europe" },
  brazil: { flagCode: "br", region: "Americas" },
  canada: { flagCode: "ca", region: "Americas" },
  "cape verde": { flagCode: "cv", region: "Africa" },
  colombia: { flagCode: "co", region: "Americas" },
  "congo dr": { flagCode: "cd", region: "Africa" },
  croatia: { flagCode: "hr", region: "Europe" },
  curacao: { flagCode: "cw", region: "Americas" },
  czechia: { flagCode: "cz", region: "Europe" },
  "czech republic": { flagCode: "cz", region: "Europe" },
  "dr congo": { flagCode: "cd", region: "Africa" },
  ecuador: { flagCode: "ec", region: "Americas" },
  egypt: { flagCode: "eg", region: "Africa" },
  england: { flagCode: "gb-eng", region: "Europe" },
  france: { flagCode: "fr", region: "Europe" },
  germany: { flagCode: "de", region: "Europe" },
  ghana: { flagCode: "gh", region: "Africa" },
  haiti: { flagCode: "ht", region: "Americas" },
  "ir iran": { flagCode: "ir", region: "Asia/Oceania" },
  iran: { flagCode: "ir", region: "Asia/Oceania" },
  iraq: { flagCode: "iq", region: "Asia/Oceania" },
  "ivory coast": { flagCode: "ci", region: "Africa" },
  japan: { flagCode: "jp", region: "Asia/Oceania" },
  jordan: { flagCode: "jo", region: "Asia/Oceania" },
  mexico: { flagCode: "mx", region: "Americas" },
  morocco: { flagCode: "ma", region: "Africa" },
  netherlands: { flagCode: "nl", region: "Europe" },
  "new zealand": { flagCode: "nz", region: "Asia/Oceania" },
  norway: { flagCode: "no", region: "Europe" },
  panama: { flagCode: "pa", region: "Americas" },
  paraguay: { flagCode: "py", region: "Americas" },
  portugal: { flagCode: "pt", region: "Europe" },
  qatar: { flagCode: "qa", region: "Asia/Oceania" },
  saudiarabia: { flagCode: "sa", region: "Asia/Oceania" },
  "saudi arabia": { flagCode: "sa", region: "Asia/Oceania" },
  scotland: { flagCode: "gb-sct", region: "Europe" },
  senegal: { flagCode: "sn", region: "Africa" },
  "south africa": { flagCode: "za", region: "Africa" },
  "south korea": { flagCode: "kr", region: "Asia/Oceania" },
  spain: { flagCode: "es", region: "Europe" },
  sweden: { flagCode: "se", region: "Europe" },
  switzerland: { flagCode: "ch", region: "Europe" },
  tunisia: { flagCode: "tn", region: "Africa" },
  turkey: { flagCode: "tr", region: "Europe" },
  turkiye: { flagCode: "tr", region: "Europe" },
  "türkiye": { flagCode: "tr", region: "Europe" },
  "united states": { flagCode: "us", region: "Americas" },
  usa: { flagCode: "us", region: "Americas" },
  uruguay: { flagCode: "uy", region: "Americas" },
  uzbekistan: { flagCode: "uz", region: "Asia/Oceania" },
};

export const teamRegions: TeamRegion[] = [
  "Africa",
  "Americas",
  "Asia/Oceania",
  "Europe",
];

export function getTeamDisplayInfo(teamName: string) {
  return teamDisplayInfo[normalizeTeamDisplayKey(teamName)] ?? {};
}

export function getTeamInitials(teamName: string) {
  return teamName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function teamMatchesSearch(teamName: string, query: string) {
  const cleanQuery = normalizeTeamDisplayKey(query);

  if (!cleanQuery) {
    return true;
  }

  return normalizeTeamDisplayKey(teamName).includes(cleanQuery);
}

function normalizeTeamDisplayKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}
