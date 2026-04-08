import { createState } from "ags"
import { getUpdates } from "./services/pacman"

export const [updates, setUpdates] = createState<UpItem[]>([])
export const [selected, setSelected] = createState<UpItem | null>(null)
export const [details, setDetails] = createState<PkgDetails | null>(null)
export const [loading, setLoading] = createState(false)
export const [err, setErr] = createState<string | null>(null)
export const [detailsView, setDetailsView] = createState("empty")

export const cache = new Map<string, PkgDetails>()

function toErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const withMessage = error as { stderr?: unknown; message?: unknown }
    return String(withMessage.stderr ?? withMessage.message ?? error)
  }
  return String(error)
}

export async function refreshUpdates() {
  setErr(null)
  setLoading(true)
  setDetailsView("loading")
  try {
    const list = await getUpdates()
    setUpdates(list)
    setDetailsView(list.length === 0 ? "nodata" : "empty")
  } catch (error: unknown) {
    setErr(toErrorMessage(error))
    setUpdates([])
  } finally {
    setLoading(false)
  }
}

export function shellQuote(s: string) {
  return `'${s.replaceAll("'", `'\\''`)}'`
}
