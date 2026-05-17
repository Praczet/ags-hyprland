import GLib from "gi://GLib"
import type { ConnectionDetails, NetworkState } from "../types"
import { createBluetoothActions } from "./bluetoothActions"
import { runCommand, runCommandChecked, splitNmcliLine } from "./command"
import { invalidateNetworkReadCache } from "./readState"

type CreateNetworkActionsOptions = {
  getCurrentData: () => NetworkState | null
  logAction: (action: string, command?: string) => void
  refresh: () => Promise<void>
  setScanning: (value: boolean) => void
  setWifiBusy: (value: boolean) => void
  setPendingWifiEnabled: (value: boolean | null) => void
  setBluetoothScanning: (value: boolean) => void
}

export function createNetworkActions({
  getCurrentData,
  logAction,
  refresh,
  setScanning,
  setWifiBusy,
  setPendingWifiEnabled,
  setBluetoothScanning,
}: CreateNetworkActionsOptions) {
  let pendingWifiTimeout: number | null = null

  const setWifiEnabled = async (enabled: boolean) => {
    const cmd = enabled ? "nmcli radio wifi on" : "nmcli radio wifi off"
    logAction("Toggle Wi-Fi", cmd)
    if (pendingWifiTimeout !== null) {
      GLib.source_remove(pendingWifiTimeout)
      pendingWifiTimeout = null
    }
    setPendingWifiEnabled(enabled)
    pendingWifiTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 8000, () => {
      pendingWifiTimeout = null
      setPendingWifiEnabled(null)
      return GLib.SOURCE_REMOVE
    })
    setWifiBusy(true)
    try {
      runCommand(cmd)
      invalidateNetworkReadCache()
      await refresh()
    } finally {
      setWifiBusy(false)
    }
  }

  const setWiredEnabled = async (enabled: boolean) => {
    const current = getCurrentData()
    const device = current?.wired?.device
    if (!device) return
    const safeDevice = device.replace(/"/g, "\\\"")
    const cmd = enabled ? `nmcli dev connect "${safeDevice}"` : `nmcli dev disconnect "${safeDevice}"`
    logAction("Toggle wired", cmd)
    runCommand(cmd)
    invalidateNetworkReadCache({ connections: true })
    await refresh()
  }

  const bluetoothActions = createBluetoothActions({
    logAction,
    refresh,
    setBluetoothScanning,
  })

  const scanWifi = async () => {
    const cmd = "nmcli dev wifi rescan"
    logAction("Scan Wi-Fi", cmd)
    const startedAt = Date.now()
    setScanning(true)
    try {
      runCommand(cmd)
      invalidateNetworkReadCache({ wifi: true })
      await refresh()
    } finally {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, 700 - elapsed)
      if (remaining > 0) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
          setScanning(false)
          return GLib.SOURCE_REMOVE
        })
      } else {
        setScanning(false)
      }
    }
  }

  const connectWifi = async (ssid: string, password?: string) => {
    const safeSsid = ssid.replace(/"/g, "\\\"")
    const cmd = password
      ? `nmcli dev wifi connect "${safeSsid}" password "${password.replace(/"/g, "\\\"")}"`
      : `nmcli dev wifi connect "${safeSsid}"`
    const logCmd = password ? `nmcli dev wifi connect "${safeSsid}" password "****"` : cmd
    logAction("Connect Wi-Fi", logCmd)
    runCommandChecked(cmd)
    invalidateNetworkReadCache()
    await refresh()
  }

  const connectSaved = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli connection up "${safeName}"`
    logAction("Connect saved", cmd)
    runCommandChecked(cmd)
    invalidateNetworkReadCache()
    await refresh()
  }

  const disconnectConnection = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli connection down "${safeName}"`
    logAction("Disconnect", cmd)
    runCommand(cmd)
    invalidateNetworkReadCache()
    await refresh()
  }

  const forgetConnection = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli connection delete "${safeName}"`
    logAction("Forget network", cmd)
    runCommand(cmd)
    invalidateNetworkReadCache()
    await refresh()
  }

  const getWifiPassword = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli -s -g 802-11-wireless-security.psk connection show "${safeName}"`
    logAction("Fetch Wi-Fi password", cmd)
    const out = runCommand(cmd)
    return out?.trim() || null
  }

  const getConnectionDetails = async (name: string): Promise<ConnectionDetails> => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = "nmcli -t -g 802-11-wireless.ssid,802-11-wireless-security.key-mgmt,connection.timestamp connection show"
    logAction("Fetch connection details", `${cmd} "${safeName}"`)
    const out = runCommand(`${cmd} "${safeName}"`)
    if (!out) return {}
    const trimmed = out.trim()
    const lines = trimmed.split("\n").map(line => line.trim()).filter(Boolean)
    const parts = lines.length >= 2 ? lines : splitNmcliLine(trimmed)
    const [ssidRaw, securityRaw, tsRaw] = parts
    const ts = Number(tsRaw)
    return {
      ssid: ssidRaw || undefined,
      security: securityRaw || undefined,
      lastConnected: Number.isFinite(ts) && ts > 0 ? ts : undefined,
    }
  }

  return {
    setWifiEnabled,
    setWiredEnabled,
    scanWifi,
    connectWifi,
    connectSaved,
    disconnectConnection,
    forgetConnection,
    getWifiPassword,
    getConnectionDetails,
    ...bluetoothActions,
  }
}
