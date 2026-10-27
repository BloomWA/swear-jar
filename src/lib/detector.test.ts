import { describe, expect, it } from 'vitest'
import { SegmentDeduper, bleep, detectSwears } from './detector'

const words = (t: string) => detectSwears(t).map((h) => h.word)

describe('detectSwears', () => {
  it('finds plain swears and variants', () => {
    expect(words('Oh shit, the fucking build is broken')).toEqual(['shit', 'fucking'])
    expect(words("Fuckin' hell, that's bullshit. Total shitshow.")).toEqual(['fuckin', 'bullshit', 'shitshow'])
  })

  it('uses configured values', () => {
    const [hit] = detectSwears('you motherfucker')
    expect(hit.word).toBe('motherfucker')
    expect(hit.value).toBe(2)
  })

  it('joins split compounds', () => {
    expect(words('mother fucker')).toEqual(['motherfucker'])
    expect(words('that is bull shit')).toEqual(['bullshit'])
  })

  it('catches unlisted variants via the family root', () => {
    expect(words('what a fuckwad')).toEqual(['fuckwad'])
  })

  it('recovers censored words', () => {
    expect(words('f*** this')).toEqual(['fuck'])
    expect(words('oh s***')).toEqual(['shit'])
    expect(words('f**king hell')).toEqual(['fucking'])
    expect(words('f******')).toEqual(['fucking'])
    expect(words('a s***ty day')).toEqual(['shitty'])
    expect(words('b*******')).toEqual(['bullshit'])
    expect(detectSwears('f***')[0].wasCensored).toBe(true)
  })

  it('ignores clean speech and allow-listed words', () => {
    expect(words('shiitake mushrooms with a fork, shift the sheet')).toEqual([])
    expect(words('****')).toEqual([])
  })
})

describe('bleep', () => {
  it('stars the root vowel', () => {
    expect(bleep('fuck', 'fuck')).toBe('F*CK')
    expect(bleep('bullshit', 'shit')).toBe('BULLSH*T')
    expect(bleep('motherfucker', 'fuck')).toBe('MOTHERF*CKER')
    expect(bleep('wtf')).toBe('W*F')
  })
})

describe('SegmentDeduper', () => {
  it('counts interim → final refinements once', () => {
    const d = new SegmentDeduper()
    expect(d.take('a', detectSwears('oh shit'))).toHaveLength(1)
    expect(d.take('a', detectSwears('oh shit that'))).toHaveLength(0)
    expect(d.take('a', detectSwears('oh s*** that fucking'))).toHaveLength(1)
    expect(d.take('a', detectSwears('oh shit that fucking thing'))).toHaveLength(0)
    expect(d.take('b', detectSwears('shit'))).toHaveLength(1)
  })
})
