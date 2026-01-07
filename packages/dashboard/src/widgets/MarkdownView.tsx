import { Gtk, Gdk } from "ags/gtk4"
import Pango from "gi://Pango"
// Try to import GtkSource for syntax highlighting
let GtkSource: any
try {
  GtkSource = (await import("gi://GtkSource?version=5")).default
} catch (e) {
  console.log("GtkSourceView not found, falling back to plain labels for code.")
}

// Reuse your existing inline renderer for paragraphs
import { renderMarkdownPango } from "../services/renderMarkdown"

// --- Types ---
type Block =
  | { type: "code"; lang: string; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; kind: string; title: string; content: string }
  | { type: "quote"; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "separator" }

// --- Parser ---
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: Block[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 1. Code Blocks
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim()
      let content = ""
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        content += lines[i] + "\n"
        i++
      }
      blocks.push({ type: "code", lang, content: content.trimEnd() })
      i++
      continue
    }

    // 2. Tables (Naive parser: looks for pipes)
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|[-:| ]+\|/)) {
      const headers = line.split("|").map(s => s.trim()).filter(s => s)
      // Skip delimiter row
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].split("|").map(s => s.trim()).filter(s => s) // simple split
        rows.push(cells)
        i++
      }
      blocks.push({ type: "table", headers, rows })
      continue
    }

    // 3. Callouts / Blockquotes
    if (line.trim().startsWith(">")) {
      const raw = line.replace(/^>\s?/, "")
      const calloutMatch = raw.match(/^\[!(\w+)\]\s?(.*)/)

      if (calloutMatch) {
        const kind = calloutMatch[1].toLowerCase()
        const title = calloutMatch[2] || kind.toUpperCase()
        let content = ""
        i++
        // Slurp following quote lines into this callout
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          content += lines[i].replace(/^>\s?/, "") + "\n"
          i++
        }
        blocks.push({ type: "callout", kind, title, content: content.trim() })
      } else {
        // Standard Quote
        let content = raw + "\n"
        i++
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          content += lines[i].replace(/^>\s?/, "") + "\n"
          i++
        }
        blocks.push({ type: "quote", content: content.trim() })
      }
      continue
    }

    // 4. Headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)/)
    if (hMatch) {
      blocks.push({ type: "heading", level: hMatch[1].length, content: hMatch[2] })
      i++
      continue
    }

    // 5. Separator
    if (line.trim() === "---") {
      blocks.push({ type: "separator" })
      i++
      continue
    }

    // 6. Paragraph (accumulate text until next block type)
    if (line.trim() === "") {
      i++
      continue
    }

    let paragraph = line
    i++
    while (i < lines.length) {
      const next = lines[i]
      // Break on block starters
      if (next.trim().startsWith("```") || next.trim().startsWith("|") || next.trim().startsWith(">") || next.trim().startsWith("#") || next.trim() === "---" || next.trim() === "") break
      paragraph += "\n" + next
      i++
    }
    blocks.push({ type: "paragraph", content: paragraph })
  }
  return blocks
}

// --- Renderers ---

function CodeWidget(lang: string, content: string) {
  if (GtkSource) {
    const buffer = new GtkSource.Buffer()
    buffer.set_text(content, -1)

    const lm = GtkSource.LanguageManager.get_default()
    const language = lm.get_language(lang) || lm.get_language("js") // fallback
    if (language) buffer.set_language(language)

    // Try to apply a style scheme (catppuccin, solarized, etc if installed, or default)
    const sm = GtkSource.StyleSchemeManager.get_default()
    const scheme = sm.get_scheme("Adwaita-dark") || sm.get_scheme("classic")
    if (scheme) buffer.set_style_scheme(scheme)

    const view = new GtkSource.View({
      buffer,
      editable: false,
      wrap_mode: Gtk.WrapMode.WORD_CHAR,
      monospace: true,
      show_line_numbers: true,
      hexpand: true,
      halign: Gtk.Align.FILL,
      cssClasses: ["md-code-view"]
    })

    // Wrap in frame
    return new Gtk.Frame({ child: view, cssClasses: ["md-code-frame"], hexpand: true, halign: Gtk.Align.FILL })
  }

  // Fallback if no GtkSourceView
  return new Gtk.Label({
    label: content,
    cssClasses: ["md-code-fallback"],
    xalign: 0,
    use_markup: false,
  })
}

function TableWidget(headers: string[], rows: string[][]) {
  const grid = new Gtk.Grid({
    column_spacing: 12,
    row_spacing: 8,
    cssClasses: ["md-table"]
  })

  // Headers
  headers.forEach((h, col) => {
    const label = new Gtk.Label({
      label: `<b>${h}</b>`,
      use_markup: true,
      xalign: 0,
      cssClasses: ["md-table-header"]
    })
    grid.attach(label, col, 0, 1, 1)
  })

  // Separator
  const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL })
  grid.attach(sep, 0, 1, headers.length, 1)

  // Rows
  rows.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      const label = new Gtk.Label({
        label: cell,
        xalign: 0,
        cssClasses: ["md-table-cell"]
      })
      grid.attach(label, colIdx, rowIdx + 2, 1, 1)
    })
  })

  return grid
}

function CalloutWidget(kind: string, title: string, content: string) {
  const colors: Record<string, string> = {
    note: "#89b4fa",
    tip: "#a6e3a1",
    important: "#cba6f7",
    warning: "#fab387",
    caution: "#f38ba8"
  }
  const color = colors[kind] || colors.note

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    cssClasses: ["md-callout", `md-callout-${kind}`],
    spacing: 4
  })

  // Mimic GitHub Callout border with CSS in main styles, 
  // or use a helper Box for the colored strip.
  const titleLabel = new Gtk.Label({
    label: `<span foreground="${color}"><b>${title}</b></span>`,
    use_markup: true,
    xalign: 0
  })

  const bodyLabel = new Gtk.Label({
    label: content, // can recurse here if you want full markdown inside callouts
    xalign: 0,
    wrap: true,
    cssClasses: ["md-callout-body"]
  })

  box.append(titleLabel)
  box.append(bodyLabel)
  return box
}

// --- Main Widget ---
export function MarkdownView(content: string) {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
    valign: Gtk.Align.START
  })

  const blocks = parseBlocks(content)

  for (const block of blocks) {
    let widget: Gtk.Widget | null = null

    switch (block.type) {
      case "code":
        widget = CodeWidget(block.lang, block.content)
        break
      case "table":
        widget = TableWidget(block.headers, block.rows)
        break
      case "callout":
        widget = CalloutWidget(block.kind, block.title, block.content)
        break
      case "quote":
        widget = new Gtk.Label({
          label: `<i>${block.content}</i>`, // Use existing Pango logic if preferred
          use_markup: true,
          xalign: 0,
          wrap: true,
          cssClasses: ["md-quote"]
        })
        break
      case "heading":
        const size = ["20pt", "16pt", "14pt", "12pt", "11pt", "10pt"][block.level - 1] || "10pt"
        widget = new Gtk.Label({
          label: `<span size="${size}" weight="bold">${block.content}</span>`,
          use_markup: true,
          xalign: 0,
          cssClasses: [`md-h${block.level}`]
        })
        break
      case "separator":
        widget = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL })
        break
      case "paragraph":
        widget = new Gtk.Label({
          // Fallback to your existing regex for inline bold/italic
          label: renderMarkdownPango(block.content),
          use_markup: true,
          xalign: 0,
          wrap: true,
          selectable: true,
          cssClasses: ["md-paragraph"]
        })
        break
    }

    if (widget) box.append(widget)
  }

  return box
}
