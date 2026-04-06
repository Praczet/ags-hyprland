#!/usr/bin/env node
// Loopback OAuth for TickTick.
// Usage: node scripts/ticktick-auth.js <clientId> <clientSecret>

const http = require("http")
const { execFileSync } = require("child_process")

function storeInKeyring(token) {
  try {
    execFileSync("secret-tool", ["store", "--label", "AGS ticktick token", "service", "ticktick"], {
      input: token,
      stdio: ["pipe", "inherit", "inherit"],
    })
    console.log("Token stored in keyring (org.adart.Tokens / service=ticktick)")
  } catch (err) {
    console.warn("Could not store token in keyring (secret-tool failed):", err.message)
    console.log("Set accessToken manually in dashboard.json:", token)
  }
}

async function main() {
  const clientId = process.argv[2]
  const clientSecret = process.argv[3]
  if (!clientId || !clientSecret) {
    console.error("Usage: node scripts/ticktick-auth.js <clientId> <clientSecret>")
    process.exit(1)
  }

  const redirectUri = "http://localhost:8788"
  const scope = "tasks:read"

  const authUrl = new URL("https://ticktick.com/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", scope)
  authUrl.searchParams.set("state", "ticktick")

  console.log("Open this URL in your browser:")
  console.log(authUrl.toString())

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer()
    const timer = setTimeout(() => reject(new Error("Timed out waiting for OAuth code")), 5 * 60 * 1000)

    server.on("request", (req, res) => {
      try {
        const url = new URL(req.url, redirectUri)
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
      }
    })

    server.listen(8788, "127.0.0.1")
  })

  const tokenRes = await fetch("https://ticktick.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      scope,
    }).toString(),
  })

  const text = await tokenRes.text()
  if (!tokenRes.ok) {
    console.error(text)
    process.exit(1)
  }

  let accessToken = text
  try {
    const json = JSON.parse(text)
    accessToken = json.access_token ?? text
  } catch { /* not JSON, use raw */ }

  storeInKeyring(accessToken)
  console.log("TickTick token response:")
  console.log(text)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
