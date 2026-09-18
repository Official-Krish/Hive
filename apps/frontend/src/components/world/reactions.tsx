import type { SocialReaction } from "@hive/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChampagneGlasses,
  faFaceLaugh,
  faFire,
  faHand,
  faHandsClapping,
  faHeart,
  faThumbsUp,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

/* ─────────────────────────────────────────────────────────────
   REACTIONS — social presence iconography (Font Awesome solid).
   Single source for reaction ids (the wire format), icons, and
   labels. Emoji are never rendered for presence: solid vector
   icons stay legible at avatar-plate sizes and match the HUD.
   ───────────────────────────────────────────────────────────── */

export const REACTION_IDS: SocialReaction[] = [
  "applause",
  "heart",
  "laugh",
  "party",
  "like",
  "fire",
  "wave",
];

export type ReactionId = SocialReaction;

const REACTION_ICONS: Record<ReactionId, IconDefinition> = {
  applause: faHandsClapping,
  heart: faHeart,
  laugh: faFaceLaugh,
  party: faChampagneGlasses,
  like: faThumbsUp,
  fire: faFire,
  wave: faHand,
};

const REACTION_LABELS: Record<ReactionId, string> = {
  applause: "Applause",
  heart: "Love",
  laugh: "Laugh",
  party: "Party",
  like: "Like",
  fire: "Fire",
  wave: "Wave",
};

/** Picker order (wave is sent via the member card, not the picker). */
export const PICKER_REACTIONS: ReactionId[] = [
  "applause",
  "heart",
  "laugh",
  "party",
  "like",
  "fire",
];

export function reactionLabel(id: string): string {
  return (REACTION_LABELS as Record<string, string>)[id] ?? id;
}

export function ReactionIcon({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const icon =
    (REACTION_ICONS as Record<string, IconDefinition>)[id] ?? faHeart;
  // Decorative: callers label the action (picker buttons, img role).
  return <FontAwesomeIcon icon={icon} className={className} aria-hidden />;
}
