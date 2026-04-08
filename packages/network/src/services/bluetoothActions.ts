import GLib from "gi://GLib"
import { runCommand } from "./command"

type CreateBluetoothActionsOptions = {
  logAction: (action: string, command?: string) => void
  refresh: () => Promise<void>
  setBluetoothScanning: (value: boolean) => void
}

export function createBluetoothActions({
  logAction,
  refresh,
  setBluetoothScanning,
}: CreateBluetoothActionsOptions) {
  const setBluetoothEnabled = async (enabled: boolean) => {
    const cmd = enabled ? "bluetoothctl power on" : "bluetoothctl power off"
    logAction("Toggle Bluetooth", cmd)
    runCommand(cmd)
    await refresh()
  }

  const scanBluetooth = async () => {
    const cmd = "bluetoothctl scan on"
    logAction("Scan Bluetooth", cmd)
    setBluetoothScanning(true)
    try {
      GLib.spawn_command_line_async(cmd)
    } catch (err) {
      console.error("network bluetooth scan error", err)
      setBluetoothScanning(false)
      return
    }
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
      refresh().catch(err => console.error("network refresh error", err))
      return GLib.SOURCE_REMOVE
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5200, () => {
      runCommand("bluetoothctl scan off")
      refresh().catch(err => console.error("network refresh error", err))
      setBluetoothScanning(false)
      return GLib.SOURCE_REMOVE
    })
  }

  const pairBluetooth = async (id: string) => {
    const cmd = `bluetoothctl pair ${id}`
    logAction("Pair Bluetooth device", cmd)
    runCommand(cmd)
    runCommand(`bluetoothctl connect ${id}`)
    await refresh()
  }

  const connectBluetooth = async (id: string) => {
    const cmd = `bluetoothctl connect ${id}`
    logAction("Connect Bluetooth device", cmd)
    runCommand(cmd)
    await refresh()
  }

  const disconnectBluetooth = async (id: string) => {
    const cmd = `bluetoothctl disconnect ${id}`
    logAction("Disconnect Bluetooth device", cmd)
    runCommand(cmd)
    await refresh()
  }

  const removeBluetooth = async (id: string) => {
    const cmd = `bluetoothctl remove ${id}`
    logAction("Forget Bluetooth device", cmd)
    runCommand(cmd)
    await refresh()
  }

  return {
    setBluetoothEnabled,
    scanBluetooth,
    pairBluetooth,
    connectBluetooth,
    disconnectBluetooth,
    removeBluetooth,
  }
}
