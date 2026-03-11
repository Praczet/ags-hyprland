type IconTier = { threshold: number; icon: string }

type IconTierMap = {
  tiers: IconTier[]
  fallback: string
}

function resolveTier(value: number | null, config: IconTierMap): string {
  if (value === null) return config.fallback
  const clamped = Math.max(0, Math.min(100, value))
  let chosen = config.fallback
  for (const tier of config.tiers) {
    if (clamped >= tier.threshold) {
      chosen = tier.icon
    } else {
      break
    }
  }
  return chosen
}

const volumeTiers: IconTierMap = {
  fallback: "audio-volume-muted-symbolic",
  tiers: [
    { threshold: 0, icon: "audio-volume-muted-symbolic" },
    { threshold: 1, icon: "audio-volume-low-symbolic" },
    { threshold: 34, icon: "audio-volume-medium-symbolic" },
    { threshold: 67, icon: "audio-volume-high-symbolic" },
    { threshold: 85, icon: "audio-volume-overamplified-symbolic" },
  ],
}

const brightnessTiers: IconTierMap = {
  fallback: "display-brightness-symbolic",
  tiers: [
    { threshold: 0, icon: "display-brightness-symbolic" },
    { threshold: 1, icon: "display-brightness-symbolic" },
    { threshold: 34, icon: "display-brightness-symbolic" },
    { threshold: 67, icon: "display-brightness-symbolic" },
    { threshold: 85, icon: "weather-clear-symbolic" },
  ],
}

export function volumeIcon(value: number | null, muted: boolean): string {
  if (muted || value === 0) return "audio-volume-muted-symbolic"
  return resolveTier(value, volumeTiers)
}

export function micIcon(muted: boolean): string {
  return muted ? "microphone-sensitivity-muted-symbolic" : "microphone-sensitivity-high-symbolic"
}

export function brightnessIcon(value: number | null): string {
  return resolveTier(value, brightnessTiers)
}
