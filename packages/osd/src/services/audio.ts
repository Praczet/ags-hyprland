import { execAsync } from "ags/process"

export type ParsedLevel = {
  value: number | null
  muted: boolean
}

export type ParsedStatus = {
  sink: ParsedLevel | null
  source: ParsedLevel | null
}

const STATUS_CMD = ["wpctl", "status"]

function clampPercent(percent: number) {
  if (!Number.isFinite(percent)) return null
  return Math.max(0, Math.min(150, Math.round(percent)))
}

function parseLine(line: string): ParsedLevel | null {
  const match = line.match(/\[vol:\s*([0-9]+(?:\.[0-9]+)?)\s*(MUTED)?/i)
  if (!match) return null
  const value = clampPercent(parseFloat(match[1]) * 100)
  const muted = Boolean(match[2])
  return { value, muted }
}

export function parseStatus(output: string): ParsedStatus {
  let section: "none" | "sinks" | "sources" = "none"
  let sink: ParsedLevel | null = null
  let source: ParsedLevel | null = null

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (line.includes("Sinks:")) {
      section = "sinks"
      continue
    }
    if (line.includes("Sources:")) {
      section = "sources"
      continue
    }

    if (!line.includes("[vol:")) continue

    const isDefault = line.includes("*")
    if (!isDefault) continue

    const parsed = parseLine(line)
    if (!parsed) continue

    if (section === "sinks" && !sink) sink = parsed
    if (section === "sources" && !source) source = parsed
  }

  return { sink, source }
}

export async function readAudioStatus(): Promise<ParsedStatus> {
  try {
    const output = await execAsync(STATUS_CMD)
    return parseStatus(output)
  } catch (error) {
    console.error("OSD readAudioStatus error", error)
    return { sink: null, source: null }
  }
}

export async function readDefaultSink(): Promise<ParsedLevel | null> {
  const status = await readAudioStatus()
  return status.sink
}

export async function readDefaultSource(): Promise<ParsedLevel | null> {
  const status = await readAudioStatus()
  return status.source
}
