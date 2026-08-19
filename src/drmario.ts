export const COLS = 8
export const ROWS = 16
export const VIRUS_GOAL = 4

export type Color = 0 | 1 | 2
export type Dir = 'n' | 'e' | 's' | 'w'
export type GameStatus = 'playing' | 'won' | 'lost'
export type Input = 'left' | 'right' | 'down' | 'up' | 'rot' | 'rotccw' | 'drop'

export type Cell =
  | { kind: 'empty' }
  | { kind: 'virus'; color: Color }
  | { kind: 'pill'; color: Color; link: Dir | null }

export type Hud = {
  virusesLeft: number
  virusesCleared: number
  score: number
  status: GameStatus
  next: [Color, Color]
}

export type Sfx = {
  move: () => void
  rotate: () => void
  land: () => void
  clear: () => void
  virus: () => void
  lose: () => void
  win: () => void
}

type Piece = {
  r: number
  c: number
  rot: 0 | 1 | 2 | 3
  a: Color
  b: Color
}

type Half = { r: number; c: number; color: Color }

export type Game = {
  grid: Cell[][]
  piece: Piece | null
  next: [Color, Color]
  status: GameStatus
  score: number
  virusesCleared: number
  fallMs: number
  acc: number
  soft: boolean
  das: number
  dasDir: 0 | -1 | 1
  hold: { left: boolean; right: boolean; down: boolean }
  tick: number
  combo: number
}

const EMPTY: Cell = { kind: 'empty' }
const COLORS: Color[] = [0, 1, 2]
const FALL_START = 920
const SOFT_MS = 55
const DAS_DELAY = 170
const DAS_REPEAT = 48

function emptyGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => EMPTY))
}

function randColor(): Color {
  return COLORS[Math.floor(Math.random() * 3)] ?? 0
}

function opposite(dir: Dir): Dir {
  if (dir === 'n') return 's'
  if (dir === 's') return 'n'
  if (dir === 'e') return 'w'
  return 'e'
}

function cellsOf(p: Piece): [Half, Half] {
  const off: [number, number] =
    p.rot === 0 ? [0, 1] : p.rot === 1 ? [-1, 0] : p.rot === 2 ? [0, -1] : [1, 0]
  return [
    { r: p.r, c: p.c, color: p.a },
    { r: p.r + off[0], c: p.c + off[1], color: p.b },
  ]
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

function open(grid: Cell[][], r: number, c: number): boolean {
  return inBounds(r, c) && grid[r]?.[c]?.kind === 'empty'
}

function valid(grid: Cell[][], p: Piece): boolean {
  return cellsOf(p).every((h) => open(grid, h.r, h.c))
}

function countViruses(grid: Cell[][]): number {
  let n = 0
  for (const row of grid) {
    for (const cell of row) {
      if (cell.kind === 'virus') n += 1
    }
  }
  return n
}

function placeViruses(grid: Cell[][]): void {
  const spots: [number, number][] = []
  for (let r = 7; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) spots.push([r, c])
  }
  for (let i = spots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = spots[i]
    const b = spots[j]
    if (a && b) {
      spots[i] = b
      spots[j] = a
    }
  }
  for (let i = 0; i < VIRUS_GOAL; i += 1) {
    const spot = spots[i]
    if (!spot) continue
    const [r, c] = spot
    const row = grid[r]
    if (!row) continue
    row[c] = { kind: 'virus', color: COLORS[i % 3] ?? 0 }
  }
}

function spawnPiece(next: [Color, Color]): Piece {
  return { r: 1, c: 3, rot: 0, a: next[0], b: next[1] }
}

function nextPair(): [Color, Color] {
  return [randColor(), randColor()]
}

function tryMove(game: Game, dr: number, dc: number): boolean {
  if (!game.piece || game.status !== 'playing') return false
  const moved: Piece = { ...game.piece, r: game.piece.r + dr, c: game.piece.c + dc }
  if (!valid(game.grid, moved)) return false
  game.piece = moved
  return true
}

