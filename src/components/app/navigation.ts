import {
  Activity,
  Radio,
  Trophy,
  UserRound,
} from "lucide-react";

import type { NavItem } from "@/types/championship";

export const navigationItems: NavItem[] = [
  { href: "#championships", icon: Trophy, label: "Championships" },
  { href: "/live-scores", icon: Radio, label: "Live Scores" },
  { href: "#predictions", icon: Trophy, label: "Predictions" },
  { href: "#audit", icon: Activity, label: "Audit" },
  { href: "#profile", icon: UserRound, label: "Profile" },
];
