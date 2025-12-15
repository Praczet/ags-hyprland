import { execAsync } from "ags/utils"

export const power = {
  shutdown: () => execAsync("systemctl poweroff"),
  reboot: () => execAsync("systemctl reboot"),
  suspend: () => execAsync("systemctl suspend"),
  logout: () => execAsync("hyprctl dispatch exit"),
  lock: () => execAsync("hyprlock"),
}

