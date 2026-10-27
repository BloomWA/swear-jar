import { animate, motion, useMotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { COMBO_WINDOW_MS, SAILOR_MODE_AT } from '../config/game'
import { SCENE } from '../lib/jarWorld'
import { sfx } from '../lib/sound'
import { setPourAnimation, world } from '../state/game'
import { actions, useStore, type Catch } from '../state/store'

/* Glass silhouette (outer edge) and inner edge, matching JAR in jarWorld.ts */
const OUTER =
  'M167,124 L167,174 C167,200 117,208 117,246 L117,600 Q117,647 164,647 L396,647 Q443,647 443,600 L443,246 C443,208 393,200 393,174 L393,124 Z'
const INNER =
  'M178,118 L178,177 C178,197 128,206 128,250 L128,592 Q128,636 172,636 L388,636 Q432,636 432,592 L432,250 C432,206 382,197 382,177 L382,118 Z'

type Mood = 'happy' | 'shocked' | 'dizzy' | 'sailor' | 'sweat'

export function useSailorMode() {
  const combo = useStore((s) => s.combo)
  const [, tick] = useState(0)
  const active = combo.count >= SAILOR_MODE_AT && Date.now() - combo.lastAt < COMBO_WINDOW_MS
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => tick((n) => n + 1), COMBO_WINDOW_MS - (Date.now() - combo.lastAt) + 50)
    return () => clearTimeout(t)
  }, [active, combo.lastAt])
  return active
}

function Face({ mood }: { mood: Mood }) {
  const ink = '#2b1b4a'
  const eyes =
    mood === 'dizzy' ? (
      <g stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M236,382 l16,16 M252,382 l-16,16" />
        <path d="M308,382 l16,16 M324,382 l-16,16" />
      </g>
    ) : mood === 'shocked' ? (
      <g fill={ink}>
        <circle cx="244" cy="390" r="12" />
        <circle cx="316" cy="390" r="12" />
        <circle cx="248" cy="385" r="4" fill="white" />
        <circle cx="320" cy="385" r="4" fill="white" />
      </g>
    ) : mood === 'sailor' ? (
      <g fill={ink}>
        <ellipse className="jar-eye" cx="244" cy="390" rx="8" ry="10" />
        <path d="M306,392 q10,-10 20,0" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="247" cy="386" r="3" fill="white" />
      </g>
    ) : (
      <g fill={ink}>
        <ellipse className="jar-eye" cx="244" cy="390" rx="8" ry="10" />
        <ellipse className="jar-eye" cx="316" cy="390" rx="8" ry="10" />
        <circle cx="247" cy="386" r="3" fill="white" />
        <circle cx="319" cy="386" r="3" fill="white" />
      </g>
    )
  const mouth =
    mood === 'shocked' ? (
      <ellipse cx="280" cy="428" rx="13" ry="16" fill={ink} />
    ) : mood === 'dizzy' ? (
      <path d="M258,428 q7,-8 14,0 t14,0 t14,0" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
    ) : mood === 'sailor' ? (
      <path d="M258,418 q22,26 44,0 z" fill={ink} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
    ) : (
      <path d="M262,418 q18,18 36,0" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
    )
  return (
    <g opacity="0.95">
      {/* frosted label patch so the face stays readable over a pile of coins */}
      <ellipse cx="280" cy="406" rx="86" ry="58" fill="#fffaf0" opacity="0.82" stroke="#ffffff" strokeWidth="4" />
      <ellipse cx="222" cy="418" rx="14" ry="8" fill="#ff7aa2" opacity={mood === 'shocked' ? 0.85 : 0.55} />
      <ellipse cx="338" cy="418" rx="14" ry="8" fill="#ff7aa2" opacity={mood === 'shocked' ? 0.85 : 0.55} />
      {eyes}
      {mouth}
      {mood === 'sweat' && <path d="M352,360 q8,14 0,20 q-8,-6 0,-20 z" fill="#7cc8ff" stroke="#3b82f6" strokeWidth="2" />}
    </g>
  )
}

function SailorHat({ show }: { show: boolean }) {
  return (
    <g
      style={{
        transformBox: 'fill-box',
        transformOrigin: 'center bottom',
        transform: show ? 'translate(0,0) rotate(-16deg) scale(1)' : 'translate(0,-140px) rotate(-40deg) scale(0.4)',
        opacity: show ? 1 : 0,
        transition: 'transform .6s cubic-bezier(.3,1.7,.5,1), opacity .3s',
      }}
    >
      <path d="M150,104 Q150,44 222,40 Q294,44 294,104 Z" fill="#ffffff" stroke="#2b1b4a" strokeWidth="4" />
      <rect x="146" y="92" width="152" height="20" rx="8" fill="#1e3a8a" stroke="#2b1b4a" strokeWidth="4" />
      <path d="M222,58 v20 M214,62 h16 M212,72 q10,10 20,0" stroke="#ff4f81" strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  )
}

