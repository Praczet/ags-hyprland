import { execAsync } from "ags/process"

export async function getActiveMonitor(): Promise<number> {
  try {
    const raw = await execAsync(["hyprctl", "-j", "activeworkspace"])
    const parsed = JSON.parse(raw)
    if (typeof parsed?.monitorID === "number") return parsed.monitorID
  } catch (error) {
    console.error("getActiveMonitor error", error)
  }
  return 0
}
