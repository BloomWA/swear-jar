import Matter from 'matter-js'

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter

/**
 * Logical scene size. The SVG jar uses the same viewBox, so physics
 * coordinates and drawing line up exactly; CSS scales both together.
 */
export const SCENE = { w: 560, h: 720 }

/** Inner edge of the glass (where coins touch). */
export const JAR = {
  cx: 280,
  rimY: 112, // top of the lip
  neckL: 178,
  neckR: 382,
  neckBottom: 176,
  bodyL: 128,
  bodyR: 432,
  shoulderY: 240,
  cornerY: 590, // where the rounded bottom starts
  floorY: 636,
  glass: 11,
  tableY: 650,
}

export const COIN_R = 21
const WALL = 14

type Kind = 'coin' | 'bill'

interface Token extends Matter.Body {
  plugin: { kind: Kind; value: number; sprite: number; born: number }
}

export interface DropOptions {
  value: number
  /** Horizontal nudge, -1..1. */
  spread?: number
  /** Optional delay before it appears, ms. */
  delay?: number
}

/** Build a static wall whose inner face lies on the segment p1→p2. */
function segmentWall(x1: number, y1: number, x2: number, y2: number, inside: { x: number; y: number }, thickness = WALL) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  let nx = -dy / len
  let ny = dx / len
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  if ((inside.x - mx) * nx + (inside.y - my) * ny > 0) {
    nx = -nx
    ny = -ny
  }
  return Bodies.rectangle(mx + (nx * thickness) / 2, my + (ny * thickness) / 2, len + 4, thickness, {
    isStatic: true,
    angle: Math.atan2(dy, dx),
    friction: 0.3,
    restitution: 0.2,
    render: { visible: false },
  })
}

/* ───────────────────────── sprites ───────────────────────── */

const COIN_TINTS = [
  ['#fff6c2', '#ffd23f', '#e8a400', '#b97800'],
  ['#fff1b0', '#ffc928', '#e09200', '#a86a00'],
  ['#fffbe0', '#ffe066', '#f0b400', '#c28a00'],
]