function tryRotate(game: Game, dir: 1 | -1, sfx?: Sfx): boolean {
  if (!game.piece || game.status !== 'playing') return false
  const rot = ((((game.piece.rot + dir) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  const kicks: [number, number][] = [
    [0, 0],
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -2],
    [0, 2],
  ]
  for (const [dr, dc] of kicks) {
    const next: Piece = { ...game.piece, rot, r: game.piece.r + dr, c: game.piece.c + dc }
    if (valid(game.grid, next)) {
      game.piece = next
      sfx?.rotate()
      return true
    }
  }
  return false
}

function linkBetween(a: Half, b: Half): Dir {
  if (b.r < a.r) return 'n'
  if (b.r > a.r) return 's'
  if (b.c > a.c) return 'e'
  return 'w'
}

function lockPiece(game: Game, sfx?: Sfx): void {
  const piece = game.piece
  if (!piece) return
  const [h1, h2] = cellsOf(piece)
  const write = (h: Half, other: Half): void => {
    const row = game.grid[h.r]
    if (!row || !inBounds(h.r, h.c)) return
    row[h.c] = { kind: 'pill', color: h.color, link: linkBetween(h, other) }
  }
  write(h1, h2)
  write(h2, h1)
  game.piece = null
  sfx?.land()
  resolve(game, sfx)
  if (game.status !== 'playing') return
  const incoming = spawnPiece(game.next)
  game.next = nextPair()
  if (!valid(game.grid, incoming)) {
    game.status = 'lost'
    sfx?.lose()
    return
  }
  game.piece = incoming
}

function findMatches(grid: Cell[][]): { r: number; c: number }[] {
  const hits = new Set<string>()
  const mark = (r: number, c: number): void => {
    hits.add(`${r},${c}`)
  }
  const colorAt = (r: number, c: number): Color | null => {
    const cell = grid[r]?.[c]
    if (!cell || cell.kind === 'empty') return null
    return cell.color
  }

  for (let r = 0; r < ROWS; r += 1) {
    let run = 1
    for (let c = 1; c <= COLS; c += 1) {
      const prev = colorAt(r, c - 1)
      const cur = c < COLS ? colorAt(r, c) : null
      if (prev !== null && prev === cur) run += 1
      else {
        if (run >= 4 && prev !== null) {
          for (let i = 1; i <= run; i += 1) mark(r, c - i)
        }
        run = 1
      }
    }
  }

  for (let c = 0; c < COLS; c += 1) {
    let run = 1
    for (let r = 1; r <= ROWS; r += 1) {
      const prev = colorAt(r - 1, c)
      const cur = r < ROWS ? colorAt(r, c) : null
      if (prev !== null && prev === cur) run += 1
      else {
        if (run >= 4 && prev !== null) {
          for (let i = 1; i <= run; i += 1) mark(r - i, c)
        }
        run = 1
      }
    }
  }

  return [...hits].map((key) => {
    const [rs, cs] = key.split(',')
    return { r: Number(rs), c: Number(cs) }
  })
}

function unlinkPartner(grid: Cell[][], r: number, c: number, cell: Cell): void {
  if (cell.kind !== 'pill' || !cell.link) return
  const or = cell.link === 'n' ? r - 1 : cell.link === 's' ? r + 1 : r
  const oc = cell.link === 'e' ? c + 1 : cell.link === 'w' ? c - 1 : c
  const partner = grid[or]?.[oc]
  if (partner && partner.kind === 'pill' && partner.link === opposite(cell.link)) {
    partner.link = null
  }
}

function clearMatches(game: Game, matches: { r: number; c: number }[], sfx?: Sfx): void {
  let viruses = 0
  for (const { r, c } of matches) {
    const cell = game.grid[r]?.[c]
    if (!cell || cell.kind === 'empty') continue
    if (cell.kind === 'virus') viruses += 1
    unlinkPartner(game.grid, r, c, cell)
    const row = game.grid[r]
    if (row) row[c] = EMPTY
  }
  game.combo += 1
  game.score += matches.length * 10 * game.combo + viruses * 100 * game.combo
  if (viruses) {
    game.virusesCleared += viruses
    game.fallMs = Math.max(280, FALL_START - game.virusesCleared * 80)
    sfx?.virus()
  } else {
    sfx?.clear()
  }
}

function gravityOnce(grid: Cell[][]): boolean {
  const skip = new Set<string>()
  let moved = false
  const vacant = (r: number, c: number): boolean => open(grid, r, c)

  for (let r = ROWS - 2; r >= 0; r -= 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (skip.has(`${r},${c}`)) continue
      const cell = grid[r]?.[c]
      if (!cell || cell.kind !== 'pill') continue

      if (cell.link === 'e') {
        const right = grid[r]?.[c + 1]
        if (right && right.kind === 'pill' && right.link === 'w') {
          if (vacant(r + 1, c) && vacant(r + 1, c + 1)) {
            const rowBelow = grid[r + 1]
            const rowHere = grid[r]
            if (rowBelow && rowHere) {
              rowBelow[c] = cell
              rowBelow[c + 1] = right
              rowHere[c] = EMPTY
              rowHere[c + 1] = EMPTY
              skip.add(`${r + 1},${c}`)
              skip.add(`${r + 1},${c + 1}`)
              moved = true
            }
          }
          skip.add(`${r},${c + 1}`)
          continue
        }
      }

      if (cell.link === 'w') continue

      if (cell.link === 'n') {
        const up = r > 0 ? grid[r - 1]?.[c] : undefined
        if (up && up.kind === 'pill' && up.link === 's') {
          if (vacant(r + 1, c)) {
            const below = grid[r + 1]
            const here = grid[r]
            const above = grid[r - 1]
            if (below && here && above) {
              below[c] = cell
              here[c] = up
              above[c] = EMPTY
              skip.add(`${r + 1},${c}`)
              skip.add(`${r},${c}`)
              moved = true
            }
          }
          continue
        }
        cell.link = null
      }

      if (cell.link === 's') continue

      if (vacant(r + 1, c)) {
        const below = grid[r + 1]
        const here = grid[r]
        if (below && here) {
          below[c] = cell
          here[c] = EMPTY
          skip.add(`${r + 1},${c}`)
          moved = true
        }
      }
    }
  }
  return moved
}

function settle(grid: Cell[][]): void {
  let guard = 0
  while (gravityOnce(grid) && guard < ROWS * COLS) guard += 1
}

function resolve(game: Game, sfx?: Sfx): void {
  game.combo = 0
  let guard = 0
  while (guard < 48) {
    const matches = findMatches(game.grid)
    if (matches.length === 0) break
    clearMatches(game, matches, sfx)
    settle(game.grid)
    guard += 1
  }
  if (countViruses(game.grid) <= 0) {
    game.status = 'won'
    game.piece = null
    sfx?.win()
  }
}

export function newGame(): Game {
  const grid = emptyGrid()
  placeViruses(grid)
  const next = nextPair()
  const first = nextPair()
  return {
    grid,
    piece: spawnPiece(first),
    next,
    status: 'playing',
    score: 0,
    virusesCleared: 0,
    fallMs: FALL_START,
    acc: 0,
    soft: false,
    das: 0,
    dasDir: 0,
    hold: { left: false, right: false, down: false },
    tick: 0,
    combo: 0,
  }
}

export function hudOf(game: Game): Hud {
  return {
    virusesLeft: countViruses(game.grid),
    virusesCleared: game.virusesCleared,
    score: game.score,
    status: game.status,
    next: game.next,
  }
}

export function giveUp(game: Game, sfx?: Sfx): void {
  if (game.status !== 'playing') return
  game.status = 'lost'
  game.piece = null
  sfx?.lose()
}

export function press(game: Game, input: Input, sfx?: Sfx): void {
  if (game.status !== 'playing') return
  if (input === 'left') {
    if (tryMove(game, 0, -1)) sfx?.move()
    game.hold.left = true
    game.hold.right = false
    game.dasDir = -1
    game.das = 0
  } else if (input === 'right') {
    if (tryMove(game, 0, 1)) sfx?.move()
    game.hold.right = true
    game.hold.left = false
    game.dasDir = 1
    game.das = 0
  } else if (input === 'down') {
    game.soft = true
    game.hold.down = true
  } else if (input === 'rot' || input === 'up') {
    tryRotate(game, 1, sfx)
  } else if (input === 'rotccw') {
    tryRotate(game, -1, sfx)
  } else if (input === 'drop') {
    let n = 0
    while (tryMove(game, 1, 0)) n += 1
    if (n) game.score += n
    lockPiece(game, sfx)
  }
}

export function release(game: Game, input: Input): void {
  if (input === 'left') {
    game.hold.left = false
    if (game.dasDir === -1) game.dasDir = game.hold.right ? 1 : 0
  } else if (input === 'right') {
    game.hold.right = false
    if (game.dasDir === 1) game.dasDir = game.hold.left ? -1 : 0
  } else if (input === 'down') {
    game.soft = false
    game.hold.down = false
  }
}

export function tick(game: Game, dt: number, sfx?: Sfx): void {
  if (game.status !== 'playing' || !game.piece) return
  game.tick += dt

  if (game.dasDir !== 0) {
    game.das += dt
    if (game.das > DAS_DELAY) {
      const extra = game.das - DAS_DELAY
      const steps = Math.floor(extra / DAS_REPEAT)
      if (steps > 0) {
        game.das = DAS_DELAY + (extra % DAS_REPEAT)
        for (let i = 0; i < steps; i += 1) tryMove(game, 0, game.dasDir)
      }
    }
  }

  const interval = game.soft || game.hold.down ? SOFT_MS : game.fallMs
  game.acc += dt
  while (game.acc >= interval && game.status === 'playing' && game.piece) {
    game.acc -= interval
    if (!tryMove(game, 1, 0)) lockPiece(game, sfx)
    else if (game.soft) game.score += 1
  }
}

const CELL = 10
const PAD = 8
const NES = {
  black: '#000010',
  bottle: '#d0d0d0',
  bottleDark: '#6a6a6a',
  bottleLite: '#fff',
  red: ['#f83810', '#a80020', '#f8d878'] as const,
  yellow: ['#f8d800', '#c87800', '#fff8c8'] as const,
  blue: ['#3898f8', '#0038c8', '#d0f0ff'] as const,
}

function pal(color: Color): readonly [string, string, string] {
  if (color === 0) return NES.red
  if (color === 1) return NES.yellow
  return NES.blue
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = 1): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, s, s)
}

