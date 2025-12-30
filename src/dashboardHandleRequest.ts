import app from "ags/gtk4/app"

function toggleDashboard() {
  const w = app.get_window("dashboard") as any
  if (!w) return
  w.visible ? (w.hideDashboard?.() ?? w.hide()) : (w.showDashboard?.())
}

export async function dashboardHandleRequest(argv: string[]) {
  const [cmd] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "toggledashboard":
    case "dashboardtoggle": {
      toggleDashboard()
      return "ok"
    }
  }
  return undefined
}
