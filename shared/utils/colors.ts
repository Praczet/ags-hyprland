import { Gdk } from "ags/gtk4";


export function isColor(str: string): boolean {
  const dummy = new Gdk.RGBA();
  try {
    // .parse() returns true if successful, false if not.
    return dummy.parse(str);
  } catch (error) {
    return false;
  }
}


export function toHex(colorString: string): string {
  const c = new Gdk.RGBA();

  // Attempt to parse. If it fails, return a default (e.g., white)
  if (!c.parse(colorString)) return "#ffffff";

  // Helper to convert 0.0-1.0 to 00-FF
  const toFF = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');

  // If alpha is 1 (fully opaque), we usually prefer #RRGGBB
  if (c.alpha >= 1) {
    return `#${toFF(c.red)}${toFF(c.green)}${toFF(c.blue)}`;
  }

  // Otherwise return #RRGGBBAA
  return `#${toFF(c.red)}${toFF(c.green)}${toFF(c.blue)}${toFF(c.alpha)}`;
}

// 2. Find the best contrast text color (Black or White)
export function getContrastColor(colorString: string): string {
  const c = new Gdk.RGBA();

  // Default to black text if parsing fails
  if (!c.parse(colorString)) return "#000000";

  // Calculate Luminance (Standard formula for sRGB)
  // r, g, b are already 0.0 to 1.0
  const luminance = (0.2126 * c.red) + (0.7152 * c.green) + (0.0722 * c.blue);

  // Threshold: 0.5 is the middle ground
  return (luminance > 0.5) ? "#000000" : "#ffffff";
}
import GdkPixbuf from "gi://GdkPixbuf";

export function getImageSize(filePath: string): { width: number; height: number } | null {
  try {
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file(filePath);
    return {
      width: pixbuf.get_width(),
      height: pixbuf.get_height(),
    };
  } catch (e) {
    console.error("getImageSize error:", String(e));
    return null;
  }
}
