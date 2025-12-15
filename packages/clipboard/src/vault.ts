// MyClipVault.ts
//
// Backend adapter for `clipvault` used by the AGS clipboard manager.
// - loadClipvaultEntries() → MyClipEntry[]
// - restoreClipToClipboard(id)
// - deleteClip(id)
//
// Uses execAsync from "ags/process"

import GLib from "gi://GLib";
import { execAsync } from "ags/process";
import { MyClipEntry, MyClipTypes } from "./MyClip";
import { getImageSize, isColor, toHex } from "./utils";
import { refreshClipboard } from "./store";
import app from "ags/gtk4/app";

const TMP_DIR = "/tmp/ags-clipvault";
const CLIPVAULT_DIR = `${GLib.get_home_dir()}/.local/share/clipvault`;
const PINNED_FILE = `${CLIPVAULT_DIR}/pinned.json`;

GLib.mkdir_with_parents(CLIPVAULT_DIR, 0o755);
GLib.mkdir_with_parents(TMP_DIR, 0o755);

const imgRe = /binary data.*\b(jpg|jpeg|png|gif|bmp|webp)\b/i;
const itemsLimit = 30;

/** red
 * Extract a valid color using Gdk.RGBA.parse() via isColor()
 */
function extractColorFromText(txt: string): string | null {
  let cleaned = txt.trim().toLowerCase();
  //removes semicolon at the end if exists
  if (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  if (isColor(cleaned)) return toHex(cleaned);
  return null;
}

function detectType(preview: string): {
  type: MyClipTypes;
  color?: string;
  value?: string;
  imgExt?: string;
} {
  const imgMatch = preview.match(imgRe);
  if (imgMatch) {
    return {
      type: MyClipTypes.Image,
      imgExt: imgMatch[1].toLowerCase(),
    };
  }

  const color = extractColorFromText(preview);
  if (color) {
    return { type: MyClipTypes.Color, color, value: preview };
  }

  const isCode =
    preview.includes("\n") ||
    /[{;}]/.test(preview) ||
    /\b(class|function|const|let|var|<\?php)\b/.test(preview) ||
    preview.startsWith("#!/usr/bin/env");

  if (isCode) return { type: MyClipTypes.Code };

  return { type: MyClipTypes.Text };
}

async function getImageFileForId(id: string, ext: string): Promise<string | null> {
  const filePath = `${TMP_DIR}/${id}.${ext}`;

  const qId = GLib.shell_quote(id);
  const qFile = GLib.shell_quote(filePath);

  // ID + TAB → same as your Node version
  const cmd = `printf '%s\\t' ${qId} | clipvault get > ${qFile}`;

  try {
    await execAsync(["sh", "-c", cmd]);
    console.log("Extracted clipvault image to:", filePath);
    if (GLib.file_test(filePath, GLib.FileTest.EXISTS)) return filePath;
  } catch (e) {
    print("clipvault image error:", String(e));
  }

  return null;
}

export async function loadClipvaultEntries(): Promise<MyClipEntry[]> {
  let list = "";
  try {
    list = await execAsync(["sh", "-c", `clipvault list | head -n ${itemsLimit}`]);
  } catch (e) {
    print("clipvault list error:", String(e));
    list = "";
  }

  const pinnedIds = new Set(readPinnedIds());
  const recentEntries: MyClipEntry[] = [];

  for (const raw of list.split("\n")) {
    if (!raw.trim()) continue;

    const [id, txtRaw] = raw.split("\t", 2);
    if (!id || !txtRaw) continue;

    const txt = txtRaw.replace(/\r/g, "");
    console.log("Processing clip ID:", id, txt);
    const detection = detectType(txt);

    const maxlen = 120;
    const preview = txt.length > maxlen ? txt.slice(0, maxlen) + "…" : txt;
    const stared = pinnedIds.has(id);

    // image
    if (detection.type === MyClipTypes.Image && detection.imgExt) {
      const imgPath = await getImageFileForId(id, detection.imgExt);
      const iWH = getImageSize(imgPath || "");
      recentEntries.push({
        id,
        myClipType: MyClipTypes.Image,
        value: imgPath
          ? [imgPath, preview, `${iWH ? `${iWH.width}x${iWH.height}` : "opps, N/A"}`]
          : [preview],
        stared,
      });
      continue;
    }

    // color
    if (detection.type === MyClipTypes.Color && detection.color && detection.value) {
      recentEntries.push({
        id,
        myClipType: MyClipTypes.Color,
        value: [detection.color, detection.value],
        stared,
      });
      continue;
    }

    // code
    if (detection.type === MyClipTypes.Code) {
      recentEntries.push({
        id,
        myClipType: MyClipTypes.Code,
        value: [txt],
        stared,
      });
      continue;
    }

    // default text
    recentEntries.push({
      id,
      myClipType: MyClipTypes.Text,
      value: [preview],
      stared,
    });
  }

  // Now load *all* pinned IDs and ensure they’re present & first
  const pinnedList: MyClipEntry[] = [];
  for (const id of pinnedIds) {
    // try to find in recent entries first
    const existing = recentEntries.find(e => e.id === id);
    if (existing) {
      pinnedList.push(existing);
      continue;
    }

    let txt = "";
    let typeDetected: any = "";

    // Otherwise, ask clipvault for that id directly
    try {
      const line = await execAsync(["sh", "-c", `clipvault list | grep -e '^${id}\t'`]);
      txt = line.replace(/\r/g, "");
      // console.log("Loading pinned clip ID:", `clipvault list | grep  '^${id}'`);
      const detection = detectType(txt);
      typeDetected = detection.type;
      const maxlen = 120;
      const preview = txt.length > maxlen ? txt.slice(0, maxlen) + "…" : txt;

      if (detection.type === MyClipTypes.Image && detection.imgExt) {
        const imgPath = await getImageFileForId(id, detection.imgExt);
        const iWH = getImageSize(imgPath || "");
        pinnedList.push({
          id,
          myClipType: MyClipTypes.Image,
          value: imgPath
            ? [imgPath, preview, `${iWH ? `${iWH.width}x${iWH.height}` : "opps, N/A"}`]
            : [preview],
          stared: true,
        });
      } else if (detection.type === MyClipTypes.Color && detection.color) {
        pinnedList.push({
          id,
          myClipType: MyClipTypes.Color,
          value: [detection.color],
          stared: true,
        });
      } else if (detection.type === MyClipTypes.Code) {
        pinnedList.push({
          id,
          myClipType: MyClipTypes.Code,
          value: [txt],
          stared: true,
        });
      } else {
        pinnedList.push({
          id,
          myClipType: MyClipTypes.Text,
          value: [preview],
          stared: true,
        });
      }
    } catch (e) {
      console.error("load pinned clip error:", {
        error: String(e),
        detectType: typeDetected ?? "none",
        id: id,
        preview: txt
      }
      )
    }
  }

  // De‑duplicate: remove recent entries that are already in pinnedList (by id)
  const pinnedIdsOnly = new Set(pinnedList.map(e => e.id));
  const nonPinnedRecent = recentEntries.filter(e => !pinnedIdsOnly.has(e.id));

  // Pinned first, then rest
  return [...nonPinnedRecent, ...pinnedList];
}

export async function restoreClipToClipboard(id: string): Promise<void> {
  try {
    const list = await execAsync("clipvault list");
    const line = list.split("\n").find((l) => l.startsWith(id + "\t"));
    if (!line) {
      console.error("restore: ID not found:", id);
      return;
    }
    const qLine = GLib.shell_quote(line);
    const cmd = `printf '%s\\n' ${qLine} | clipvault get | wl-copy`;
    console.log("Restoring clip ID:", id);
    execAsync(["sh", "-c", cmd]).catch((e) => {
      console.error("restoreClipToClipboard exec error:", String(e));
    });
    await new Promise(r =>
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        r(null);
        return GLib.SOURCE_REMOVE;
      }),
    );

    console.log("Restored clip ID to clipboard:", id);
    // now it's “safe enough” to quit the app, animation, etc.
    hideClipboardWindow();
  } catch (e) {
    console.error("restoreClipToClipboard error:", String(e));
  }
}