function CatchPopup({ c, compact }: { c: Catch; compact: boolean }) {
  return (
    <div
      className="catch-pop pointer-events-none absolute z-20"
      style={{ left: `${50 + c.x * 24}%`, top: compact ? '34%' : '13%' }}
      onAnimationEnd={() => actions.dismissCatch(c.id)}
    >
      <div className="relative flex flex-col items-center">
        <div
          className="relative whitespace-nowrap rounded-[22px] border-4 bg-white px-4 pb-1 pt-1.5 font-display leading-none shadow-[0_6px_0_rgba(43,27,74,0.15)]"
          style={{ borderColor: c.color, fontSize: 'clamp(22px, 4.2cqw, 40px)', color: '#2b1b4a' }}
        >
          {c.bleeped}!
          <span className="absolute -bottom-[14px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[14px] border-x-transparent" style={{ borderTopColor: c.color }} />
          <span
            className="absolute -right-5 -top-4 rotate-12 rounded-full border-[3px] border-white px-2 py-0.5 font-display text-white shadow-md"
            style={{ background: '#22c55e', fontSize: 'clamp(13px, 2.4cqw, 20px)' }}
          >
            +${c.value}
          </span>
        </div>
        {c.speaker && (
          <span className="mt-4 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">🗣 {c.speaker}</span>
        )}
      </div>
    </div>
  )
}

function ComboBannerView() {
  const banner = useStore((s) => s.comboBanner)
  if (!banner) return null
  return (
    <div
      key={banner.id}
      className="combo-banner pointer-events-none absolute left-1/2 top-[1.5%] z-30 whitespace-nowrap"
      onAnimationEnd={() => actions.dismissBanner(banner.id)}
    >
      <div
        className="rounded-[20px] border-4 border-white px-5 py-2 text-center font-display text-white shadow-[0_8px_0_rgba(43,27,74,0.25)]"
        style={{ background: banner.tier.color, fontSize: 'clamp(20px, 4.6cqw, 42px)', textShadow: '0 3px 0 rgba(0,0,0,0.2)' }}
      >
        <span className="mr-2">{banner.tier.emoji}</span>
        {banner.tier.title}
      </div>
    </div>
  )
}