function drawVirus(ctx: CanvasRenderingContext2D, x: number, y: number, color: Color, frame: number): void {
  const [mid, dark, lite] = pal(color)
  const f = frame % 2
  const body = [
    '00111100',
    '01111110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00100100',
  ]
  for (let row = 0; row < 8; row += 1) {
    const line = body[row] ?? ''
    for (let col = 0; col < 8; col += 1) {
      if (line[col] !== '1') continue
      px(ctx, x + 1 + col, y + 1 + row, mid)
    }
  }
  px(ctx, x + 2, y + 2, dark)
  px(ctx, x + 9, y + 2, dark)
  px(ctx, x + 3, y + 4, lite)
  px(ctx, x + 4, y + 5, dark)
  px(ctx, x + 7, y + 4, lite)
  px(ctx, x + 8, y + 5, dark)
  if (f === 0) {
    px(ctx, x + 4, y + 7, dark)
    px(ctx, x + 5, y + 7, dark)
    px(ctx, x + 6, y + 7, dark)
    px(ctx, x + 7, y + 7, dark)
  } else {
    px(ctx, x + 3, y + 7, dark)
    px(ctx, x + 8, y + 7, dark)
    px(ctx, x + 4, y + 8, dark)
    px(ctx, x + 7, y + 8, dark)
  }
}

