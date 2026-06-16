import type { RequestResponse } from "./windowTypes"

type PowerMenuActions = typeof globalThis & {
  togglePowerMenu?: () => void
}

export async function powermenuHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd] = argv
  if (!cmd) return undefined

  switch (cmd.toLowerCase()) {
    case "togglepowermenu":
    case "powermenutoggle":
    case "powermenu":
    case "power":
      ; (globalThis as PowerMenuActions).togglePowerMenu?.()
      return "ok"
  }

  return undefined
}