export function JarScene({ compact = false }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rot = useMotionValue(0)
  const catches = useStore((s) => s.catches)
  const pouring = useStore((s) => s.pouring)
  const overflowed = useStore((s) => s.overflowed)
  const sailor = useSailorMode()
  const [shocked, setShocked] = useState(false)
  const gulpRef = useRef<HTMLDivElement>(null)
  const lastCatch = catches[catches.length - 1]?.id

  useEffect(() => {
    if (canvasRef.current) world.attach(canvasRef.current)
    return () => world.detach()
  }, [])

  useEffect(() => rot.on('change', (v) => world.setTilt(v)), [rot])

  useEffect(() => {
    if (lastCatch == null) return
    setShocked(true)
    const t1 = setTimeout(() => {
      const el = gulpRef.current
      if (!el) return
      el.classList.remove('jar-gulp')
      void el.offsetWidth // restart the CSS animation
      el.classList.add('jar-gulp')
    }, 450)
    const t2 = setTimeout(() => setShocked(false), 1100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [lastCatch])

  useEffect(() => {
    setPourAnimation(async () => {
      sfx.rattle(1)
      const kick = setInterval(() => world.shake(0.7), 140)
      await animate(rot, [0, -9, 9, -11, 10, -8, 6, 0], { duration: 1, ease: 'easeInOut' })
      clearInterval(kick)
      sfx.pour()
      await animate(rot, 158, { duration: 0.85, ease: [0.55, 0, 0.35, 1] })
      world.shake(0.4)
      await new Promise((r) => setTimeout(r, 1400))
      world.clear()
      await animate(rot, 0, { type: 'spring', stiffness: 170, damping: 11 })
    })
    return () => setPourAnimation(null)
  }, [rot])

  const mood: Mood = pouring ? 'dizzy' : shocked ? 'shocked' : sailor ? 'sailor' : overflowed ? 'sweat' : 'happy'

  return (
    <div
      className="relative mx-auto select-none"
      style={{ aspectRatio: `${SCENE.w} / ${SCENE.h}`, height: '100%', maxWidth: '100%', containerType: 'inline-size' }}
    >
      {/* table: doesn't tip over with the jar */}
      <svg viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd9a8" />
            <stop offset="1" stopColor="#f2a96b" />
          </linearGradient>
        </defs>
        <rect x="4" y="650" width="552" height="66" rx="26" fill="url(#table)" />
        <rect x="4" y="650" width="552" height="8" rx="4" fill="#fff1dc" opacity="0.8" />
        <ellipse cx="280" cy="652" rx={pouring ? 60 : 180} ry="11" fill="#7a3e12" opacity="0.18" style={{ transition: 'rx .6s' }} />
      </svg>

      <motion.div className="absolute inset-0" style={{ rotate: rot, transformOrigin: '50% 56%' }}>
        <div ref={gulpRef} className="absolute inset-0" style={{ transformOrigin: '50% 90%' }}>
          {/* back of the glass */}
          <svg viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="glassBack" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#bfe6ff" stopOpacity="0.55" />
                <stop offset="0.5" stopColor="#e9f7ff" stopOpacity="0.25" />
                <stop offset="1" stopColor="#a8d8ff" stopOpacity="0.55" />
              </linearGradient>
            </defs>
            <path d={INNER} fill="url(#glassBack)" />
            <ellipse cx="280" cy="114" rx="104" ry="12" fill="none" stroke="#9fd2f5" strokeWidth="5" opacity="0.6" />
          </svg>

          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* front of the glass */}
          <svg viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="glassWall" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8fd0ff" stopOpacity="0.85" />
                <stop offset="0.15" stopColor="#d9f1ff" stopOpacity="0.5" />
                <stop offset="0.85" stopColor="#d9f1ff" stopOpacity="0.5" />
                <stop offset="1" stopColor="#7cc4fb" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="1" stopColor="#9fd6ff" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            {/* glass wall thickness */}
            <path d={`${OUTER} ${INNER}`} fillRule="evenodd" fill="url(#glassWall)" />
            <path d={OUTER} fill="none" stroke="#5aa9e6" strokeWidth="3.5" strokeLinejoin="round" opacity="0.9" />
            <path d={OUTER} fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" transform="translate(2 2)" />
            {/* highlights */}
            <rect x="146" y="262" width="18" height="300" rx="9" fill="white" opacity="0.6" />
            <rect x="172" y="282" width="7" height="190" rx="3.5" fill="white" opacity="0.45" />
            <rect x="404" y="300" width="9" height="140" rx="4.5" fill="white" opacity="0.4" />
            <path d="M140,236 C152,214 176,206 186,192" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.65" />
            <path d="M176,612 Q200,628 250,628" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.5" />
            {/* lip */}
            <rect x="156" y="98" width="248" height="28" rx="14" fill="url(#lip)" stroke="#5aa9e6" strokeWidth="3.5" />
            <rect x="170" y="104" width="120" height="6" rx="3" fill="white" opacity="0.9" />

            <Face mood={mood} />

            {/* hang tag */}
            {!compact && (
              <g className="wiggle" style={{ transformBox: 'fill-box', transformOrigin: '0% 0%' }}>
                <path d="M392,150 C420,150 440,170 452,196" stroke="#a0662f" strokeWidth="3" fill="none" />
                <g transform="rotate(14 470 236)">
                  <path d="M430,200 h80 a10,10 0 0 1 10,10 v62 a10,10 0 0 1 -10,10 h-80 l-18,-18 v-46 z" fill="#ffe2a8" stroke="#a0662f" strokeWidth="3" />
                  <circle cx="428" cy="241" r="5" fill="#fff8ec" stroke="#a0662f" strokeWidth="2.5" />
                  <text x="472" y="236" textAnchor="middle" fontFamily="Lilita One" fontSize="19" fill="#2b1b4a">
                    SWEAR
                  </text>
                  <text x="472" y="256" textAnchor="middle" fontFamily="Lilita One" fontSize="19" fill="#ff4f81">
                    JAR
                  </text>
                  <text x="472" y="273" textAnchor="middle" fontFamily="Fredoka Variable" fontWeight="600" fontSize="10" fill="#a0662f">
                    $1 / naughty word
                  </text>
                </g>
              </g>
            )}

            <SailorHat show={sailor && !pouring} />
          </svg>
        </div>
      </motion.div>

      {catches.map((c) => (
        <CatchPopup key={c.id} c={c} compact={compact} />
      ))}
      <ComboBannerView />

      {overflowed && !pouring && (
        <div className="wiggle pointer-events-none absolute bottom-[11%] left-[2%] z-10 rotate-[-8deg] rounded-2xl border-4 border-white bg-hot px-3 py-1 font-display text-white shadow-lg" style={{ fontSize: 'clamp(13px, 2.8cqw, 22px)' }}>
          OVERFLOWING! 🫠
        </div>
      )}
    </div>
  )
}
