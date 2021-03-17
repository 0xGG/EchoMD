import { BlocKReferenceStopRegExp } from "../../addon/regexp/index";

/**
 * ^block-reference
 */
export default (md: any) => {
  // @ts-ignore
  md.inline.ruler.before("escape", "block_reference", (state, silent) => {
    if (
      !(
        (state.src[state.pos - 1] || "").match(/(^|\s)$/) &&
        state.src[state.pos] === "^" &&
        !state.src[state.pos + 1].match(BlocKReferenceStopRegExp)
      )
    ) {
      return false;
    }

    let content = "";
    let end = -1;
    let i = state.pos + 1;
    while (i < state.src.length) {
      if (state.src[i].match(BlocKReferenceStopRegExp)) {
        if (state.src[i] !== "\n") {
          return false;
        } else {
          end = i;
          break;
        }
      } else if (state.src[i] === "\\") {
        i += 1;
      }
      i += 1;
    }
    if (end === -1) {
      end = i;
    }

    if (end >= 0) {
      content = state.src.slice(state.pos, end);
    } else {
      return false;
    }

    const token = state.push("block_reference");
    token.content = content;
    token.attrPush(["id", content.slice(1)]);
    state.pos = end;
    return true;
  });

  md.renderer.rules.block_reference = (tokens, idx) => {
    const token = tokens[idx];
    const content = token.content || "";
    const id = token.attrGet("id") || "";
    return `<span class="block-reference" id="${id}">${content}</span>`;
  };
};
