import { logProcessError, runCommand } from "../../../../shared/utils/process"

export async function getActiveMonitor(): Promise<number> {
  try {
    const raw = await runCommand(["hyprctl", "-j", "activeworkspace"])
    const parsed = JSON.parse(raw)
    if (typeof parsed?.monitorID === "number") return parsed.monitorID
  } catch (error) {
    logProcessError("getActiveMonitor error", error)
  }
  return 0
}