function makeCoinSprite(tint: string[], scale: number): HTMLCanvasElement {
  const r = COIN_R
  const size = Math.ceil((r * 2 + 4) * scale)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.scale(scale, scale)
  g.translate(r + 2, r + 2)
  // baked contact shadow
  g.fillStyle = 'rgba(110,60,0,0.28)'
  g.beginPath()
  g.arc(0.6, 1.6, r, 0, Math.PI * 2)
  g.fill()
  // rim
  const rim = g.createLinearGradient(-r, -r, r, r)
  rim.addColorStop(0, tint[1])
  rim.addColorStop(1, tint[3])
  g.fillStyle = rim
  g.beginPath()
  g.arc(0, 0, r, 0, Math.PI * 2)
  g.fill()
  // face
  const face = g.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r)
  face.addColorStop(0, tint[0])
  face.addColorStop(0.45, tint[1])
  face.addColorStop(1, tint[2])
  g.fillStyle = face
  g.beginPath()
  g.arc(0, 0, r * 0.8, 0, Math.PI * 2)
  g.fill()
  // reeded edge dots
  g.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    g.beginPath()
    g.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0.9, 0, Math.PI * 2)
    g.fill()
  }
  // embossed $
  g.font = `900 ${r * 1.15}px "Lilita One", system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.fillText('$', 0.8, 1.8)
  g.fillStyle = tint[3]
  g.fillText('$', 0, 1)
  return c
}

const BILL_W = 72
const BILL_H = 35

function makeBillSprite(value: number, scale: number, seed: number): HTMLCanvasElement {
  const w = BILL_W
  const h = BILL_H
  const c = document.createElement('canvas')
  c.width = Math.ceil((w + 8) * scale)
  c.height = Math.ceil((h + 8) * scale)
  const g = c.getContext('2d')!
  g.scale(scale, scale)
  g.translate(4, 4)
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 3
  // crumpled outline
  g.beginPath()
  const pts: [number, number][] = []
  for (let i = 0; i <= 6; i++) pts.push([(w / 6) * i, rnd()])
  for (let i = 1; i <= 3; i++) pts.push([w + rnd(), (h / 3) * i])
  for (let i = 5; i >= 0; i--) pts.push([(w / 6) * i, h + rnd()])
  for (let i = 2; i >= 1; i--) pts.push([rnd(), (h / 3) * i])
  g.moveTo(pts[0][0], pts[0][1])
  pts.forEach(([x, y]) => g.lineTo(x, y))
  g.closePath()
  const grad = g.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#b9f5c4')
  grad.addColorStop(0.5, '#6fdc8c')
  grad.addColorStop(1, '#3fbf68')
  g.fillStyle = grad
  g.fill()
  g.strokeStyle = '#1f8a45'
  g.lineWidth = 1.5
  g.stroke()
  // inner border
  g.strokeStyle = 'rgba(20,100,50,0.45)'
  g.lineWidth = 1
  g.strokeRect(4, 4, w - 8, h - 8)
  // fold creases
  g.strokeStyle = 'rgba(255,255,255,0.5)'
  g.beginPath()
  g.moveTo(w * 0.36, 0)
  g.lineTo(w * 0.42, h)
  g.moveTo(w * 0.7, 0)
  g.lineTo(w * 0.64, h)
  g.stroke()
  // portrait oval
  g.fillStyle = 'rgba(20,110,55,0.35)'
  g.beginPath()
  g.ellipse(w / 2, h / 2, 8, 10, 0, 0, Math.PI * 2)
  g.fill()
  g.font = `900 13px "Lilita One", system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#145c2f'
  g.fillText(String(value), 11, h / 2 + 1)
  g.fillText(String(value), w - 11, h / 2 + 1)
  g.fillStyle = '#e9fff0'
  g.font = `900 12px "Lilita One", system-ui, sans-serif`
  g.fillText('$', w / 2, h / 2 + 1)
  return c
}

/* ───────────────────────── world ───────────────────────── */

export interface JarCallbacks {
  onImpact?: (intensity: number) => void
  onOverflow?: () => void
}

export class JarWorld {
  engine = Engine.create({ enableSleeping: true })
  private table: Matter.Body
  private walls: Matter.Body[] = []
  private canvas: HTMLCanvasElement | null = null
  private raf = 0
  private win: Window | null = null
  private last = 0
  private acc = 0
  private coinSprites: HTMLCanvasElement[] = []
  private billSprites = new Map<string, HTMLCanvasElement>()
  private spriteScale = 0
  private pending: number[] = []
  private overflowed = false
  callbacks: JarCallbacks = {}

  constructor() {
    this.engine.gravity.y = 1.1
    const inside = { x: JAR.cx, y: 400 }
    const j = JAR
    this.walls = [
      // floor
      segmentWall(j.bodyL + 40, j.floorY, j.bodyR - 40, j.floorY, inside, 30),
      // rounded-ish bottom corners
      segmentWall(j.bodyL, j.cornerY, j.bodyL + 14, j.floorY - 22, inside),
      segmentWall(j.bodyL + 14, j.floorY - 22, j.bodyL + 42, j.floorY, inside),
      segmentWall(j.bodyR, j.cornerY, j.bodyR - 14, j.floorY - 22, inside),
      segmentWall(j.bodyR - 14, j.floorY - 22, j.bodyR - 42, j.floorY, inside),
      // body sides
      segmentWall(j.bodyL, j.shoulderY, j.bodyL, j.cornerY, inside),
      segmentWall(j.bodyR, j.shoulderY, j.bodyR, j.cornerY, inside),
      // shoulders
      segmentWall(j.bodyL, j.shoulderY, j.neckL, j.neckBottom, inside),
      segmentWall(j.bodyR, j.shoulderY, j.neckR, j.neckBottom, inside),
      // neck up to the lip
      segmentWall(j.neckL, j.neckBottom, j.neckL, j.rimY, inside, WALL + 6),
      segmentWall(j.neckR, j.neckBottom, j.neckR, j.rimY, inside, WALL + 6),
    ]
    this.table = Bodies.rectangle(SCENE.w / 2, j.tableY + 20, SCENE.w + 400, 40, {
      isStatic: true,
      friction: 0.6,
      restitution: 0.1,
    })
    Composite.add(this.engine.world, [...this.walls, this.table])

    Events.on(this.engine, 'collisionStart', (e) => {
      let best = 0
      for (const pair of e.pairs) {
        const a = pair.bodyA
        const b = pair.bodyB
        if (!(a as Token).plugin?.kind && !(b as Token).plugin?.kind) continue
        const dvx = a.velocity.x - b.velocity.x
        const dvy = a.velocity.y - b.velocity.y
        best = Math.max(best, Math.hypot(dvx, dvy))
      }
      if (best > 2.2) this.callbacks.onImpact?.(Math.min(1, (best - 2) / 9))
    })
  }

