import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

import { resolveLyricsConfig } from "../config"
import { getVisibleLines } from "../store"
import type { LyricsConfig, LyricsState, ResolvedLyricsConfig } from "../types"

function clearBox(box: Gtk.Box) {
  while (true) {
    const child = box.get_first_child()
    if (!child) return
    box.remove(child)
  }
}

function lineKey(time: number, text: string) {
  return `${time}:${text}`
}

function trackKey(state: LyricsState) {
  const track = state.track
  if (!track) return ""
  return `${track.artist}|${track.title}|${track.album}|${track.duration}`
}

export function createLyricsView(userConfig?: LyricsConfig) {
  const config: ResolvedLyricsConfig = resolveLyricsConfig(userConfig)
  let lastActiveIndex = -1
  let lastTrackKey = ""
  let animationSourceId: number | null = null

  const title = new Gtk.Label({
    xalign: 0.5,
    ellipsize: 3,
  })
  title.add_css_class("lyrics-title")

  const status = new Gtk.Label({
    xalign: 0.5,
    visible: false,
  })
  status.add_css_class("lyrics-status")

  const linesBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    hexpand: true,
  })
  linesBox.add_css_class("lyrics-lines")

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    widthRequest: config.width,
    width_request: config.width,
  })
  root.add_css_class("lyrics-card")
  root.set_opacity(config.opacity)
  root.append(title)
  root.append(status)
  root.append(linesBox)

  function clearAnimation() {
    if (animationSourceId !== null) {
      GLib.Source.remove(animationSourceId)
      animationSourceId = null
    }

    linesBox.remove_css_class("lyrics-lines-roll-forward")
    linesBox.remove_css_class("lyrics-lines-roll-backward")
  }

  function animateLineChange(direction: "forward" | "backward" | null) {
    clearAnimation()
    if (!direction) return

    linesBox.add_css_class(direction === "forward" ? "lyrics-lines-roll-forward" : "lyrics-lines-roll-backward")

    animationSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      animationSourceId = null
      linesBox.remove_css_class("lyrics-lines-roll-forward")
      linesBox.remove_css_class("lyrics-lines-roll-backward")
      return GLib.SOURCE_REMOVE
    })
  }

  function render(state: LyricsState) {
    const track = state.track
    const currentTrackKey = trackKey(state)
    const sameTrack = currentTrackKey !== "" && currentTrackKey === lastTrackKey
    const canAnimate = sameTrack && state.activeIndex >= 0 && state.activeIndex !== lastActiveIndex
    const direction = canAnimate
      ? state.activeIndex > lastActiveIndex ? "forward" : "backward"
      : null

    title.label = track ? `${track.artist || "Unknown artist"} - ${track.title || "Unknown title"}` : "Lyrics"
    status.visible = state.loading || !!state.message
    status.label = state.loading ? "Looking for synced lyrics." : state.message

    animateLineChange(direction)
    clearBox(linesBox)

    const visibleLines = getVisibleLines(state, config)
    if (visibleLines.length === 0) {
      lastActiveIndex = state.activeIndex
      lastTrackKey = currentTrackKey
      return
    }

    const activeKey = state.activeIndex >= 0
      ? lineKey(state.lines[state.activeIndex].time, state.lines[state.activeIndex].text)
      : ""

    for (const line of visibleLines) {
      const index = state.lines.findIndex(item => item.time === line.time && item.text === line.text)
      const label = new Gtk.Label({
        label: line.text || " ",
        xalign: 0.5,
        wrap: true,
        justify: Gtk.Justification.CENTER,
      })
      label.add_css_class("lyrics-line")

      if (lineKey(line.time, line.text) === activeKey) {
        label.add_css_class("lyrics-line-active")
      } else if (index < state.activeIndex) {
        label.add_css_class("lyrics-line-prev")
      } else {
        label.add_css_class("lyrics-line-next")
      }

      linesBox.append(label)
    }

    lastActiveIndex = state.activeIndex
    lastTrackKey = currentTrackKey
  }

  return { root, render }
}
