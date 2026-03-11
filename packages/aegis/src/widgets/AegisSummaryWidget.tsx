import type { AegisMode } from "../types"
import { AegisWidget } from "./AegisWidget"
import type { SectionId } from "./sections"

export type AegisSummaryConfig = {
  mode?: AegisMode
  sections?: SectionId[]
  showSectionTitles?: boolean
}

export function AegisSummaryWidget(cfg: AegisSummaryConfig = {}) {
  const mode = cfg.mode ?? "summary"
  const sections = cfg.sections ?? ["system", "hardware", "memory", "storage", "network", "power", "hyprland"]
  return AegisWidget({ mode, sections, showSectionTitles: cfg.showSectionTitles })
}