function drawHalf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: Color,
  cap: 'block' | 'left' | 'right' | 'top' | 'bottom',
): void {
  const [mid, dark, lite] = pal(color)
  ctx.fillStyle = dark
  ctx.fillRect(x, y, CELL, CELL)
  ctx.fillStyle = mid
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
  ctx.fillStyle = lite
  ctx.fillRect(x + 2, y + 2, 3, 2)
  if (cap === 'left') {
    ctx.fillStyle = NES.black
    ctx.fillRect(x, y, 1, 1)
    ctx.fillRect(x, y + CELL - 1, 1, 1)
    ctx.fillStyle = mid
    ctx.fillRect(x + CELL - 1, y + 1, 1, CELL - 2)
  } else if (cap === 'right') {
    ctx.fillStyle = NES.black
    ctx.fillRect(x + CELL - 1, y, 1, 1)
    ctx.fillRect(x + CELL - 1, y + CELL - 1, 1, 1)
    ctx.fillStyle = mid
    ctx.fillRect(x, y + 1, 1, CELL - 2)
  } else if (cap === 'top') {
    ctx.fillStyle = NES.black
    ctx.fillRect(x, y, 1, 1)
    ctx.fillRect(x + CELL - 1, y, 1, 1)
    ctx.fillStyle = mid
    ctx.fillRect(x + 1, y + CELL - 1, CELL - 2, 1)
  } else if (cap === 'bottom') {
    ctx.fillStyle = NES.black
    ctx.fillRect(x, y + CELL - 1, 1, 1)
    ctx.fillRect(x + CELL - 1, y + CELL - 1, 1, 1)
    ctx.fillStyle = mid
    ctx.fillRect(x + 1, y, CELL - 2, 1)
  }
}

