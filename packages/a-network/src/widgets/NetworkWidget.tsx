import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { getNetworkService } from "../services/networkService"
import type { NetworkAction, NetworkWidgetConfig, SavedConnection, WifiNetwork } from "../types"

function formatSignal(signal?: number) {
  if (!Number.isFinite(Number(signal))) return "--"
  return `${Math.round(Number(signal))}%`
}

function signalIcon(signal?: number) {
  if (!Number.isFinite(Number(signal))) return "network-wireless-signal-none-symbolic"
  const value = Number(signal)
  if (value >= 80) return "network-wireless-signal-excellent-symbolic"
  if (value >= 60) return "network-wireless-signal-good-symbolic"
  if (value >= 40) return "network-wireless-signal-ok-symbolic"
  if (value >= 20) return "network-wireless-signal-weak-symbolic"
  return "network-wireless-signal-none-symbolic"
}

function isSecure(security?: string) {
  if (!security) return false
  const norm = security.toLowerCase()
  return norm !== "--" && norm !== "none" && norm !== "open"
}

function createInfoIcon() {
  const label = new Gtk.Label({ label: "?" })
  label.add_css_class("a-network-info-icon")
  return label
}

function buildSection(
  title: string,
  headerRight: Gtk.Widget | null,
  body: Gtk.Widget,
  expanded = true,
  infoIcon?: Gtk.Widget,
  collapsible = true,
  pillClass?: string,
) {
  const wrapper = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
  wrapper.add_css_class("a-network-section")
  wrapper.set_hexpand(true)

  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  header.add_css_class("a-network-section-header")
  header.add_css_class("a-network-section-pill")
  if (pillClass) header.add_css_class(pillClass)
  header.set_hexpand(true)
  const label = new Gtk.Label({ label: title, xalign: 0 })
  label.add_css_class("a-network-section-title")
  label.set_hexpand(true)

  const chevron = new Gtk.Label({ label: expanded ? "▾" : "▸", xalign: 1 })
  chevron.add_css_class("a-network-chevron")

  header.append(label)
  if (infoIcon) header.append(infoIcon)
  if (headerRight) header.append(headerRight)
  header.append(chevron)

  const reveal = new Gtk.Revealer({ reveal_child: expanded })
  reveal.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  reveal.set_child(body)

  if (collapsible) {
    const click = new Gtk.GestureClick()
    click.connect("released", () => {
      const next = !reveal.get_reveal_child()
      reveal.set_reveal_child(next)
      chevron.set_label(next ? "▾" : "▸")
    })
    header.add_controller(click)
  }

  wrapper.append(header)
  wrapper.append(reveal)
  return wrapper
}

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    box.remove(child)
    child = box.get_first_child()
  }
}

function updateHistoryList(box: Gtk.Box, history: NetworkAction[]) {
  clearBox(box)
  if (!history.length) {
    box.append(new Gtk.Label({ label: "No recent actions", xalign: 0 }))
    return
  }
  for (const entry of history) {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
    row.add_css_class("a-network-history-row")
    const label = new Gtk.Label({ label: entry.action, xalign: 0 })
    label.add_css_class("a-network-history-label")
    const meta = new Gtk.Label({
      label: entry.command ? entry.command : new Date(entry.ts).toLocaleTimeString(),
      xalign: 0,
    })
    meta.add_css_class("a-network-history-meta")
    row.append(label)
    row.append(meta)
    box.append(row)
  }
}

function buildWifiQr(ssid: string, password: string) {
  if (!GLib.find_program_in_path("qrencode")) return null
  const tmpDir = GLib.get_tmp_dir()
  const safe = ssid.replace(/[^a-zA-Z0-9_-]/g, "_")
  const path = `${tmpDir}/a-network-${safe}-${Date.now()}.png`
  const payload = `WIFI:T:WPA;S:${ssid};P:${password};;`
  const cmd = `qrencode -o "${path}" "${payload.replace(/"/g, "\\\"")}"`
  const out = GLib.spawn_command_line_sync(cmd)
  if (!out?.[0]) return null
  return path
}

