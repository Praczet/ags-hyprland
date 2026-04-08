import {
  showWotdPopup,
  hideWotdPopup,
  getWotdStore,
} from "../packages/wotd/src"

export async function wotdHandleRequest(argv: string[]) {
  const [cmd] = argv

  if (!cmd) return undefined
  const isCompact = argv.includes("compact")

  switch (cmd.toLowerCase()) {
    case "showwotd":
    case "wotd-show": {
      showWotdPopup(undefined, 0, {
        cardType: isCompact ? "compact" : "card",
      })
      return "ok"
    }

    case "hidewotd":
    case "wotd-hide": {
      hideWotdPopup()
      return "ok"
    }

    case "reloadwotd":
    case "wotd-reload": {
      getWotdStore().reload()
      return "ok"
    }
  }

  return undefined
}
