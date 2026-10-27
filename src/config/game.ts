/** Combo & milestone tuning. Tweak freely. */

/** Swears within this many ms of the previous one keep the combo alive. */
export const COMBO_WINDOW_MS = 30_000

export interface ComboTier {
  at: number
  title: string
  emoji: string
  color: string
}

/** Reaction shown when the combo reaches `at` swears. Highest matching tier wins. */
export const COMBO_TIERS: ComboTier[] = [
  { at: 2, title: 'Double Trouble!', emoji: '😬', color: '#ffb020' },
  { at: 3, title: 'Potty Mouth Combo x3!', emoji: '🚽', color: '#ff7a45' },
  { at: 4, title: 'Salty Streak x4!', emoji: '🧂', color: '#ff4f81' },
  { at: 5, title: 'Sailor Mode Activated', emoji: '⚓', color: '#3b82f6' },
  { at: 7, title: 'Absolutely Unhinged x7', emoji: '🌪️', color: '#a855f7' },
  { at: 10, title: 'LEGENDARY LANGUAGE x10', emoji: '👑', color: '#f59e0b' },
  { at: 15, title: 'Someone Call HR x15', emoji: '📞', color: '#ef4444' },
]

/** Combo level at which the jar puts its sailor hat on. */
export const SAILOR_MODE_AT = 5

export interface Milestone {
  amount: number
  title: string
  blurb: string
  emoji: string
  color: string
}

export const MILESTONES: Milestone[] = [
  { amount: 5, title: 'Pocket Change Potty Mouth', blurb: 'A respectable start. Your nan would still be disappointed.', emoji: '🪙', color: '#22c55e' },
  { amount: 10, title: 'Ten Buck Trucker', blurb: 'Breaker breaker, that language is a menace.', emoji: '🚚', color: '#06b6d4' },
  { amount: 25, title: 'Salty Sea Dog', blurb: 'The sailors have heard of you. They are concerned.', emoji: '🏴‍☠️', color: '#3b82f6' },
  { amount: 50, title: 'Fluent in Profanity', blurb: 'Swearing is now officially your second language.', emoji: '🎓', color: '#a855f7' },
  { amount: 100, title: 'Profanity Philanthropist', blurb: 'This jar could fund a small charity. Please let it.', emoji: '💸', color: '#f59e0b' },
]
