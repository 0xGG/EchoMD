// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// POWERPACK for "addon/fold-emoji"
//
// Use [twemoji](https://github.com/twitter/twemoji) to render emoji `:smile:` :smile:
//
// :warning: **License**:
//
// Please follow https://github.com/twitter/twemoji#license if you use this powerpack.
// 使用前请注意阅读 twemoji 使用许可
//

import _twemoji_module from "twemoji";
import { getTwemojiOptions } from "../addon/emoji/index";
import {
  defaultChecker,
  defaultDict,
  defaultOption,
  defaultRenderer,
  EmojiChecker,
  EmojiRenderer,
} from "../addon/fold-emoji";

/** twemoji */
const twemoji: typeof _twemoji_module =
  _twemoji_module || (this as any)["twemoji"] || window["twemoji"];

export const twemojiChecker: EmojiChecker = defaultChecker;

export const twemojiRenderer: EmojiRenderer = (text) => {
  const emojiStr = text.startsWith(":")
    ? defaultDict[text.replace(/^:(.+?):$/, "$1")]
    : text;
  const twemojiOptions = getTwemojiOptions();
  const html = twemojiOptions
    ? twemoji.parse(emojiStr, twemojiOptions)
    : twemoji.parse(emojiStr);

  // If twemoji failed to render, fallback to defaultRenderer
  const match = html.match(/^<(img|span) /i);
  if (!match) return defaultRenderer(text);

  const attr = /([\w-]+)="(.+?)"/g;
  const ans = document.createElement(match[1] || "img");
  let t: RegExpMatchArray;
  while ((t = attr.exec(html))) ans.setAttribute(t[1], t[2]);
  return ans;
};

// Update default EmojiChecker and EmojiRenderer
if (typeof twemoji !== "undefined") {
  defaultOption.emojiChecker = twemojiChecker;
  defaultOption.emojiRenderer = twemojiRenderer;
} else {
  if (window["ECHOMD_DEBUG"]) {
    console.error(
      "[HyperMD] PowerPack fold-emoji-with-twemoji loaded, but twemoji not found."
    );
  }
}
