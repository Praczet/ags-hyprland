import matugenCss from "../../../../shared/styles/matugen.css"

function getMatugenColor(name: string, fallback: string) {
  const re = new RegExp(`@define-color\\s+${name}\\s+([^;]+);`)
  const match = matugenCss.match(re)
  return match ? match[1].trim() : fallback
}

function escapeMarkup(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/`/g)
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return `<span font_family="monospace">${escapeMarkup(part)}</span>`
    }
    let out = escapeMarkup(part)
    out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    out = out.replace(/__([^_]+)__/g, "<b>$1</b>")
    out = out.replace(/\*([^*]+)\*/g, "<i>$1</i>")
    out = out.replace(/_([^_]+)_/g, "<i>$1</i>")
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => `<a href="${escapeMarkup(url)}">${label}</a>`)
    return out
  }).join("")
}

function renderCodeBlockLine(line: string) {
  return `<span font_family="monospace">${escapeMarkup(line)}</span>`
}

function renderHeading(level: number, text: string) {
  const size = Math.max(11000, 22000 - level * 1500)
  return `<span weight="bold" size="${size}">${renderInlineMarkdown(text)}</span>`
}

function renderCallout(kind: string, rest: string) {
  const calloutColor = getMatugenColor("primary", "#e6b6f1")
  const title = kind.toUpperCase()
  const body = rest ? ` ${renderInlineMarkdown(rest)}` : ""
  return `<span foreground="${calloutColor}"><b>${title}</b></span>${body}`
}

function renderQuote(text: string) {
  const quoteColor = getMatugenColor("on_surface_variant", "#cfc3cd")
  return `<span foreground="${quoteColor}">> ${renderInlineMarkdown(text)}</span>`
}

function renderList(text: string) {
  return `- ${renderInlineMarkdown(text)}`
}

function renderTable(line: string) {
  // Placeholder: render as plain text for now.
  return renderInlineMarkdown(line)
}

function renderImage(_alt: string, _url: string) {
  // Placeholder: Pango labels cannot embed images.
  return ""
}

export function renderMarkdownPango(markdownText: string) {
  const lines = markdownText.split(/\r?\n/)
  const rendered: string[] = []
  let inCodeBlock = false
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) {
      rendered.push(renderCodeBlockLine(raw))
      continue
    }
    if (!raw.trim()) {
      rendered.push("")
      continue
    }
    const heading = raw.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      rendered.push(renderHeading(level, heading[2]))
      continue
    }
    const callout = raw.match(/^>\s*\[!([A-Za-z0-9_-]+)\]\s*(.*)$/)
    if (callout) {
      rendered.push(renderCallout(callout[1], callout[2] ?? ""))
      continue
    }
    const quote = raw.match(/^>\s*(.*)$/)
    if (quote) {
      rendered.push(renderQuote(quote[1]))
      continue
    }
    const bullet = raw.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      rendered.push(renderList(bullet[1]))
      continue
    }
    const numbered = raw.match(/^\s*\d+\.\s+(.*)$/)
    if (numbered) {
      rendered.push(renderList(numbered[1]))
      continue
    }
    const table = raw.match(/^\s*\|.*\|\s*$/)
    if (table) {
      rendered.push(renderTable(raw))
      continue
    }
    const image = raw.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (image) {
      rendered.push(renderImage(image[1], image[2]))
      continue
    }
    rendered.push(renderInlineMarkdown(raw))
  }
  return rendered.join("\n")
}
