import type { LyricLine } from "../types"

export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  const timePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  for (const rawLine of text.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(timePattern)]
    if (matches.length === 0) continue

    const lyricText = rawLine.replace(timePattern, "").trim()
    for (const match of matches) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const fractionRaw = match[3] ?? "0"
      const fraction = Number(fractionRaw.padEnd(3, "0").slice(0, 3)) / 1000
      const time = minutes * 60 + seconds + fraction
      lines.push({ time, text: lyricText })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

export function findActiveLine(lines: LyricLine[], position: number): number {
  if (lines.length === 0) return -1

  let active = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].time > position + 0.15) break
    active = i
  }

  return active
}
