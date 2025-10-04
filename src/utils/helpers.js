// Time Log utility functions
import { FUZZY_SCORE } from './constants'

export function nowISO() {
  return new Date().toISOString()
}

export function toLocalHM(iso) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function sameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && 
         da.getMonth() === db.getMonth() && 
         da.getDate() === db.getDate()
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function startOfWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day // back to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfWeekMonday(date) {
  const start = startOfWeekMonday(date)
  const d = new Date(start)
  d.setDate(start.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export function startOfMonth(date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfMonth(date) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

// Simple fuzzy score: higher is better
export function fuzzyScore(input, target) {
  if (!input || !target) return 0
  const a = input.toLowerCase().trim()
  const b = target.toLowerCase().trim()
  if (a === b) return FUZZY_SCORE.EXACT_MATCH

  let score = b.includes(a)
    ? Math.min(
        FUZZY_SCORE.SUBSTRING_MATCH_BASE,
        Math.floor((a.length / b.length) * FUZZY_SCORE.SUBSTRING_MATCH_BASE + FUZZY_SCORE.SUBSTRING_BONUS)
      )
    : 0

  const at = new Set(a.split(/[^a-z0-9]+/g).filter(Boolean))
  const bt = new Set(b.split(/[^a-z0-9]+/g).filter(Boolean))
  let overlap = 0
  for (const t of at) if (bt.has(t)) overlap++

  score += overlap * FUZZY_SCORE.TOKEN_OVERLAP_MULTIPLIER
  if (b.startsWith(a)) score += FUZZY_SCORE.PREFIX_MATCH_BONUS

  return Math.min(score, FUZZY_SCORE.EXACT_MATCH)
}

export function humanHM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}