  /** Attach to a canvas (re-attachable, e.g. when moving into a pop-out window). */
  attach(canvas: HTMLCanvasElement) {
    this.detach()
    this.canvas = canvas
    this.win = canvas.ownerDocument.defaultView
    this.last = 0
    const loop = (t: number) => {
      this.frame(t)
      this.raf = this.win!.requestAnimationFrame(loop)
    }
    this.raf = this.win!.requestAnimationFrame(loop)
  }

  detach() {
    if (this.win && this.raf) this.win.cancelAnimationFrame(this.raf)
    this.raf = 0
    this.canvas = null
  }

  get tokenCount() {
    return this.tokens().length
  }

  private tokens(): Token[] {
    return Composite.allBodies(this.engine.world).filter((b) => (b as Token).plugin?.kind) as Token[]
  }

  drop({ value, spread = 0, delay = 0 }: DropOptions) {
    const spawn = () => {
      const kind: Kind = value >= 2 ? 'bill' : 'coin'
      const x = JAR.cx + spread * 50 + (Math.random() - 0.5) * 40
      const y = -40 - Math.random() * 30
      const common = {
        restitution: kind === 'coin' ? 0.32 : 0.12,
        friction: kind === 'coin' ? 0.12 : 0.5,
        frictionAir: kind === 'coin' ? 0.004 : 0.03,
        density: kind === 'coin' ? 0.004 : 0.0015,
        sleepThreshold: 50,
      }
      const body = (
        kind === 'coin'
          ? Bodies.circle(x, y, COIN_R, common)
          : Bodies.rectangle(x, y, BILL_W - 4, BILL_H - 6, { ...common, chamfer: { radius: 6 } })
      ) as Token
      body.plugin = { kind, value, sprite: Math.floor(Math.random() * 1000), born: performance.now() }
      Body.setAngle(body, Math.random() * Math.PI * 2)
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4)
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 2 - spread, y: 2 + Math.random() * 2 })
      Composite.add(this.engine.world, body)
      this.trim()
    }
    if (delay > 0) this.pending.push(window.setTimeout(spawn, delay))
    else spawn()
  }

  /** Keep the simulation light: drop the oldest coins lying on the table. */
  private trim() {
    const all = this.tokens()
    if (all.length < 420) return
    const outside = all
      .filter((b) => b.position.x < JAR.bodyL - 10 || b.position.x > JAR.bodyR + 10)
      .sort((a, b) => a.plugin.born - b.plugin.born)
    outside.slice(0, all.length - 400).forEach((b) => Composite.remove(this.engine.world, b))
  }

  /** Random kicks, for shaking. */
  shake(strength = 1) {
    for (const b of this.tokens()) {
      Sleeping.set(b, false)
      Body.setVelocity(b, {
        x: b.velocity.x + (Math.random() - 0.5) * 8 * strength,
        y: b.velocity.y - Math.random() * 7 * strength,
      })
      Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.5)
    }
  }

  /**
   * The jar's container is rotated on screen by `deg` (clockwise);
   * rotate gravity the other way so coins fall towards real "down".
   */
  setTilt(deg: number) {
    const r = (deg * Math.PI) / 180
    this.engine.gravity.x = Math.sin(r) * 1.1
    this.engine.gravity.y = Math.cos(r) * 1.1
    if (Math.abs(deg) > 2) {
      if (this.table.collisionFilter.mask !== 0) {
        this.table.collisionFilter.mask = 0 // the table doesn't tilt with the jar
      }
      for (const b of this.tokens()) Sleeping.set(b, false)
    } else {
      this.table.collisionFilter.mask = 0xffffffff
    }
  }

  clear() {
    this.pending.forEach((t) => clearTimeout(t))
    this.pending = []
    for (const b of this.tokens()) Composite.remove(this.engine.world, b)
    this.overflowed = false
  }

  /** 0..1, roughly how full the jar body is. */
  fillLevel(): number {
    const inJar = this.tokens().filter(
      (b) => b.position.x > JAR.bodyL && b.position.x < JAR.bodyR && b.position.y > JAR.rimY && b.speed < 1,
    )
    if (!inJar.length) return 0
    const top = Math.min(...inJar.map((b) => b.position.y - COIN_R))
    return Math.max(0, Math.min(1, (JAR.floorY - top) / (JAR.floorY - JAR.rimY)))
  }

  private ensureSprites(scale: number) {
    if (Math.abs(scale - this.spriteScale) < 0.05 && this.coinSprites.length) return
    this.spriteScale = scale
    this.coinSprites = COIN_TINTS.map((t) => makeCoinSprite(t, scale))
    this.billSprites.clear()
  }

  private billSprite(value: number, seed: number) {
    const key = `${value}:${seed % 4}`
    let s = this.billSprites.get(key)
    if (!s) {
      s = makeBillSprite(value, this.spriteScale, (seed % 4) * 977 + 13)
      this.billSprites.set(key, s)
    }
    return s
  }

  private frame(t: number) {
    const canvas = this.canvas
    if (!canvas) return
    const dt = this.last ? Math.min(50, t - this.last) : 16
    this.last = t
    this.acc += dt
    const step = 1000 / 120
    while (this.acc >= step) {
      Engine.update(this.engine, step)
      this.acc -= step
    }

    // cull anything that fell off the world, detect overflow
    for (const b of this.tokens()) {
      const p = b.position
      if (p.y > SCENE.h + 150 || p.y < -400 || p.x < -150 || p.x > SCENE.w + 150) {
        Composite.remove(this.engine.world, b)
      } else if (!this.overflowed && p.y > JAR.shoulderY && (p.x < JAR.bodyL - 14 || p.x > JAR.bodyR + 14) && this.engine.gravity.y > 1) {
        this.overflowed = true
        this.callbacks.onOverflow?.()
      }
    }

    // draw
    const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1
    const cssW = canvas.clientWidth || SCENE.w
    const scale = (cssW / SCENE.w) * dpr
    const pw = Math.round(SCENE.w * scale)
    const ph = Math.round(SCENE.h * scale)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    this.ensureSprites(scale)
    const g = canvas.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, pw, ph)
    g.setTransform(scale, 0, 0, scale, 0, 0)

    for (const b of this.tokens()) {
      const { kind, value, sprite } = b.plugin
      const img = kind === 'coin' ? this.coinSprites[sprite % this.coinSprites.length] : this.billSprite(value, sprite)
      const w = img.width / scale
      const h = img.height / scale
      g.save()
      g.translate(b.position.x, b.position.y)
      g.rotate(b.angle)
      g.drawImage(img, -w / 2, -h / 2, w, h)
      g.restore()
    }
  }
}
