// store.ts
import { createState } from "ags"
import { getUpdates } from "./services/pacman"


export const [updates, setUpdates] = createState<UpItem[]>([])
export const [selected, setSelected] = createState<UpItem | null>(null)
export const [details, setDetails] = createState<PkgDetails | null>(null)
export const [loading, setLoading] = createState(false)
export const [err, setErr] = createState<string | null>(null)
export const [detailsView, setDetailsView] = createState("empty")

export const cache = new Map<string, PkgDetails>()



export async function refreshUpdates() {
  setErr(null);
  setLoading(true);
  try {
    const list = await getUpdates();
    setUpdates(list);
  } catch (e: any) {
    const msg = String(e?.stderr ?? e?.message ?? e);
    setErr(msg);
    setUpdates([]); // optional: keep old list instead if you prefer
  } finally {
    setLoading(false);
  }
}

export function shellQuote(s: string) {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}


