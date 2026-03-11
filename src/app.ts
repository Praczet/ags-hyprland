import app from "ags/gtk4/app"
import style from "./style.css"
import matugenCss from "../shared/styles/matugen.css"

import clipCss from "../packages/clipboard/src/styles.css"
import { ClipboardWindow, refreshClipboard } from "../packages/clipboard/src"

import pmCss from "../packages/powermenu/src/styles.css"
import { PowerMenuWindows } from "../packages/powermenu/src"

import { ExposeWindow, css as exposeCss } from "../packages/expose/src"
import { OSDWindow, initOSD, css as osdCss } from "../packages/osd/src"
import { osdHandleRequest } from "./osdHandleRequest"
import { exposeHandleRequest } from "./exposeHandleRequest"
import { Upcheck, css as upcheckCss } from "../packages/upcheck/src/"
import { DashboardWindow, css as dashboardCss } from "../packages/dashboard/src"
import { dashboardHandleRequest } from "./dashboardHandleRequest"
import { AegisWindow, css as aegisCss } from "../packages/aegis/src"
import { aegisHandleRequest } from "./aegisHandleRequest"
import { networkHandleRequest } from "./networkHandleRequest"
import { NetworkWindow, css as networkCss } from "../packages/a-network/src"


async function handleRequest(argv: string[]) {
  const aegis = await aegisHandleRequest(argv)
  if (aegis !== undefined) return aegis
  const network = await networkHandleRequest(argv)
  if (network !== undefined) return network
  const dash = await dashboardHandleRequest(argv)
  if (dash !== undefined) return dash
  const result = await exposeHandleRequest(argv)
  if (result !== undefined) return result
  return osdHandleRequest(argv)
}


app.start({
  instanceName: "adart",
  css: style + matugenCss + clipCss + pmCss + exposeCss + osdCss + upcheckCss + dashboardCss + aegisCss + networkCss,
  requestHandler(argv, respond) {
    handleRequest(argv)
      .then(respond)
      .catch(err => respond(`error: ${err}`))
  },
  main() {
    initOSD()

    const clipWin = ClipboardWindow(0)
    app.add_window(clipWin)

    const { main: powerWin, confirm: powerConfirmWin } = PowerMenuWindows(0)
    app.add_window(powerWin)
    app.add_window(powerConfirmWin)

    const exposeWin = ExposeWindow(0)
    app.add_window(exposeWin)

    const osdWin = OSDWindow(0)
    app.add_window(osdWin)

    const upcheckWin = Upcheck(0)
    app.add_window(upcheckWin)

    const dashboardWin = DashboardWindow(0)
    app.add_window(dashboardWin)

    const aegisWin = AegisWindow(0)
    app.add_window(aegisWin)

    const networkWin = NetworkWindow(0, {
      showPlainTextPassword: true, showQRPassword: true
    })
    app.add_window(networkWin)

      ; (globalThis as any).toggleClipboard = () =>
        clipWin.visible ? clipWin.hide() : (refreshClipboard(), clipWin.show())
      ; (globalThis as any).togglePowerMenu = () => powerWin.visible ? powerWin.hide() : powerWin.present()

    // app.get_monitors().map(Bar)
  },
})
