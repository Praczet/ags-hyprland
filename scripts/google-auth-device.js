#!/usr/bin/env node
// Loopback OAuth for Google APIs.
// Usage: node scripts/google-auth-device.js [credentialsPath] [tokensPath]

const fs = require("fs")
const os = require("os")
const path = require("path")

function expandHome(p) {
  if (!p) return p
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p
}

async function main() {
  const credsPath = expandHome(process.argv[2] || "~/.config/ags/google-credentials.json")
  const tokensPath = expandHome(process.argv[3] || "~/.config/ags/google-tokens.json")

  if (!fs.existsSync(credsPath)) {
    console.error(`Credentials file not found: ${credsPath}`)
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(credsPath, "utf8"))
  const installed = raw.installed || raw.web || raw
  const clientId = installed.client_id
  const clientSecret = installed.client_secret

  if (!clientId) {
    console.error("Missing client_id in credentials file.")
    process.exit(1)
  }

  const scope = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/tasks.readonly",
  ].join(" ")

  const http = require("http")
  const server = http.createServer()

  const redirectUri = "http://localhost:8765"
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")
  authUrl.searchParams.set("scope", scope)

  console.log("Open this URL in your browser:")
  console.log(authUrl.toString())

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for OAuth code")), 5 * 60 * 1000)

    server.on("request", (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost")
        const got = url.searchParams.get("code")
        if (!got) {
          res.writeHead(400, { "Content-Type": "text/plain" })
          res.end("Missing code")
          return
        }
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end("Authorized. You can close this window.")
        clearTimeout(timer)
        resolve(got)
        server.close()
      } catch (err) {
        reject(err)
        server.close()
      }
    })

    server.listen(8765, "127.0.0.1")
  })

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret || "",
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  })

  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok) {
    console.error(tokenJson)
    process.exit(1)
  }

  const now = Math.floor(Date.now() / 1000)
  tokenJson.expires_at = now + (tokenJson.expires_in || 3500)
  fs.writeFileSync(tokensPath, JSON.stringify(tokenJson, null, 2))
  console.log(`Tokens saved to ${tokensPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
