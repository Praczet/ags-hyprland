import app from "ags/gtk4/app"

function toggleExpose() {
  const w = app.get_window("expose") as any
  if (!w) return
  w.visible ? (w.hideExpose?.() ?? w.hide()) : (w.showExpose?.())
}

export async function exposeHandleRequest(argv: string[]) {
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
