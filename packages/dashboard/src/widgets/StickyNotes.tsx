import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { MarkdownView } from "./MarkdownView"

export type StickyNoteEntry = {
  id: string
  path: string
  title: string
  body: string
  background?: string
  renderMarkdown: boolean
  excludeFromNotes?: boolean
}

export type StickyNotesListConfig = {
  title?: string
  showTitle?: boolean
  notesConfigPath?: string
  refreshMins?: number
  openNote?: string
  onOpenNote?: () => void
  maxNotes?: number
  maxNoteHeight?: number
  maxNoteWidth?: number
  minNoteHeight?: number
  minNoteWidth?: number
}

export type StickyNoteWidgetConfig = {
  note: StickyNoteEntry
  maxNoteHeight?: number
  maxNoteWidth?: number
  minNoteHeight?: number
  minNoteWidth?: number
  refreshMins?: number
  notesConfigPath?: string
  noteId?: string
  openNote?: string
  onOpenNote?: () => void
}

type NotesConfig = {
  notesDir?: string
  scanFolder?: boolean
  pattern?: string
  selected?: string[]
  maxNoteHeight?: number
  maxNoteWidth?: number
  minNoteHeight?: number
  minNoteWidth?: number
  defaults?: {
    background?: string
    renderMarkdown?: boolean
  }
  notes?: Record<string, { background?: string; renderMarkdown?: boolean; excludeFromNotes?: boolean }>
}

type Frontmatter = {
  title?: string
  sticky?: {
    background?: string
    renderMarkdown?: boolean
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function expandHome(path: string) {
  if (path.startsWith("~/")) return `${GLib.get_home_dir()}/${path.slice(2)}`
  return path
}

function applyCss(widget: Gtk.Widget, css: string) {
  const ctx = widget.get_style_context()
  const provider = new Gtk.CssProvider()
  if (!css.includes("{") || !css.includes("}")) {
    css = `* { ${css} }`
  }
  provider.load_from_string(css)
  ctx.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_USER)
}

function buildOpenNoteCommand(template: string, notePath: string) {
  const quotedPath = GLib.shell_quote(notePath)
  if (template.includes("{path}")) return template.replaceAll("{path}", quotedPath)
  return `${template} ${quotedPath}`
}

function parseSimpleFrontmatter(txt: string): Frontmatter {
  const fm: Frontmatter = {}
  const lines = txt.split(/\r?\n/)
  let inSticky = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const titleMatch = trimmed.match(/^title:\s*(.+)$/)
    if (titleMatch) {
      fm.title = titleMatch[1].trim()
      inSticky = false
      continue
    }
    if (trimmed === "sticky:") {
      inSticky = true
      if (!fm.sticky) fm.sticky = {}
      continue
    }
    if (inSticky) {
      const bgMatch = trimmed.match(/^background:\s*(.+)$/)
      if (bgMatch) {
        if (!fm.sticky) fm.sticky = {}
        fm.sticky.background = bgMatch[1].trim()
        continue
      }
      const renderMatch = trimmed.match(/^renderMarkdown:\s*(true|false)$/)
      if (renderMatch) {
        if (!fm.sticky) fm.sticky = {}
        fm.sticky.renderMarkdown = renderMatch[1] === "true"
        continue
      }
    }
    if (!line.startsWith(" ") && !line.startsWith("\t")) inSticky = false
  }
  return fm
}

function stripFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw }
  const end = raw.indexOf("\n---", 3)
  if (end === -1) return { frontmatter: {}, body: raw }
  const frontmatter = parseSimpleFrontmatter(raw.slice(3, end).trim())
  const body = raw.slice(end + 4).replace(/^\r?\n/, "")
  return { frontmatter, body }
}

function extractTitleFromHeading(body: string): { title?: string; body: string } {
  const lines = body.split(/\r?\n/)
  let i = 0
  while (i < lines.length && lines[i].trim() === "") i += 1
  if (i < lines.length && lines[i].startsWith("# ")) {
    const title = lines[i].slice(2).trim()
    lines.splice(i, 1)
    return { title, body: lines.join("\n") }
  }
  return { body }
}

