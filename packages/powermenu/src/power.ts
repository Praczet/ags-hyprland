import { execAsync } from "ags/process";

export const power = {
  shutdown: () => execAsync("systemctl poweroff"),
  reboot: () => execAsync("systemctl reboot"),
  suspend: () => execAsync("systemctl suspend"),
  logout: () => execAsync("uwsm stop"),
  lock: () => execAsync("hyprlock"),
}

