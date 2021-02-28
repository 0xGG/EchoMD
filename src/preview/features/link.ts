// Check https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md

import iterator from "markdown-it-for-inline";
import { uslug } from "../heading-id-generator";

// Override the default `link` functionality
export default (md: any) => {
  md.use(iterator, "link_with_id", "link_open", function (tokens, idx) {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex("href");
    if (hrefIndex >= 0) {
      const href = token.attrs[hrefIndex][1];
      token.attrPush(["id", `link-` + uslug(href) + "-" + idx]);
    }
  });
};
