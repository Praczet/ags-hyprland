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


async function handleRequest(argv: string[]) {
  const result = await exposeHandleRequest(argv)
  if (result !== undefined) return result
  return osdHandleRequest(argv)
}


app.start({
  instanceName: "adart",
  css: style + matugenCss + clipCss + pmCss + exposeCss + osdCss + upcheckCss,
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

      ; (globalThis as any).toggleClipboard = () =>
        clipWin.visible ? clipWin.hide() : (refreshClipboard(), clipWin.show())
      ; (globalThis as any).togglePowerMenu = () => powerWin.visible ? powerWin.hide() : powerWin.present()

    // app.get_monitors().map(Bar)
  },
})
