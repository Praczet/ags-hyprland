import { createState, createMemo } from "ags";
import type { MyClipEntry } from "./MyClip";
import { loadClipvaultEntries } from "./MyClipVault";

export const [searchTerm, setSearchTerm] = createState("");
export const [showOnlyStarred, setShowOnlyStarred] = createState(false);
export const [clipboardItems, setClipboardItems] =
  createState<MyClipEntry[]>([]);

export const filteredItems = createMemo(() => {
  const term = searchTerm().toLowerCase();
  const onlyStarred = showOnlyStarred();
  const items = clipboardItems();

  const filtered = onlyStarred
    ? items.filter((item) => item.stared)
    : items;

  if (!term) return filtered;

  return filtered.filter((item) => {
    const raw = Array.isArray(item.value) ? item.value.join(" ") : item.value;
    return raw.toLowerCase().includes(term);
  });
});

export async function refreshClipboard() {
  const items = await loadClipvaultEntries();
  setClipboardItems(items);
}
