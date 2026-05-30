/**
 * Badge metadata and image mappings for the NUTRIO achievement system.
 *
 * Maps database badge_id values to PNG assets in src/assets/Badge/
 * and provides user-facing display metadata (name, description, rarity).
 */

import Badge1 from "@/assets/Badge/Badge 1.png";
import Badge2 from "@/assets/Badge/Badge 2.png";
import Badge3 from "@/assets/Badge/Badge 3.png";
import Badge4 from "@/assets/Badge/Badge 4.png";
import Badge5 from "@/assets/Badge/Badge 5.png";
import Badge6 from "@/assets/Badge/Badge 6.png";
import Badge7 from "@/assets/Badge/Badge 7.png";
import Badge8 from "@/assets/Badge/Badge 8.png";
import Badge9 from "@/assets/Badge/Badge 9.png";
import Badge10 from "@/assets/Badge/Badge 10.png";
import Badge11 from "@/assets/Badge/Badge 11.png";
import Badge12 from "@/assets/Badge/Badge 12.png";
import Badge13 from "@/assets/Badge/Badge 13.png";
import Badge14 from "@/assets/Badge/Badge 14.png";
import Badge15 from "@/assets/Badge/Badge 15.png";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export interface BadgeMeta {
  /** Database badge_id (matches badges.id in Supabase) */
  id: string;
  /** Display name */
  name: string;
  /** Short description / unlock criteria */
  description: string;
  /** Rarity tier */
  rarity: BadgeRarity;
  /** Imported PNG image source */
  image: string;
  /** XP awarded on unlock */
  xpReward: number;
}

export interface UserBadge extends BadgeMeta {
  /** Whether the user has unlocked this badge */
  unlocked: boolean;
  /** ISO timestamp of unlock, null if locked */
  unlockedAt: string | null;
}

/** Rarity-based color palette for badge card styling */
export const RARITY_COLORS: Record<BadgeRarity, { border: string; bg: string; glow: string }> = {
  common:    { border: "border-slate-200",  bg: "from-slate-100 to-slate-300",     glow: "shadow-slate-200/40" },
  rare:      { border: "border-blue-200",   bg: "from-blue-100 to-blue-300",       glow: "shadow-blue-200/50" },
  epic:      { border: "border-purple-200", bg: "from-purple-100 to-purple-300",   glow: "shadow-purple-300/50" },
  legendary: { border: "border-amber-200",  bg: "from-amber-100 to-amber-400",     glow: "shadow-amber-300/60" },
};

/**
 * Master badge registry — single source of truth connecting database badge_id
 * to display metadata and PNG asset.
 *
 * Sorted by display order (image number 1–15).
 */
export const BADGE_REGISTRY: BadgeMeta[] = [
  { id: "first_meal",        name: "First Bite",          description: "Log your first meal",                    rarity: "common",    image: Badge1,  xpReward: 50 },
  { id: "salad_sampler",     name: "Salad Sampler",       description: "Order 5 different salads",              rarity: "common",    image: Badge2,  xpReward: 50 },
  { id: "week_warrior",      name: "Week Warrior",        description: "Log meals 7 days straight",             rarity: "common",    image: Badge3,  xpReward: 100 },
  { id: "nutrition_ninja",   name: "Nutrition Ninja",     description: "Hit calorie goal 5 days in a row",      rarity: "rare",      image: Badge4,  xpReward: 150 },
  { id: "variety_king",      name: "Variety King",        description: "Order from 10 different restaurants",   rarity: "rare",      image: Badge5,  xpReward: 200 },
  { id: "explorer",          name: "Explorer",            description: "Order from 10 different restaurants",   rarity: "rare",      image: Badge6,  xpReward: 100 },
  { id: "social_butterfly",  name: "Social Butterfly",    description: "Refer 3 friends who subscribe",          rarity: "rare",      image: Badge7,  xpReward: 250 },
  { id: "hydration_hero",    name: "Hydration Hero",      description: "Log 8 cups of water for 14 days",        rarity: "rare",      image: Badge8,  xpReward: 100 },
  { id: "protein_king",      name: "Protein King",        description: "Hit protein target 30 days",             rarity: "epic",      image: Badge9,  xpReward: 200 },
  { id: "protein_king",      name: "Protein King",        description: "Hit protein target 30 days",             rarity: "epic",      image: Badge10, xpReward: 200 },
  { id: "streak_master",     name: "Streak Master",       description: "30-day streak",                          rarity: "epic",      image: Badge11, xpReward: 300 },
  { id: "subscription_hero", name: "Subscription Hero",   description: "6 months subscribed",                    rarity: "epic",      image: Badge12, xpReward: 400 },
  { id: "streak_30",         name: "30-Day Streak",       description: "30 days of meal logging",                rarity: "legendary", image: Badge13, xpReward: 300 },
  { id: "goal_crusher",      name: "Goal Crusher",        description: "Reach your target weight",               rarity: "legendary", image: Badge14, xpReward: 500 },
  { id: "nutrio_royalty",    name: "NUTRIO Royalty",      description: "Reach Level 50",                         rarity: "legendary", image: Badge15, xpReward: 1000 },
];

/**
 * Lookup badge metadata by its database id.
 * Returns the first match (for duplicate badges like protein_king, returns the first entry).
 */
export function getBadgeMeta(badgeId: string): BadgeMeta | undefined {
  return BADGE_REGISTRY.find((b) => b.id === badgeId);
}