function resolveNotePath(notesDir: string, id: string) {
  const expanded = expandHome(id)
  if (GLib.path_is_absolute(expanded)) return expanded
  return GLib.build_filenamev([notesDir, expanded])
}

function loadNotesConfig(path: string): NotesConfig {
  let user: unknown = null
  try {
    const txt = GLib.file_get_contents(path)?.[1]
    if (txt) user = JSON.parse(new TextDecoder().decode(txt))
  } catch {
    // missing or invalid config -> defaults
  }
  const u = isObject(user) ? user : {}
  return {
    notesDir: typeof u.notesDir === "string" ? u.notesDir : "~/.config/ags/notes",
    scanFolder: typeof u.scanFolder === "boolean" ? u.scanFolder : true,
    pattern: typeof u.pattern === "string" ? u.pattern : "-SM\\.md$",
    selected: Array.isArray(u.selected) ? u.selected.filter((s: unknown) => typeof s === "string") : [],
    maxNoteHeight: Number.isFinite(Number(u.maxNoteHeight)) ? Math.floor(Number(u.maxNoteHeight)) : undefined,
    maxNoteWidth: Number.isFinite(Number(u.maxNoteWidth)) ? Math.floor(Number(u.maxNoteWidth)) : undefined,
    minNoteHeight: Number.isFinite(Number(u.minNoteHeight)) ? Math.floor(Number(u.minNoteHeight)) : undefined,
    minNoteWidth: Number.isFinite(Number(u.minNoteWidth)) ? Math.floor(Number(u.minNoteWidth)) : undefined,
    defaults: isObject(u.defaults)
      ? {
        background: typeof u.defaults.background === "string" ? u.defaults.background : undefined,
        renderMarkdown: typeof u.defaults.renderMarkdown === "boolean" ? u.defaults.renderMarkdown : undefined,
      }
      : {},
    notes: isObject(u.notes)
      ? Object.fromEntries(
        Object.entries(u.notes).map(([key, value]) => [
          key,
          {
            background: isObject(value) && typeof value.background === "string" ? value.background : undefined,
            renderMarkdown: isObject(value) && typeof value.renderMarkdown === "boolean" ? value.renderMarkdown : undefined,
            excludeFromNotes: isObject(value) && (typeof value.excludeFromNotes === "boolean" || value.excludeFromNotes === "true")
              ? (value.excludeFromNotes === true || value.excludeFromNotes === "true")
              : undefined,
          },
        ]),
      )
      : {},
  }
}

function listNotesFromFolder(notesDir: string, pattern: string): string[] {
  const matches: string[] = []
  let regex: RegExp | null = null
  try {
    regex = new RegExp(pattern)
  } catch {
    regex = null
  }
  if (!regex) return matches
  try {
    const dir = Gio.File.new_for_path(notesDir)
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
    let info: Gio.FileInfo | null
    while ((info = enumerator.next_file(null)) !== null) {
      if (info.get_file_type() !== Gio.FileType.REGULAR) continue
      const name = info.get_name()
      if (!regex.test(name)) continue
      const child = dir.get_child(name)
      const path = child.get_path()
      if (path) matches.push(path)
    }
    enumerator.close(null)
  } catch {
    // ignore directory errors
  }
  return matches
}

function buildNoteFromPath(path: string, defaults: { background?: string; renderMarkdown: boolean }, override?: { background?: string; renderMarkdown?: boolean; excludeFromNotes?: boolean }) {
  const raw = GLib.file_get_contents(path)?.[1]
  if (!raw) return null
  const text = new TextDecoder().decode(raw)
  const { frontmatter, body: rawBody } = stripFrontmatter(text)
  const { title: headerTitle, body } = extractTitleFromHeading(rawBody)
  const baseName = GLib.path_get_basename(path)
  const fileTitle = baseName.replace(/\.[^.]+$/, "")
  const title = frontmatter.title ?? headerTitle ?? fileTitle
  const renderMarkdown = override?.renderMarkdown
    ?? frontmatter.sticky?.renderMarkdown
    ?? defaults.renderMarkdown
  const background = override?.background
    ?? frontmatter.sticky?.background
    ?? defaults.background
  return {
    id: baseName,
    path,
    title,
    body: body.trim(),
    background,
    renderMarkdown,
    excludeFromNotes: override?.excludeFromNotes,
  } as StickyNoteEntry
}

