import { showBloom, doneBloom, hideBloom, maybeRecoverBloom } from "../packages/bloom/src"
import type { RequestResponse } from "./windowTypes"

export function bloomHandleRequest(argv: string[]): RequestResponse {
  const [cmd, ...rest] = argv
  switch (cmd?.toLowerCase()) {
    case "bloom-show": {
      const profile = rest[0]
      if (!profile) return "usage: bloom-show <profile> [--wallpaper <path>]"
      const wpIdx = rest.indexOf("--wallpaper")
      const wallpaper = wpIdx !== -1 ? rest[wpIdx + 1] : undefined
      showBloom(profile, wallpaper)
      return "ok"
    }
    case "bloom-done":
      doneBloom()
      return "ok"
    case "bloom-hide":
      hideBloom()
      return "ok"
    case "bloom-pickup":
      maybeRecoverBloom()
      return "ok"
    default:
      return undefined
  }
}
