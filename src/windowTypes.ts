import app from "ags/gtk4/app"
import type { AegisWindowHandle } from "../packages/aegis/src"
import type { DashboardWindowHandle } from "../packages/dashboard/src"
import type { ExposeWindowHandle } from "../packages/expose/src"
import type { NetworkWindowHandle } from "../packages/a-network/src"
import type { OSDWindowHandle } from "../packages/osd/src"
import type { UpcheckWindowHandle } from "../packages/upcheck/src"

export const WINDOW_NAME = {
  aegis: "aegis",
  dashboard: "dashboard",
  expose: "expose",
  network: "network",
  osd: "osd",
  upcheck: "upcheck",
} as const

export type RequestResponse = string | undefined

type BaseAppWindow = {
  visible: boolean
  show(): void
  hide(): void
  present?(): void
  grab_focus?(): void
  openWindow?(): void
  closeWindow?(): void
}

export type AegisAppWindow = BaseAppWindow & AegisWindowHandle

export type DashboardAppWindow = BaseAppWindow & DashboardWindowHandle & {
  _rootDispose?: () => void
  connect?(signal: string, callback: () => void): unknown
}

export type ExposeAppWindow = BaseAppWindow & ExposeWindowHandle

export type NetworkAppWindow = BaseAppWindow & NetworkWindowHandle

export type OSDAppWindow = BaseAppWindow & OSDWindowHandle

export type UpcheckAppWindow = BaseAppWindow & UpcheckWindowHandle

export function getAppWindow<T extends BaseAppWindow>(name: string) {
  return app.get_window(name) as T | null
}