export async function deleteClip(id: string): Promise<void> {
  try {
    const qId = GLib.shell_quote(id);
    const cmd = `printf '%s\\n' ${qId} | clipvault delete`;
    await execAsync(["sh", "-c", cmd]);
    await refreshClipboard();
  } catch (e) {
    print("deleteClip error:", String(e));
  }
}

export async function toggleClipStar(id: string): Promise<void> {
  togglePinned(id);
  await refreshClipboard();
}

function readPinnedIds(): string[] {
  try {
    if (!GLib.file_test(PINNED_FILE, GLib.FileTest.EXISTS)) return [];
    const [ok, contents] = GLib.file_get_contents(PINNED_FILE);
    if (!ok || !contents) return [];
    const text = new TextDecoder().decode(contents as Uint8Array);
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (e) {
    console.error("readPinnedIds error:", String(e));
    return [];
  }
}

function writePinnedIds(ids: string[]) {
  try {
    const text = JSON.stringify(ids, null, 2);
    GLib.file_set_contents(PINNED_FILE, text);
  } catch (e) {
    console.error("writePinnedIds error:", String(e));
  }
}

export function togglePinned(id: string): boolean {
  const current = readPinnedIds();
  const idx = current.indexOf(id);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(id);
  writePinnedIds(current);
  return current.includes(id);
}

function hideClipboardWindow() {
  // look up the window we registered in MyClipManager
  const win = app.windows.find(w => w.name === "adart-clipboard")

  if (win && "hide" in win) {
    (win as any).hide()
  } else {
    // fallback if something goes weird
    app.quit()
  }
}