function buildWifiRow(iface: WifiNetwork, isKnown: boolean, onConnect: (password?: string) => void) {
  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.add_css_class("a-network-row")

  const wrap = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  const icon = new Gtk.Image({ pixel_size: 16 })
  icon.set_from_icon_name(signalIcon(iface.signal))
  const label = new Gtk.Label({ label: iface.ssid, xalign: 0 })
  label.set_hexpand(true)
  const lock = isSecure(iface.security) ? new Gtk.Image({ pixel_size: 14 }) : null
  if (lock) lock.set_from_icon_name("network-wireless-encrypted-symbolic")
  const meta = new Gtk.Label({ label: `${formatSignal(iface.signal)} ${iface.security ?? "--"}`, xalign: 1 })
  meta.add_css_class("a-network-row-meta")

  wrap.append(icon)
  wrap.append(label)
  if (lock) wrap.append(lock)
  wrap.append(meta)
  wrap.set_hexpand(true)

  const connectBtn = new Gtk.Button({ label: "Connect" })
  connectBtn.add_css_class("a-network-action")

  row.append(wrap)
  row.append(connectBtn)

  const details = new Gtk.Revealer({ reveal_child: false })
  details.set_visible(false)
  const detailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  detailsBox.add_css_class("a-network-row-details")
  const password = new Gtk.Entry()
  password.set_visibility(false)
  password.set_placeholder_text("Password")
  const confirm = new Gtk.Button({ label: "Join" })
  confirm.add_css_class("a-network-action")
  detailsBox.append(password)
  detailsBox.append(confirm)
  details.set_child(detailsBox)

  if (!isKnown && isSecure(iface.security)) {
    details.set_visible(true)
    connectBtn.connect("clicked", () => {
      details.set_reveal_child(!details.get_reveal_child())
    })
    confirm.connect("clicked", () => {
      onConnect(password.get_text() || undefined)
    })
  } else {
    connectBtn.connect("clicked", () => onConnect())
  }

  container.append(row)
  container.append(details)
  return container
}

function buildSavedRow(saved: SavedConnection, onConnect: () => void, onForget: () => void, onShare: () => void) {
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  row.add_css_class("a-network-row")

  const label = new Gtk.Label({ label: saved.name, xalign: 0 })
  label.set_hexpand(true)
  if (saved.active) label.add_css_class("a-network-active")

  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  const connectBtn = new Gtk.Button({ label: saved.active ? "Disconnect" : "Connect" })
  connectBtn.add_css_class("a-network-action")
  connectBtn.connect("clicked", onConnect)
  const shareBtn = new Gtk.Button({ label: "Share" })
  shareBtn.add_css_class("a-network-action")
  shareBtn.connect("clicked", onShare)
  const forgetBtn = new Gtk.Button({ label: "Forget" })
  forgetBtn.add_css_class("a-network-action")
  forgetBtn.connect("clicked", onForget)

  actions.append(connectBtn)
  actions.append(shareBtn)
  actions.append(forgetBtn)

  row.append(label)
  row.append(actions)
  return row
}

