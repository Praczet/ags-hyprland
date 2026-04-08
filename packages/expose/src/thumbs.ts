import GLib from "gi://GLib"
import { execAsync } from "ags/process"

const REPO_DIR = GLib.getenv("AGS_REPO_DIR") || `${GLib.get_home_dir()}/Development/Hyprland/ags`
const PKG_DIR = `${REPO_DIR}/packages/expose`
const THUMB_SCRIPT = `${PKG_DIR}/scripts/thumb-one.sh`

export function thumbPath(address: string) {
  return `/tmp/ags-expose-${address}.png`
}

export async function captureThumb(address: string): Promise<string | null> {
  const out = thumbPath(address)
  try {
    await execAsync([THUMB_SCRIPT, address, out])
    return out
  } catch {
    return null
  }
}
