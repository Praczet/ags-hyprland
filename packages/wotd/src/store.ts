import Gio from "gi://Gio"
import GLib from "gi://GLib"

import type { WotdCardData, WotdConfig, WotdListener, WotdStore } from "./types"
import { resolveWotdConfig, type ResolvedWotdConfig } from "./config"
import { loadWotdCard } from "./service"

function logWotdError(err: unknown, message: string) {
  logError(err instanceof Error ? err : new Error(String(err)), message)
}

export function createWotdStore(userConfig?: WotdConfig): WotdStore {
  const config: ResolvedWotdConfig = resolveWotdConfig(userConfig)

  let current: WotdCardData | null = null
  let monitor: Gio.FileMonitor | null = null
  let reloadDebounceId: number | null = null

  const listeners = new Set<WotdListener>()

  function emit() {
    for (const listener of listeners) {
      try {
        listener(current)
      } catch (err) {
        logWotdError(err, "[wotd] listener failed")
      }
    }
  }

  function get(): WotdCardData | null {
    return current
  }

  function reload(): WotdCardData | null {
    current = loadWotdCard(config)
    emit()
    return current
  }

  function subscribe(listener: WotdListener): () => void {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  function clearDebounce() {
    if (reloadDebounceId !== null) {
      GLib.Source.remove(reloadDebounceId)
      reloadDebounceId = null
    }
  }

  function queueReload(delayMs = 120) {
    clearDebounce()

    reloadDebounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
      reloadDebounceId = null
      reload()
      return GLib.SOURCE_REMOVE
    })
  }

  function stopWatching() {
    clearDebounce()

    if (monitor) {
      monitor.cancel()
      monitor = null
    }
  }

  function startWatching() {
    if (monitor) return

    try {
      const file = Gio.File.new_for_path(config.cardPath)
      monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null)

      monitor.connect("changed", (_monitor, _file, _otherFile, eventType) => {
        switch (eventType) {
          case Gio.FileMonitorEvent.CHANGES_DONE_HINT:
          case Gio.FileMonitorEvent.CREATED:
          case Gio.FileMonitorEvent.CHANGED:
          case Gio.FileMonitorEvent.MOVED_IN:
            queueReload()
            break
          default:
            break
        }
      })
    } catch (err) {
      logWotdError(err, `[wotd] failed to watch file: ${config.cardPath}`)
    }
  }

  function destroy() {
    stopWatching()
    listeners.clear()
    current = null
  }

  current = loadWotdCard(config)

  return {
    get,
    reload,
    subscribe,
    startWatching,
    stopWatching,
    destroy,
  }
}

let sharedStore: WotdStore | null = null

export function getWotdStore(config?: WotdConfig): WotdStore {
  if (!sharedStore) {
    sharedStore = createWotdStore(config)
  }

  return sharedStore
}

export function destroyWotdStore() {
  if (!sharedStore) return
  sharedStore.destroy()
  sharedStore = null
}