export function loadStickyNotes(configPath: string = "~/.config/ags/notes.json") {
  const cfgPath = expandHome(configPath)
  const cfg = loadNotesConfig(cfgPath)
  const notesDir = expandHome(cfg.notesDir ?? "~/.config/ags/notes")
  const defaults = {
    background: cfg.defaults?.background,
    renderMarkdown: cfg.defaults?.renderMarkdown ?? true,
  }
  const maxNoteHeight = Number.isFinite(Number(cfg.maxNoteHeight))
    ? Math.max(120, Math.floor(Number(cfg.maxNoteHeight)))
    : undefined
  const maxNoteWidth = Number.isFinite(Number(cfg.maxNoteWidth))
    ? Math.max(120, Math.floor(Number(cfg.maxNoteWidth)))
    : undefined
  const minNoteHeight = Number.isFinite(Number(cfg.minNoteHeight))
    ? Math.max(1, Math.floor(Number(cfg.minNoteHeight)))
    : undefined
  const minNoteWidth = Number.isFinite(Number(cfg.minNoteWidth))
    ? Math.max(1, Math.floor(Number(cfg.minNoteWidth)))
    : undefined
  const overrides = new Map<string, { background?: string; renderMarkdown?: boolean; excludeFromNotes?: boolean }>()
  const overridesByName = new Map<string, { background?: string; renderMarkdown?: boolean; excludeFromNotes?: boolean }>()
  const addNameOverride = (key: string, override: { background?: string; renderMarkdown?: boolean; excludeFromNotes?: boolean }) => {
    overridesByName.set(key, override)
    if (!key.includes(".")) overridesByName.set(`${key}.md`, override)
    if (key.includes(".")) overridesByName.set(key.replace(/\.[^.]+$/, ""), override)
  }
  for (const [key, value] of Object.entries(cfg.notes ?? {})) {
    const override = value ?? {}
    overrides.set(resolveNotePath(notesDir, key), override)
    addNameOverride(key, override)
  }
  const selected = new Set<string>()
  for (const id of cfg.selected ?? []) {
    selected.add(resolveNotePath(notesDir, id))
  }
  if (cfg.scanFolder !== false) {
    for (const path of listNotesFromFolder(notesDir, cfg.pattern ?? "-SM\\.md$")) {
      selected.add(path)
    }
  }

  const notes: StickyNoteEntry[] = []
  for (const path of selected) {
    try {
      const base = GLib.path_get_basename(path)
      const baseNoExt = base.replace(/\.[^.]+$/, "")
      const override = overrides.get(path)
        ?? overridesByName.get(base)
        ?? overridesByName.get(baseNoExt)
      const note = buildNoteFromPath(path, defaults, override)
      if (note) {
        const exclude = override?.excludeFromNotes
          ?? overridesByName.get(base)?.excludeFromNotes
          ?? overridesByName.get(baseNoExt)?.excludeFromNotes
        if (exclude === true) note.excludeFromNotes = true
        notes.push(note)
      }
    } catch {
      // ignore read errors
    }
  }
  return { notes, maxNoteHeight, maxNoteWidth, minNoteHeight, minNoteWidth, config: cfg }
}

export function loadStickyNote(configPath: string, noteId: string) {
  const cfgPath = expandHome(configPath)
  const cfg = loadNotesConfig(cfgPath)
  const notesDir = expandHome(cfg.notesDir ?? "~/.config/ags/notes")
  const defaults = {
    background: cfg.defaults?.background,
    renderMarkdown: cfg.defaults?.renderMarkdown ?? true,
  }
  const resolved = resolveNotePath(notesDir, noteId)
  const resolvedMd = noteId.includes(".") ? resolved : resolveNotePath(notesDir, `${noteId}.md`)
  const override = cfg.notes?.[noteId] ?? cfg.notes?.[`${noteId}.md`]
  const path = GLib.file_test(resolved, GLib.FileTest.EXISTS) ? resolved : resolvedMd
  return buildNoteFromPath(path, defaults, override)
}

