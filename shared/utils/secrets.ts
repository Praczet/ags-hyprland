import Secret from "gi://Secret"

const SCHEMA = Secret.Schema['new']("org.adart.Tokens", Secret.SchemaFlags.NONE, {
  service: Secret.SchemaAttributeType.STRING,
})

export async function storeSecret(service: string, value: string): Promise<void> {
  Secret.password_store_sync(SCHEMA, { service }, null, `AGS ${service} token`, value, null)
}

export async function lookupSecret(service: string): Promise<string | null> {
  try {
    const result = Secret.password_lookup_sync(SCHEMA, { service }, null)
    return result || null
  } catch {
    return null
  }
}

export async function clearSecret(service: string): Promise<void> {
  Secret.password_clear_sync(SCHEMA, { service }, null)
}
