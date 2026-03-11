import { execAsync } from "ags/process"

const CMD = ["brightnessctl", "-m"]

export function parseBrightness(output: string): number | null {
  const parts = output.trim().split(",")
  const percentPart = parts[4] ?? parts[3] ?? ""
  const match = percentPart.match(/([0-9]+)%/)
  if (!match) return null
  const percent = parseInt(match[1], 10)
  return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null
}

export async function readBrightnessPercent(): Promise<number | null> {
  try {
    const output = await execAsync(CMD)
    return parseBrightness(output)
  } catch (error) {
    console.error("OSD readBrightnessPercent error", error)
    return null
  }
}
