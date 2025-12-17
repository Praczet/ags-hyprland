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



app.start({
  instanceName: "adart",
  css: style + matugenCss + clipCss + pmCss + exposeCss + osdCss,
  requestHandler(argv, respond) {
    osdHandleRequest(argv)
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

      ; (globalThis as any).toggleClipboard = () =>
        clipWin.visible ? clipWin.hide() : (refreshClipboard(), clipWin.show())
      ; (globalThis as any).togglePowerMenu = () => powerWin.visible ? powerWin.hide() : powerWin.present()
      ; (globalThis as any).toggleExpose = () => {
        const w = app.get_window("expose") as any
        if (!w) return
        w.visible ? (w.hideExpose?.() ?? w.hide()) : (w.showExpose?.())
      }

    // app.get_monitors().map(Bar)
  },
})
