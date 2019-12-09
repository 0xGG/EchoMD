/* VickyMD
 * Distributed under AGPL3
 *
 * Please include the following in your index.html file
 *
 *   <script src="https://cdn.jsdelivr.net/npm/yamljs@0.3.0/dist/yaml.min.js"></script>
 *
 *
 */

import * as CodeMirror from "codemirror";
import {
  registerRenderer,
  CodeRenderer,
  getAddon as getFoldCode
} from "../addon/fold-code";
import { getAddon as getFold } from "../addon/fold";

export const EchartsRenderer: CodeRenderer = (code, info) => {
  var id = "_echarts_id_" + Math.round(1e9 * Math.random()).toString(36);

  var el = document.createElement("div");
  el.setAttribute("id", id);
  el.style.width = "400px";
  el.style.height = "400px";

  try {
    let option = {};
    if (code.trim()[0] !== "{") {
      option = window["YAML"].parse(code);
    } else {
      option = JSON.parse(code);
    }
    const myChart = window["echarts"].init(el);
    myChart.setOption(option);
    info.changed();
  } catch (error) {
    el.innerText = error.toString();
  }
  return el;
};

if (window["echarts"]) {
  CodeMirror.defineOption("echarts", null, (cm: CodeMirror.Editor) => {
    getFoldCode(cm).clear("echarts");
    getFold(cm).startFold();
  });

  registerRenderer({
    name: "echarts",
    pattern: /^echarts$/i,
    renderer: EchartsRenderer,
    suggested: true
  });
} else {
  console.error("[HyperMD] PowerPack fold-code-with-echarts failed to load.");
}

/*

# Example

```echarts
 {
    "title": {
        "text": "ECharts entry example"
    },
    "tooltip": {},
    "legend": {
        "data":["Sales"]
    },
    "xAxis": {
        "data": ["shirt","cardign","chiffon shirt","pants","heels","socks"]
    },
    "yAxis": {},
    "series": [{
        "name": "Sales",
        "type": "bar",
        "data": [5, 20, 36, 10, 10, 20]
    }]
}
```
*/
