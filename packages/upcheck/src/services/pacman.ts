import { cache, setDetails, setDetailsView, setErr, setLoading, setSelected, shellQuote } from "../store"
import { logProcessError, runCommand, runShell, toErrorMessage } from "../../../../shared/utils/process"

let reqId = 0

function sh(cmd: string): Promise<string> {
  // NOTE: checkupdates returns exit code 2 when there are no updates
  // so we handle that in the caller.
  return runShell(cmd)
}

function parseUpdates(out: string): UpItem[] {
  return out
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [name, oldVer, newVer] = line.split(/\s+/)
      if (!name || !oldVer || !newVer) return null
      return { name, oldVer, newVer }
    })
    .filter((x): x is UpItem => x !== null)
}

export async function getUpdates(): Promise<UpItem[]> {
  // Your formatting: "name old new"
  const cmd =
    "checkupdates --nocolor | sed -E 's/^(\\S+)\\s+(\\S+)\\s+->\\s+(\\S+)$/\\1 \\2 \\3/'"

  try {
    const out = await sh(cmd)
    return parseUpdates(out)
  } catch (error: unknown) {
    const msg = toErrorMessage(error)
    if (
      /exit status 2|status 2|code 2/i.test(msg) ||
      /there are no updates available/i.test(msg)
    ) {
      return []
    }

    throw error
  }
}

function parsePacquery(out: string): PkgDetails {
  try {
    const json = JSON.parse(out)
    const pkg = Array.isArray(json) ? json[0] : json

    return {
      name: pkg.name ?? "",
      repo: pkg.repository,
      version: pkg.version,
      desc: pkg.description,
      url: pkg.url,
      arch: pkg.architecture,
      depends: Array.isArray(pkg["depends"])
        ? pkg["depends"]
        : pkg["depends"]?.split(/\s+/).filter(Boolean),
      optdepends: pkg["optdepends"],
      requiredby: pkg["required_by"],

      raw: out,
    }
  } catch (e) {
    console.error("upcheck pacquery parse error", e)
    throw e
  }
}

function parsePacmanSi(out: string): PkgDetails {
  const lines = out.split("\n")
  const get = (key: string) => {
    const line = lines.find(l => l.startsWith(key + " : "))
    return line ? line.slice((key + " : ").length).trim() : undefined
  }

  return {
    name: get("Name") ?? "",
    repo: get("Repository"),
    version: get("Version"),
    desc: get("Description"),
    url: get("URL"),
    arch: get("Architecture"),
    depends: get("Depends On")?.split(/\s+/).filter(Boolean),
    optdepends: get("Optional Deps") ? [get("Optional Deps")!] : undefined,
    raw: out,
  }
}

/**
 * @deprecated Use selectItem instead
 */
export async function selectItemPacman(item: UpItem) {
  setSelected(item)
  setErr(null)

  const key = item.name
  if (cache.has(key)) {
    setDetails(cache.get(key)!)
    setLoading(false)
    return
  }

  setLoading(true)
  setDetails(null)
  const my = ++reqId
  try {
    const out = await runShell(`pacman -Si ${shellQuote(key)}`)
    const d = parsePacmanSi(out)
    cache.set(key, d)

    if (my === reqId) setDetails(d)
  } catch (error: unknown) {
    if (my === reqId) setErr(toErrorMessage(error))
  } finally {
    if (my === reqId) setLoading(false)
  }
}

export async function selectItem(item: UpItem) {
  setErr(null)
  setSelected(item)

  const key = item.name

  if (cache.has(key)) {
    setDetails(cache.get(key)!)
    setDetailsView("details")
    setLoading(false)
    return
  }

  setLoading(true)
  setDetails(null)
  setDetailsView("loading")

  const my = ++reqId
  try {
    const out = await runCommand(["pacquery", key])
    const d = parsePacquery(out)

    if (my === reqId) {
      cache.set(key, d)
      setDetails(d)
      setDetailsView("details")
      setLoading(false)
    }
  } catch (error: unknown) {
    if (my === reqId) {
      setErr(toErrorMessage(error))
      setLoading(false)
    }
  }
}
export async function openUpdaterTerminal() {
  try {
    await runCommand(["ghostty", "-e", "update-btw"])
  } catch (error) {
    logProcessError("upcheck failed to open updater terminal", error)
  }
}
