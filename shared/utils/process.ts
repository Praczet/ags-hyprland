import { execAsync } from "ags/process"

export function toErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const withMessage = error as { stderr?: unknown; message?: unknown }
    return String(withMessage.stderr ?? withMessage.message ?? error)
  }

  return String(error)
}

export function logProcessError(scope: string, error: unknown) {
  console.error(scope, toErrorMessage(error))
}

export async function runCommand(argv: string[]): Promise<string> {
  return String(await execAsync(argv))
}

export async function runShell(command: string): Promise<string> {
  return runCommand(["sh", "-lc", command])
}
