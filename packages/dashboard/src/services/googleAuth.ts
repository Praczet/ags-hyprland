import GLib from "gi://GLib"
import { fetch, URL } from "ags/fetch"
import { loadDashboardConfig } from "../config"

type TokenData = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  expires_at?: number
}

type Credentials = {
  client_id: string
  client_secret?: string
}

function readJson(path: string): unknown {
  try {
    const txt = GLib.file_get_contents(path)?.[1]
    if (!txt) return null
    return JSON.parse(new TextDecoder().decode(txt))
  } catch {
    return null
  }
}

function writeJson(path: string, data: unknown) {
  const json = JSON.stringify(data, null, 2)
  GLib.file_set_contents(path, json)
}

function loadCredentials(path: string): Credentials | null {
  const raw = readJson(path)
  if (!raw || typeof raw !== "object") return null
  const obj = raw as any
  const installed = obj.installed ?? obj.web ?? obj
  const client_id = installed?.client_id
  const client_secret = installed?.client_secret
  if (!client_id || typeof client_id !== "string") return null
  return { client_id, client_secret: typeof client_secret === "string" ? client_secret : undefined }
}

function loadTokens(path: string): TokenData | null {
  const raw = readJson(path)
  if (!raw || typeof raw !== "object") return null
  const obj = raw as TokenData
  if (!obj.access_token && !obj.refresh_token) return null
  return obj
}

async function refreshAccessToken(creds: Credentials, refreshToken: string): Promise<TokenData> {
  const url = new URL("https://oauth2.googleapis.com/token")
  const form: Record<string, string> = {
    client_id: creds.client_id,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }
  if (creds.client_secret) form.client_secret = creds.client_secret
  const body = Object.entries(form)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${txt}`)
  }
  const json = await res.json() as TokenData
  return json
}

export async function getAccessToken(): Promise<string> {
  const cfg = loadDashboardConfig().google
  if (!cfg) throw new Error("Google config missing")
  const creds = loadCredentials(cfg.credentialsPath)
  if (!creds) throw new Error(`Invalid credentials file: ${cfg.credentialsPath}`)

  const tokenData = loadTokens(cfg.tokensPath)
  if (!tokenData) throw new Error(`Missing tokens file: ${cfg.tokensPath}`)

  const now = Math.floor(Date.now() / 1000)
  if (tokenData.access_token && tokenData.expires_at && tokenData.expires_at > now + 60) {
    return tokenData.access_token
  }

  if (!tokenData.refresh_token) {
    throw new Error("Missing refresh token. Run scripts/google-auth-device.js to authorize.")
  }

  const refreshed = await refreshAccessToken(creds, tokenData.refresh_token)
  const expiresAt = refreshed.expires_in ? now + refreshed.expires_in : now + 3500
  const merged: TokenData = {
    ...tokenData,
    ...refreshed,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
  }
  writeJson(cfg.tokensPath, merged)
  return merged.access_token
}