export function StickyNoteWidget(cfg: StickyNoteWidgetConfig) {
  let note = cfg.note
  const maxNoteHeight = Number.isFinite(Number(cfg.maxNoteHeight))
    ? Math.max(120, Math.floor(Number(cfg.maxNoteHeight)))
    : undefined
  const maxNoteWidth = Number.isFinite(Number(cfg.maxNoteWidth))
    ? Math.max(120, Math.floor(Number(cfg.maxNoteWidth)))
    : undefined
  const minNoteHeight = Number.isFinite(Number(cfg.minNoteHeight))
    ? Math.max(1, Math.floor(Number(cfg.minNoteHeight)))
    : undefined
  const minNoteWidth = Number.isFinite(Number(cfg.minNoteWidth))
    ? Math.max(1, Math.floor(Number(cfg.minNoteWidth)))
    : undefined
  const widthRequest = maxNoteWidth ?? minNoteWidth
  const heightRequest = maxNoteHeight ?? minNoteHeight

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    cssClasses: ["sticky-note-card"],
    hexpand: true,
    vexpand: true,
    halign: Gtk.Align.FILL,
    valign: Gtk.Align.FILL,
  })
  if (widthRequest || heightRequest) card.set_size_request(widthRequest ?? -1, heightRequest ?? -1)
  if (cfg.openNote) {
    const click = new Gtk.GestureClick()
    click.connect("released", (_gesture: Gtk.GestureClick, _nPress: number, _x: number, _y: number) => {
      const command = buildOpenNoteCommand(cfg.openNote!, note.path)
      GLib.spawn_command_line_async(command)
      cfg.onOpenNote?.()
    })
    card.add_controller(click)
  }

  const header = new Gtk.Label({
    label: note.title,
    xalign: 0,
    cssClasses: ["sticky-note-title"],
  })
  card.append(header)

  const scroller = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
    cssClasses: ["sticky-note-scroll"],
  })
  scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  scroller.set_halign(Gtk.Align.FILL)
  scroller.set_valign(Gtk.Align.FILL)
  if (widthRequest || heightRequest) scroller.set_size_request(widthRequest ?? -1, heightRequest ?? -1)

  const renderContent = (next: StickyNoteEntry | null) => {
    if (!next) {
      const missing = new Gtk.Label({
        label: "Missing note",
        wrap: true,
        xalign: 0,
        selectable: false,
        cssClasses: ["sticky-note-text"],
      })
      scroller.set_child(missing)
      return
    }
    note = next
    header.set_label(note.title)
    if (note.background) applyCss(card, `background: ${note.background};`)

    // NOTE: This checks if we should render full markdown.
    if (note.renderMarkdown) {
      // We use the new MarkdownView widget here.
      // It returns a Box (or similar Widget) containing the rendered blocks.
      const mdView = MarkdownView(note.body)

      // Optional: Add some internal margin if the view touches the scroll edges
      mdView.set_margin_start(2)
      mdView.set_margin_end(2)
      mdView.set_margin_bottom(2)

      scroller.set_child(mdView)
    } else {
      const label = new Gtk.Label({
        label: note.body,
        wrap: true,
        xalign: 0,
        selectable: true,
        cssClasses: ["sticky-note-text"],
      })
      scroller.set_child(label)
    }
  }

  renderContent(note)

  card.append(scroller)
  if (cfg.refreshMins && cfg.noteId && cfg.notesConfigPath) {
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, cfg.refreshMins * 60, () => {
      renderContent(loadStickyNote(cfg.notesConfigPath!, cfg.noteId!))
      return GLib.SOURCE_CONTINUE
    })
  }
  return card
}

function clearContainer(container: Gtk.Widget) {
  let child = container.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
      ; (container as unknown as { remove: (w: Gtk.Widget) => void }).remove(child)
    child = next
  }
}

