import type { BluetoothDevice, BluetoothInfo } from "../types"
import { runCommand } from "./command"

type ParsedBluetoothInfo = Pick<BluetoothDevice, "name" | "connected" | "paired" | "trusted" | "battery">

function parseBluetoothShow(out: string): Omit<BluetoothInfo, "paired" | "devices"> {
  const result: Omit<BluetoothInfo, "paired" | "devices"> = {}
  const lines = out.split("\n").map(line => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.startsWith("Controller ")) {
      const parts = line.split(/\s+/)
      result.address = parts[1]
      continue
    }
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key === "Name" || key === "Alias") {
      if (!result.name) result.name = value
    } else if (key === "Powered") {
      result.powered = value.toLowerCase() === "yes"
    } else if (key === "Discoverable") {
      result.discoverable = value.toLowerCase() === "yes"
    }
  }
  return result
}

function parseBluetoothDevices(out: string): BluetoothDevice[] {
  const lines = out.split("\n").map(line => line.trim()).filter(Boolean)
  const devices: BluetoothDevice[] = []
  for (const line of lines) {
    const parts = line.split(/\s+/)
    if (parts[0] !== "Device" || parts.length < 2) continue
    const id = parts[1]
    const name = parts.slice(2).join(" ").trim()
    devices.push({ id, name: name || undefined })
  }
  return devices
}

function parseBluetoothInfo(out: string): ParsedBluetoothInfo {
  const result: ParsedBluetoothInfo = {}
  const lines = out.split("\n").map(line => line.trim()).filter(Boolean)
  for (const line of lines) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key === "Name" || key === "Alias") {
      if (!result.name) result.name = value
    } else if (key === "Connected") {
      result.connected = value.toLowerCase() === "yes"
    } else if (key === "Paired") {
      result.paired = value.toLowerCase() === "yes"
    } else if (key === "Trusted") {
      result.trusted = value.toLowerCase() === "yes"
    } else if (key === "Battery Percentage") {
      const hexMatch = value.match(/0x([0-9a-fA-F]+)/)
      if (hexMatch) {
        result.battery = parseInt(hexMatch[1], 16)
      } else {
        const match = value.match(/(\d+)\s*%?/)
        if (match) result.battery = Number(match[1])
      }
    }
  }
  return result
}

export function getBluetoothInfo(): BluetoothInfo | null {
  const showOut = runCommand("bluetoothctl show")
  if (!showOut) return null
  const base = parseBluetoothShow(showOut)
  const devicesOut = runCommand("bluetoothctl devices") ?? ""
  const pairedOut = runCommand("bluetoothctl devices Paired") ?? ""
  const connectedOut = runCommand("bluetoothctl devices Connected") ?? ""
  const connected = new Set(parseBluetoothDevices(connectedOut).map(d => d.id))
  const paired = parseBluetoothDevices(pairedOut)
  const pairedIds = new Set(paired.map(p => p.id))
  for (const id of connected) {
    if (!pairedIds.has(id)) {
      paired.push({ id })
      pairedIds.add(id)
    }
  }
  const devices = parseBluetoothDevices(devicesOut).filter(d => !pairedIds.has(d.id))
  const detailedPaired = paired.map(device => {
    const infoOut = runCommand(`bluetoothctl info ${device.id}`)
    const info = infoOut ? parseBluetoothInfo(infoOut) : {}
    const name = device.name ?? info.name
    return { ...device, ...info, name, paired: true, connected: connected.has(device.id) || info.connected }
  })
  return {
    ...base,
    paired: detailedPaired,
    devices,
  }
}
