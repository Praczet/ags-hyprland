import GLib from "gi://GLib"

export function runCommand(cmd: string) {
  try {
    const [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd)
    if (!ok || status !== 0 || !stdout) {
      const err = stderr ? new TextDecoder().decode(stderr) : ""
      if (err.trim()) console.error("a-network command error", cmd, err.trim())
      return null
    }
    return new TextDecoder().decode(stdout)
  } catch (err) {
    console.error("a-network command failed", cmd, err)
    return null
  }
}

export function runCommandChecked(cmd: string) {
  const out = runCommand(cmd)
  if (out === null) {
    throw new Error(`Command failed (null): ${cmd}`)
  }
  return out
}

export function splitNmcliLine(line: string) {
  const parts: string[] = []
  let current = ""
  let escape = false
  for (const ch of line) {
    if (escape) {
      current += ch
      escape = false
      continue
    }
    if (ch === "\\") {
      escape = true
      continue
    }
    if (ch === ":") {
      parts.push(current)
      current = ""
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts
}