export function NetworkWidget(cfg: NetworkWidgetConfig = {}) {
  const service = getNetworkService()
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  root.add_css_class("a-network-root")
  if (cfg.windowLess) root.add_css_class("a-network-windowless")
  let activeConnectionName: string | undefined

  const wifiSwitch = new Gtk.Switch()
  wifiSwitch.add_css_class("a-network-switch")
  wifiSwitch.set_hexpand(false)
  wifiSwitch.set_halign(Gtk.Align.END)
  wifiSwitch.set_valign(Gtk.Align.CENTER)
  wifiSwitch.set_vexpand(false)
  wifiSwitch.connect("notify::active", () => {
    service.setWifiEnabled(wifiSwitch.get_active()).catch(err => console.error("a-network wifi toggle error", err))
  })
  const scanBtn = new Gtk.Button()
  scanBtn.add_css_class("a-network-action")
  scanBtn.add_css_class("a-network-icon-button")
  const scanIcon = new Gtk.Image({ pixel_size: 16 })
  scanIcon.set_from_icon_name("view-refresh-symbolic")
  const scanSpinner = new Gtk.Spinner()
  scanSpinner.set_spinning(false)
  const scanStack = new Gtk.Stack()
  scanStack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  scanStack.set_transition_duration(120)
  scanStack.add_named(scanIcon, "icon")
  scanStack.add_named(scanSpinner, "spin")
  scanStack.set_visible_child_name("icon")
  scanBtn.set_child(scanStack)
  scanBtn.set_valign(Gtk.Align.CENTER)
  scanBtn.set_vexpand(false)
  scanBtn.connect("clicked", () => {
    service.scanWifi().catch(err => console.error("a-network scan error", err))
  })

  const wifiOff = new Gtk.Label({ label: "Wi-Fi is off", xalign: 0 })
  wifiOff.add_css_class("a-network-muted")
  wifiOff.set_visible(false)
  const wifiHeaderRight = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  wifiHeaderRight.set_halign(Gtk.Align.END)
  wifiHeaderRight.append(wifiOff)
  wifiHeaderRight.append(scanBtn)
  wifiHeaderRight.append(wifiSwitch)

  const wifiBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  wifiBody.add_css_class("a-network-section-body")
  const wifiReveal = new Gtk.Revealer({ reveal_child: true })
  wifiReveal.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
  wifiReveal.set_child(wifiBody)
  const wifiConnectedTitle = new Gtk.Label({ label: "Connected", xalign: 0 })
  wifiConnectedTitle.add_css_class("a-network-subtitle")
  wifiConnectedTitle.set_visible(false)
  const connectedRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  connectedRow.add_css_class("a-network-row")
  connectedRow.set_visible(false)
  const connectedIcon = new Gtk.Image({ pixel_size: 16 })
  const connectedLabel = new Gtk.Label({ label: "--", xalign: 0 })
  connectedLabel.set_hexpand(true)
  const connectedMeta = new Gtk.Label({ label: "--", xalign: 1 })
  connectedMeta.add_css_class("a-network-row-meta")
  const connectedActions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  connectedActions.set_halign(Gtk.Align.END)
  const connectedDetailsBtn = new Gtk.Button({ label: "Details" })
  connectedDetailsBtn.add_css_class("a-network-action")
  const connectedDisconnectBtn = new Gtk.Button({ label: "Disconnect" })
  connectedDisconnectBtn.add_css_class("a-network-action")
  connectedActions.append(connectedDetailsBtn)
  connectedActions.append(connectedDisconnectBtn)
  connectedRow.append(connectedIcon)
  connectedRow.append(connectedLabel)
  connectedRow.append(connectedMeta)
  connectedRow.append(connectedActions)
  const connectedDetailsReveal = new Gtk.Revealer({ reveal_child: false })
  connectedDetailsReveal.set_visible(false)
  const connectedDetails = new Gtk.Label({ label: "", xalign: 0 })
  connectedDetails.add_css_class("a-network-row-meta")
  connectedDetailsReveal.set_child(connectedDetails)
  connectedDetailsBtn.connect("clicked", () => {
    connectedDetailsReveal.set_reveal_child(!connectedDetailsReveal.get_reveal_child())
  })
  connectedDisconnectBtn.connect("clicked", () => {
    if (!activeConnectionName) return
    service.disconnectConnection(activeConnectionName).catch(err => console.error("a-network disconnect error", err))
  })

  const wifiNearbyTitle = new Gtk.Label({ label: "Nearby", xalign: 0 })
  wifiNearbyTitle.add_css_class("a-network-subtitle")
  const wifiNearbyList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const wifiNearbyScroll = new Gtk.ScrolledWindow()
  wifiNearbyScroll.add_css_class("a-network-list-scroll")
  wifiNearbyScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  wifiNearbyScroll.set_propagate_natural_height(true)
  wifiNearbyScroll.set_hexpand(true)
  wifiNearbyScroll.set_max_content_height(360)
  wifiNearbyScroll.set_child(wifiNearbyList)

  const wifiSavedTitle = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  wifiSavedTitle.add_css_class("a-network-subtitle")
  wifiSavedTitle.add_css_class("a-network-toggle")
  const wifiSavedChevron = new Gtk.Label({ label: "▸", xalign: 0 })
  wifiSavedChevron.add_css_class("a-network-chevron")
  const wifiSavedLabel = new Gtk.Label({ label: "Saved", xalign: 0 })
  const wifiSavedEmpty = new Gtk.Label({ label: "", xalign: 0 })
  wifiSavedEmpty.add_css_class("a-network-muted")
  wifiSavedTitle.append(wifiSavedChevron)
  wifiSavedTitle.append(wifiSavedLabel)
  wifiSavedTitle.append(wifiSavedEmpty)
  const wifiSavedList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const wifiSavedScroll = new Gtk.ScrolledWindow()
  wifiSavedScroll.add_css_class("a-network-saved-scroll")
  wifiSavedScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  wifiSavedScroll.set_propagate_natural_height(true)
  wifiSavedScroll.set_hexpand(true)
  wifiSavedScroll.set_max_content_height(360)
  wifiSavedScroll.set_child(wifiSavedList)
  const wifiSavedReveal = new Gtk.Revealer({ reveal_child: false })
  wifiSavedReveal.set_child(wifiSavedScroll)
  const savedClick = new Gtk.GestureClick()
  savedClick.connect("released", () => {
    const next = !wifiSavedReveal.get_reveal_child()
    wifiSavedReveal.set_reveal_child(next)
    wifiSavedChevron.set_label(next ? "▾" : "▸")
  })
  wifiSavedTitle.add_controller(savedClick)


  wifiBody.append(wifiConnectedTitle)
  wifiBody.append(connectedRow)
  wifiBody.append(connectedDetailsReveal)
  wifiBody.append(wifiNearbyTitle)
  wifiBody.append(wifiNearbyScroll)
  wifiBody.append(wifiSavedTitle)
  wifiBody.append(wifiSavedReveal)

  const wifiInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const firstPill = "a-network-pill-first"
  const middlePill = "a-network-pill-middle"
  const lastPill = "a-network-pill-last"
  const wifiSection = buildSection("Wi-Fi", wifiHeaderRight, wifiReveal, true, wifiInfoIcon, true, firstPill)

  const wiredBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  wiredBody.add_css_class("a-network-section-body")
  const wiredStatus = new Gtk.Label({ label: "No wired connection", xalign: 0 })
  wiredBody.append(wiredStatus)
  const wiredInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const wiredSection = buildSection("Wired", null, wiredBody, false, wiredInfoIcon, true, middlePill)

  const vpnBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  vpnBody.add_css_class("a-network-section-body")
  const vpnList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  const vpnScroll = new Gtk.ScrolledWindow()
  vpnScroll.add_css_class("a-network-list-scroll")
  vpnScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  vpnScroll.set_propagate_natural_height(true)
  vpnScroll.set_hexpand(true)
  vpnScroll.set_max_content_height(240)
  vpnScroll.set_child(vpnList)
  vpnBody.append(vpnScroll)
  const vpnInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const vpnSection = buildSection("VPN", null, vpnBody, false, vpnInfoIcon, true, middlePill)

  const hotspotBody = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  hotspotBody.add_css_class("a-network-section-body")
  const hotspotStatus = new Gtk.Label({ label: "Hotspot disabled", xalign: 0 })
  hotspotBody.append(hotspotStatus)
  const hotspotInfoIcon = cfg.educationModeOn && cfg.educationModeDetail === "tooltip" ? createInfoIcon() : undefined
  const hotspotSection = buildSection("Hotspot", null, hotspotBody, false, hotspotInfoIcon, true, lastPill)

  const footer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  footer.add_css_class("a-network-education")
  const footerLabel = new Gtk.Label({ label: "Education mode", xalign: 0 })
  footerLabel.add_css_class("a-network-education-label")
  const footerHistory = new Gtk.Revealer({ reveal_child: false })
  const footerHistoryBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  footerHistoryBox.add_css_class("a-network-history")
  footerHistory.set_child(footerHistoryBox)
  footer.append(footerLabel)
  footer.append(footerHistory)

  footerLabel.add_controller(
    (() => {
      const click = new Gtk.GestureClick()
      click.connect("released", () => {
        footerHistory.set_reveal_child(!footerHistory.get_reveal_child())
      })
      return click
    })(),
  )

  const panel = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  panel.add_css_class("a-network-education-panel")
  const panelTitle = new Gtk.Label({ label: "Education", xalign: 0 })
  panelTitle.add_css_class("a-network-subtitle")
  const panelHistory = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  panelHistory.add_css_class("a-network-history")
  panel.append(panelTitle)
  panel.append(panelHistory)

  const lastFooter = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  lastFooter.add_css_class("a-network-footer")
  const lastFooterLabel = new Gtk.Label({ label: "Last: --", xalign: 0 })
  lastFooterLabel.add_css_class("a-network-footer-label")
  lastFooter.append(lastFooterLabel)

  root.append(wifiSection)
  root.append(wiredSection)
  root.append(vpnSection)
  root.append(hotspotSection)

  if (cfg.educationModeOn && cfg.educationModeDetail === "panel") {
    root.append(panel)
  } else if (cfg.educationModeOn && cfg.educationModeDetail === "footer") {
    root.append(footer)
  }
  root.append(lastFooter)

  const shareBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  shareBox.add_css_class("a-network-share")
  const shareLabel = new Gtk.Label({ label: "", xalign: 0 })
  const sharePassword = new Gtk.Label({ label: "", xalign: 0 })
  const shareImage = new Gtk.Image()
  shareImage.set_visible(false)
  shareBox.append(shareLabel)
  shareBox.append(sharePassword)
  shareBox.append(shareImage)
  shareBox.set_visible(false)
  wifiBody.append(shareBox)

  createEffect(() => {
    const data = service.data()
    if (!data) return

    const wifiEnabled = Boolean(data.wifiEnabled)
    wifiSwitch.set_active(wifiEnabled)
    scanBtn.set_visible(wifiEnabled)
    wifiReveal.set_reveal_child(wifiEnabled)
    wifiOff.set_visible(!wifiEnabled)
    if (!wifiEnabled) {
      const busy = service.wifiBusy()
      wifiOff.set_label(busy && wifiSwitch.get_active() ? "Turning Wi-Fi on..." : "Wi-Fi is off")
    }
    if (data.activeWifi) {
      activeConnectionName = data.activeWifiConnectionName ?? data.activeWifi.ssid
      wifiConnectedTitle.set_visible(true)
      connectedRow.set_visible(true)
      connectedDetailsReveal.set_visible(true)
      connectedIcon.set_from_icon_name(signalIcon(data.activeWifi.signal))
      connectedLabel.set_label(data.activeWifi.ssid)
      connectedMeta.set_label(`${formatSignal(data.activeWifi.signal)} ${data.activeWifi.security ?? "--"}`)
      connectedDetails.set_label(`Security: ${data.activeWifi.security ?? "--"} | Signal: ${formatSignal(data.activeWifi.signal)}`)
    } else {
      activeConnectionName = undefined
      wifiConnectedTitle.set_visible(false)
      connectedRow.set_visible(false)
      connectedDetailsReveal.set_visible(false)
      connectedDetailsReveal.set_reveal_child(false)
    }

    clearBox(wifiNearbyList)
    const available = data.wifi.filter(iface => !iface.inUse)
    if (!available.length) {
      wifiNearbyList.append(new Gtk.Label({ label: "No networks found", xalign: 0 }))
    } else {
      const known = new Map(
        data.savedWifi.flatMap(entry => {
          const pairs: Array<[string, string]> = []
          const ssid = entry.ssid ?? entry.name
          if (ssid) {
            pairs.push([ssid, entry.name])
            pairs.push([ssid.toLowerCase(), entry.name])
          }
          if (entry.name) {
            pairs.push([entry.name, entry.name])
            pairs.push([entry.name.toLowerCase(), entry.name])
          }
          return pairs
        }),
      )
      for (const iface of available) {
        const savedName = known.get(iface.ssid) ?? known.get(iface.ssid.toLowerCase())
        const isKnown = Boolean(savedName)
        wifiNearbyList.append(buildWifiRow(iface, isKnown, (password) => {
          if (isKnown) {
            service.connectSaved(savedName ?? iface.ssid).catch(err => console.error("a-network connect error", err))
            return
          }
          service.connectWifi(iface.ssid, password).catch(err => console.error("a-network connect error", err))
        }))
      }
    }

    clearBox(wifiSavedList)
    const nearbyNames = new Set(available.map(item => item.ssid.toLowerCase()))
    const savedCount = data.savedWifi.length
    wifiSavedEmpty.set_label(`(${savedCount})`)
    if (!savedCount) {
      wifiSavedList.append(new Gtk.Label({ label: "No saved networks", xalign: 0 }))
    } else {
      for (const saved of data.savedWifi) {
        const row = buildSavedRow(
          saved,
          () => {
            if (saved.active) {
              service.disconnectConnection(saved.name).catch(err => console.error("a-network disconnect error", err))
            } else {
              service.connectSaved(saved.name).catch(err => console.error("a-network connect error", err))
            }
          },
          () => service.forgetConnection(saved.name).catch(err => console.error("a-network forget error", err)),
          async () => {
            shareBox.set_visible(true)
            shareLabel.set_label(`Share: ${saved.name}`)
            sharePassword.set_label("")
            shareImage.set_visible(false)
            const pass = await service.getWifiPassword(saved.name)
            if (cfg.showPlainTextPassword && pass) {
              sharePassword.set_label(pass)
            } else if (cfg.showPlainTextPassword) {
              sharePassword.set_label("Password unavailable")
            }
            if (cfg.showQRPassword && pass) {
              const qrPath = buildWifiQr(saved.name, pass)
              if (qrPath) {
                shareImage.set_from_file(qrPath)
                shareImage.set_visible(true)
              }
            }
          },
        )
        const savedKey = (saved.ssid ?? saved.name).toLowerCase()
        if (!nearbyNames.has(savedKey) && !saved.active) {
          row.add_css_class("a-network-muted")
        }
        wifiSavedList.append(row)
      }
    }

    const wired = data.wired
    if (wired?.device) {
      const state = wired.state ?? "unknown"
      const ip = wired.ip ? ` (${wired.ip})` : ""
      wiredStatus.set_label(`${wired.device} ${state}${ip}`)
    } else {
      wiredStatus.set_label("No wired connection")
    }

    clearBox(vpnList)
    if (!data.vpn.length) {
      vpnList.append(new Gtk.Label({ label: "No active VPN", xalign: 0 }))
    } else {
      for (const vpn of data.vpn) {
        const row = new Gtk.Label({ label: vpn.name, xalign: 0 })
        row.add_css_class("a-network-row")
        vpnList.append(row)
      }
    }

    if (data.hotspot?.active) {
      hotspotStatus.set_label(`Hotspot active: ${data.hotspot.name ?? "unknown"}`)
    } else {
      hotspotStatus.set_label("Hotspot disabled")
    }
  }, { immediate: true })

  let spinTimer: number | null = null
  let spinUntil = 0
  const stopSpin = () => {
    scanSpinner.stop()
    scanStack.set_visible_child_name("icon")
    if (spinTimer) {
      GLib.source_remove(spinTimer)
      spinTimer = null
    }
  }

  const startSpin = (minMs: number) => {
    spinUntil = Date.now() + minMs
    scanStack.set_visible_child_name("spin")
    scanSpinner.start()
  }

  scanBtn.connect("clicked", () => {
    startSpin(900)
  })

  createEffect(() => {
    const spinning = service.scanning()
    if (spinning) {
      startSpin(900)
      return
    }
    const remaining = Math.max(0, spinUntil - Date.now())
    if (remaining > 0) {
      if (spinTimer) GLib.source_remove(spinTimer)
      spinTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
        stopSpin()
        return GLib.SOURCE_REMOVE
      })
      return
    }
    stopSpin()
  }, { immediate: true })

  createEffect(() => {
    const history = service.history()
    if (!cfg.educationModeOn) return
    const latest = history[0]
    const tooltip = latest ? `${latest.action}\n${latest.command ?? ""}`.trim() : "No recent actions"
    if (wifiInfoIcon) wifiInfoIcon.set_tooltip_text(tooltip)
    if (wiredInfoIcon) wiredInfoIcon.set_tooltip_text(tooltip)
    if (vpnInfoIcon) vpnInfoIcon.set_tooltip_text(tooltip)
    if (hotspotInfoIcon) hotspotInfoIcon.set_tooltip_text(tooltip)

    if (cfg.educationModeDetail === "footer") {
      footerLabel.set_label(latest ? `Education: ${latest.action}` : "Education: idle")
      updateHistoryList(footerHistoryBox, history)
    }
    if (cfg.educationModeDetail === "panel") {
      updateHistoryList(panelHistory, history)
    }
  }, { immediate: true })

  createEffect(() => {
    const history = service.history()
    const latest = history[0]
    const cmd = latest?.command ? ` • ${latest.command}` : ""
    lastFooterLabel.set_label(latest ? `Last: ${latest.action}${cmd}` : "Last: --")
  }, { immediate: true })

  const refreshConfig = {
    allowBackgroundRefresh: cfg.allowBackgroundRefresh ?? false,
    refreshOnShow: cfg.refreshOnShow ?? true,
    refreshMs: cfg.refreshMs,
  }
  service.setActive("a-network-widget", false, refreshConfig)
  root.connect("map", () => {
    service.setActive("a-network-widget", true, refreshConfig)
  })
  root.connect("unmap", () => {
    service.setActive("a-network-widget", false, refreshConfig)
  })

  return root
}
