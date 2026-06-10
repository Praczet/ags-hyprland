import { Gtk } from "ags/gtk4"
import { createComputed, createEffect } from "ags"
import GdkPixbuf from "gi://GdkPixbuf"
import Gdk from "gi://Gdk"
import { bloomSession } from "../store"
import { StageRow } from "./StageRow"
import { WorkerBar } from "./WorkerBar"
import { CompletionRow } from "./CompletionRow"

// Thumbnail column width in px — pre-scale to this so Gtk.Picture's natural
// size stays small and the card doesn't grow to wallpaper resolution.
const THUMB_W = 440

function loadThumbnail(path: string): Gdk.Texture | null {
  try {
    // Scale to THUMB_W wide, height auto (preserves aspect ratio).
    // The pixbuf natural size becomes ~96×54 for 16:9 — small enough for the
    // card. Gtk.Picture with contentFit=COVER then upscales to fill card height.
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, THUMB_W, -1, true)
    if (!pixbuf) return null
    return Gdk.Texture.new_for_pixbuf(pixbuf)
  } catch {
    return null
  }
}

export function BloomProgress() {
  const profile = createComputed(() => bloomSession().profile || "bloom")
  const wallpaper = createComputed(() => bloomSession().wallpaper ?? null)
  const hasWallpaper = createComputed(() => wallpaper() !== null)
  const cardClass = createComputed(() =>
    hasWallpaper() ? "bloom-card bloom-card-with-image" : "bloom-card"
  )

  let pictureRef: Gtk.Picture | null = null

  createEffect(() => {
    if (!pictureRef) return
    const path = wallpaper()
    if (!path) {
      pictureRef.visible = false
      return
    }
    const texture = loadThumbnail(path)
    if (texture) {
      pictureRef.set_paintable(texture)
      pictureRef.visible = true
    } else {
      pictureRef.visible = false
    }
  })

  const content = (
    <box class="bloom-content" orientation={Gtk.Orientation.VERTICAL} spacing={6}
      widthRequest={380} heightRequest={220}>
      <box class="bloom-header" orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
        <label class="bloom-header-icon" label="◉" />
        <label class="bloom-header-title" label="unclaimed-bloom" />
        <label class="bloom-header-sep" label="•" />
        <label class="bloom-header-profile" label={profile} maxWidthChars={18} ellipsize={3} />
      </box>

      <box class="bloom-stages" orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        <StageRow stage="sow" />
        <WorkerBar stage="sow" />
        <StageRow stage="grow" />
        <WorkerBar stage="grow" />
        <StageRow stage="plant" />
        <WorkerBar stage="plant" />
      </box>

      <CompletionRow />
    </box>
  )

  return (
    <box class={cardClass} orientation={Gtk.Orientation.HORIZONTAL}>
      <Gtk.Picture
        class="bloom-wallpaper"
        contentFit={Gtk.ContentFit.COVER}
        widthRequest={THUMB_W}
        vexpand={true}
        visible={false}
        $={(self: Gtk.Picture) => { pictureRef = self }}
      />
      {content}
    </box>
  )
}
