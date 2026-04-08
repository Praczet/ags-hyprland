import { toggleAppWindow } from "./windowControl"
import { type ExposeAppWindow, type RequestResponse, WINDOW_NAME } from "./windowTypes"

function toggleExpose() {
  toggleAppWindow<ExposeAppWindow>(WINDOW_NAME.expose)
}

export async function exposeHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "toggleexpose":
    case "exposetoggle": {
      toggleExpose()
      return "ok"
    }
  }
  return undefined
}
