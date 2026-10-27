/**
 * ─────────────────────────────────────────────────────────────
 *  THE SWEAR LIST  ·  edit me!
 * ─────────────────────────────────────────────────────────────
 *
 *  Each family has:
 *   - root:      the core letters. Used to bleep the word on screen
 *                (F*CK) and, if `catchVariants` is on, to catch any
 *                word containing the root that isn't listed below
 *                (e.g. "fuckwit", "shitbag").
 *   - value:     default price in dollars for anything in the family.
 *   - words:     explicit words → price. Any word listed here wins
 *                over the family default, so make the big ones pricey.
 *
 *  Add a new family (e.g. "damn") by copying a block below.
 *  Words are matched case-insensitively against whole words, and
 *  censored transcripts like "f***", "s***", "f**king" are mapped
 *  back to the closest word in this list automatically (same length
 *  wins; ties go to whichever word is listed first, so keep the
 *  common forms near the top of each family).
 */

export interface SwearFamily {
  id: string
  root: string
  value: number
  /** Pill colour used in the leaderboard / popups. */
  color: string
  words: Record<string, number>
}

/** Catch unlisted words that contain a family root (e.g. "fuckwit"). */
export const catchVariants = true

/**
 * Words that contain a root but are NOT swears. "shitake" mushrooms
 * deserve better. Add any false positives here.
 */
export const allowList: string[] = ['shitake', 'shiitake', 'mishit', 'mishits']

export const SWEAR_FAMILIES: SwearFamily[] = [
  {
    id: 'fuck',
    root: 'fuck',
    value: 1,
    color: '#ff4f81',
    words: {
      fuck: 1,
      fucks: 1,
      fucking: 1,
      fuckin: 1,
      fucked: 1,
      fucker: 1,
      fuckers: 1,
      fuckery: 1,
      fuckface: 2,
      fuckwit: 2,
      fuckhead: 2,
      fucktard: 2,
      fuckup: 1,
      fuckoff: 1,
      clusterfuck: 2,
      motherfucker: 2,
      motherfuckers: 2,
      motherfucking: 2,
      motherfuckin: 2,
      unfuckingbelievable: 3,
      absofuckinglutely: 3,
      fml: 1,
      wtf: 1,
      stfu: 1,
    },
  },
  {
    id: 'shit',
    root: 'shit',
    value: 1,
    color: '#ffb020',
    words: {
      shit: 1,
      shits: 1,
      shitty: 1,
      shittier: 1,
      shittiest: 1,
      shitting: 1,
      shitted: 1,
      shite: 1,
      bullshit: 1,
      bullshitting: 1,
      horseshit: 1,
      chickenshit: 1,
      dipshit: 1,
      batshit: 1,
      apeshit: 1,
      shithead: 2,
      shitshow: 2,
      shitstorm: 2,
      shithole: 2,
      shitload: 1,
      shitfaced: 1,
      holyshit: 1,
    },
  },
]
