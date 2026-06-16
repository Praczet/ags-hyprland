import { toggleAppWindow } from "./windowControl"
import type { RequestResponse } from "./windowTypes"
import { WINDOW_NAME } from "./windowTypes"

export async function upcheckHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd] = argv
  if (!cmd) return undefined

  switch (cmd.toLowerCase()) {
    case "upcheck":
    case "updates":
    case "toggleupcheck":
    case "upchecktoggle": {
      toggleAppWindow(WINDOW_NAME.upcheck)
      return "ok"
    }

    default:
      return undefined
  }
}
