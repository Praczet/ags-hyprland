import css from "./styles.css"

export { css }

export type { WotdMeaning, WotdMeta, WotdCardData, WotdConfig } from "./types"

export * from "./config"
export * from "./service"
export * from "./store"

export * from "./widgets/card"
export * from "./widgets/compact"

export {
  WOTD_POPUP_WINDOW_NAME,
  createWotdPopupWindow,
  getWotdPopup,
  showWotdPopup,
  hideWotdPopup,
  destroyWotdPopup,
  WotdPopupWindow
} from "./windows/popup"