function capFor(link: Dir | null): 'block' | 'left' | 'right' | 'top' | 'bottom' {
  if (link === 'e') return 'left'
  if (link === 'w') return 'right'
  if (link === 's') return 'top'
  if (link === 'n') return 'bottom'
  return 'block'
}

function drawBottle(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  const w = COLS * CELL + PAD * 2
  const h = ROWS * CELL + PAD * 2
  ctx.fillStyle = NES.bottleDark
  ctx.fillRect(ox, oy, w, h)
  ctx.fillStyle = NES.bottleLite
  ctx.fillRect(ox, oy, w - 1, 1)
  ctx.fillRect(ox, oy, 1, h - 1)
  ctx.fillStyle = NES.bottle
  ctx.fillRect(ox + 2, oy + 2, w - 4, h - 4)
  ctx.fillStyle = NES.black
  ctx.fillRect(ox + PAD - 1, oy + PAD - 1, COLS * CELL + 2, ROWS * CELL + 2)
  ctx.fillStyle = '#081018'
  ctx.fillRect(ox + PAD, oy + PAD, COLS * CELL, ROWS * CELL)
  ctx.fillStyle = NES.bottle
  ctx.fillRect(ox + w / 2 - 10, oy - 8, 20, 10)
  ctx.fillStyle = NES.black
  ctx.fillRect(ox + w / 2 - 8, oy - 6, 16, 6)
}

export function fitScale(maxW: number, maxH: number): number {
  const rawW = COLS * CELL + PAD * 2
  const rawH = ROWS * CELL + PAD * 2 + 10
  const s = Math.min(Math.floor(maxW / rawW), Math.floor(maxH / rawH))
  return Math.max(2, Math.min(4, s))
}

export function drawGame(game: Game, canvas: HTMLCanvasElement, scale: number): void {
  const rawW = COLS * CELL + PAD * 2
  const rawH = ROWS * CELL + PAD * 2 + 10
  const w = rawW * scale
  const h = rawH * scale
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = '#101018'
  ctx.fillRect(0, 0, rawW, rawH)
  const ox = 0
  const oy = 10
  drawBottle(ctx, ox, oy)

  const frame = Math.floor(game.tick / 280) % 2
  const originX = ox + PAD
  const originY = oy + PAD

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = game.grid[r]?.[c]
      if (!cell || cell.kind === 'empty') continue
      const x = originX + c * CELL
      const y = originY + r * CELL
      if (cell.kind === 'virus') drawVirus(ctx, x, y, cell.color, frame)
      else drawHalf(ctx, x, y, cell.color, capFor(cell.link))
    }
  }

  if (game.piece) {
    const [h1, h2] = cellsOf(game.piece)
    const link1 = linkBetween(h1, h2)
    const link2 = linkBetween(h2, h1)
    drawHalf(ctx, originX + h1.c * CELL, originY + h1.r * CELL, h1.color, capFor(link1))
    drawHalf(ctx, originX + h2.c * CELL, originY + h2.r * CELL, h2.color, capFor(link2))
  }

  ctx.fillStyle = 'rgba(180, 255, 180, 0.04)'
  for (let y = 0; y < rawH; y += 2) ctx.fillRect(0, y, rawW, 1)
}

export function drawNext(next: [Color, Color], canvas: HTMLCanvasElement): void {
  const scale = 3
  canvas.width = 28 * scale
  canvas.height = 14 * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 28, 14)
  drawHalf(ctx, 4, 2, next[0], 'left')
  drawHalf(ctx, 14, 2, next[1], 'right')
}

function selfTest(): void {
  const grid = emptyGrid()
  const row = grid[10]
  if (!row) throw new Error('grid')
  for (let c = 0; c < 4; c += 1) row[c] = { kind: 'pill', color: 0, link: null }
  if (findMatches(grid).length !== 4) throw new Error('Dr. Boger match test failed')
}

selfTest()