export function StickyNotesWidget(cfg: StickyNotesListConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Sticky Notes")
  const configPath = cfg.notesConfigPath ?? "~/.config/ags/notes.json"
  const maxNotes = Number.isFinite(Number(cfg.maxNotes)) ? Math.max(1, Math.floor(Number(cfg.maxNotes))) : undefined
  const maxNoteHeight = Number.isFinite(Number(cfg.maxNoteHeight)) ? Math.max(1, Math.floor(Number(cfg.maxNoteHeight))) : undefined
  const maxNoteWidth = Number.isFinite(Number(cfg.maxNoteWidth)) ? Math.max(1, Math.floor(Number(cfg.maxNoteWidth))) : undefined
  const minNoteHeight = Number.isFinite(Number(cfg.minNoteHeight)) ? Math.max(1, Math.floor(Number(cfg.minNoteHeight))) : undefined
  const minNoteWidth = Number.isFinite(Number(cfg.minNoteWidth)) ? Math.max(1, Math.floor(Number(cfg.minNoteWidth))) : undefined
  const refreshMins = Number.isFinite(Number(cfg.refreshMins)) ? Math.max(1, Math.floor(Number(cfg.refreshMins))) : undefined

  const list = new Gtk.FlowBox({
    orientation: Gtk.Orientation.HORIZONTAL,
    row_spacing: 10,
    column_spacing: 10,
    selection_mode: Gtk.SelectionMode.NONE,
    homogeneous: false,
  })
  list.set_min_children_per_line(1)
  list.set_hexpand(true)
  list.set_vexpand(true)
  list.set_halign(Gtk.Align.FILL)
  list.set_valign(Gtk.Align.FILL)

  const listScroller = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
    cssClasses: ["sticky-notes-list"],
  })
  listScroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  listScroller.set_halign(Gtk.Align.FILL)
  listScroller.set_valign(Gtk.Align.FILL)
  listScroller.set_child(list)

  const render = () => {
    const data = loadStickyNotes(configPath)
    const resolvedMaxNoteWidth = maxNoteWidth ?? data.maxNoteWidth
    if (resolvedMaxNoteWidth) {
      list.set_max_children_per_line(9999)
    } else {
      list.set_max_children_per_line(1)
    }
    clearContainer(list)
    const shouldExclude = (note: StickyNoteEntry) => {
      if (note.excludeFromNotes === true) return true
      const base = GLib.path_get_basename(note.path)
      const baseNoExt = base.replace(/\.[^.]+$/, "")
      const direct = data.config.notes?.[base] ?? data.config.notes?.[baseNoExt] ?? data.config.notes?.[`${baseNoExt}.md`]
      return direct?.excludeFromNotes === true
    }
    let notes = data.notes.filter(note => !shouldExclude(note))
    if (maxNotes) notes = notes.slice(0, maxNotes)
    if (notes.length === 0) {
      list.append(new Gtk.Label({ label: "No sticky notes", xalign: 0 }))
      return
    }
    for (const note of notes) {
      list.append(StickyNoteWidget({
        note,
        maxNoteHeight: maxNoteHeight ?? data.maxNoteHeight,
        maxNoteWidth: maxNoteWidth ?? data.maxNoteWidth,
        minNoteHeight: minNoteHeight ?? data.minNoteHeight,
        minNoteWidth: minNoteWidth ?? data.minNoteWidth,
        openNote: cfg.openNote,
        onOpenNote: cfg.onOpenNote,
      }))
    }
  }

  render()
  if (refreshMins) {
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, refreshMins * 60, () => {
      render()
      return GLib.SOURCE_CONTINUE
    })
  }

  return (
    <box class="dashboard-widget-inner" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      {title ? (
        <box class="dashboard-widget-title-wrap" hexpand={true}>
          <label class="dashboard-widget-title" label={title} halign={Gtk.Align.CENTER} hexpand={true} />
        </box>
      ) : null}
      {listScroller}
    </box>
  ) as Gtk.Box
}
