import { execAsync } from "ags/process";
import { setSelected, setErr, setDetails, setLoading, shellQuote, cache, setDetailsView } from "../store";


let reqId = 0

function sh(cmd: string): Promise<string> {
  // NOTE: checkupdates returns exit code 2 when there are no updates
  // so we handle that in the caller.
  return execAsync(["sh", "-lc", cmd]).then(String);
}

function parseUpdates(out: string): UpItem[] {
  return out
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [name, oldVer, newVer] = line.split(/\s+/);
      if (!name || !oldVer || !newVer) return null;
      return { name, oldVer, newVer };
    })
    .filter((x): x is UpItem => x !== null);
}

export async function getUpdates(): Promise<UpItem[]> {
  // Your formatting: "name old new"
  const cmd =
    "checkupdates --nocolor | sed -E 's/^(\\S+)\\s+(\\S+)\\s+->\\s+(\\S+)$/\\1 \\2 \\3/'";

  try {
    const out = await sh(cmd);
    return parseUpdates(out);
  } catch (e: any) {
    const msg = String(e?.stderr ?? e?.message ?? e);
    if (
      /exit status 2|status 2|code 2/i.test(msg) ||
      /there are no updates available/i.test(msg)
    ) {
      return [];
    }

    throw e;
  }
}

function parsePacquery(out: string): PkgDetails {
  try {
    const json = JSON.parse(out);
    const pkg = Array.isArray(json) ? json[0] : json;

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
    };
  } catch (e) {
    console.error("Failed to parse pacquery JSON:", e);
    throw e;
  }
}


function parsePacmanSi(out: string): PkgDetails {
  // minimal parser (extend later)
  console.log("pacman -Si output:", out);
  const lines = out.split("\n");
  const get = (key: string) => {
    const line = lines.find(l => l.startsWith(key + " : "));
    return line ? line.slice((key + " : ").length).trim() : undefined;
  };
  console.log("Parsed fields:", get);

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
  };
}

/** 
 * @deprecated Use selectItem instead
 */
export async function selectItemPacman(item: UpItem) {
  setSelected(item);
  setErr(null);

  const key = item.name;
  console.log("Selecting item:", item);
  if (cache.has(key)) {
    console.log("Using cached details for:", key);
    setDetails(cache.get(key)!);
    setLoading(false);
    return;
  }
  console.log("Fetching details for:", key);

  setLoading(true);
  setDetails(null);


  const my = ++reqId;
  try {
    const out = await execAsync(["sh", "-lc", `pacman -Si ${shellQuote(key)}`]);
    const d = parsePacmanSi(String(out));
    cache.set(key, d);
    console.log("Fetched details for:", key, d);
    console.log("Current reqId:", reqId, "my:", my);

    if (my === reqId) setDetails(d);
  } catch (e) {
    if (my === reqId) setErr(String(e));
  } finally {
    if (my === reqId) setLoading(false);
  }
}


export async function selectItem(item: UpItem) {
  setErr(null);
  setSelected(item);

  const key = item.name;

  if (cache.has(key)) {
    setDetails(cache.get(key)!);
    setDetailsView("details"); // Explicitly show details
    setLoading(false);
    return;
  }

  // 2. Set UI to 'loading' state BEFORE starting the async work
  setLoading(true);
  setDetails(null);
  setDetailsView("loading");

  const my = ++reqId;
  try {
    const out = await execAsync(["pacquery", key]);
    const d = parsePacquery(String(out));

    if (my === reqId) {
      cache.set(key, d);
      setDetails(d);
      setDetailsView("details");
    }
  } catch (e) {
    if (my === reqId) {
      setErr(String(e));
      if (my === reqId) setLoading(false);
    }
  }
}

export async function openUpdaterTerminal() {
  try {
    await execAsync(["ghostty", "-e", "sudo", "pacman", "-Syu"]);
  } catch (e) {
    console.error("Failed to open updater terminal:", e);
  }
}




