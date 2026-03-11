import { fetch, URL } from "ags/fetch"

type Headers = Record<string, string>

export async function httpGetJson<T>(url: string, headers: Headers = {}): Promise<T> {
  const res = await fetch(new URL(url), { method: "GET", headers })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return await res.json()
}

export async function httpPostForm<T>(url: string, form: Record<string, string>, headers: Headers = {}): Promise<T> {
  const body = new URLSearchParams(form).toString()
  const res = await fetch(new URL(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body,
  })
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`)
  return await res.json()
}
