// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// Turn Markdown text into real images, link icons ...
//
// You may set `hmdFold.customFolders` option to fold more, where `customFolders` is Array<FolderFunc>
//

import CodeMirror, { TextMarker, Position, Token } from 'codemirror'
import { Addon, FlipFlop, debounce } from '../core'
import { cm_t } from '../core/type'
import { splitLink } from './read-link'

const DEBUG = false

/********************************************************************************** */
/**
 * 1. Check if `token` is a **BEGINNING TOKEN** of fold-able text (eg. "!" for images)
 * 2. Use `stream.findNext` to find the end of the text to be folded (eg. ")" or "]" of link/URL, for images)
 * 3. Compose a range `{from, to}`
 *    - `from` is always `{ line: stream.lineNo, ch: token.start }`
 * 4. Check if `stream.requestRange(from, to)` returns `RequestRangeResult.OK`
 *    - if not ok, return `null` immediately.
 * 5. Use `stream.cm.markText(from, to, options)` to fold text, and return the marker
 *
 * @param token current checking token. a shortcut to `stream.lineTokens[stream.i_token]`
 * @returns a TextMarker if folded.
 */
export type FolderFunc = (stream: FoldStream, token: CodeMirror.Token) => CodeMirror.TextMarker;

/** FolderFunc may use FoldStream to lookup for tokens */
export interface FoldStream {
  readonly cm: cm_t

  readonly line: CodeMirror.LineHandle
  readonly lineNo: number
  readonly lineTokens: Token[]    // always same as cm.getLineTokens(line)
  readonly i_token: number        // current token's index

  /**
   * Find next Token that matches the condition AFTER current token (whose index is `i_token`), or a given position
   * This function will NOT make the stream precede!
   *
   * @param condition a RegExp to check token.type, or a function check the Token
   * @param maySpanLines by default the searching will not span lines
   */
  findNext(condition: RegExp | ((token: Token) => boolean), maySpanLines?: boolean, since?: Position): { lineNo: number, token: Token, i_token: number }

  /**
   * In current line, find next Token that matches the condition SINCE the token with given index
   * This function will NOT make the stream precede!
   *
   * @param condition a RegExp to check token.type, or a function check the Token
   * @param i_token_since default: i_token+1 (the next of current token)
   */
  findNext(condition: RegExp | ((token: Token) => boolean), i_token_since: number): { lineNo: number, token: Token, i_token: number }

  /**
   * Before creating a TextMarker, check if the range is good to use.
   *
   * Do NOT create TextMarker unless this returns `RequestRangeResult.OK`
   */
  requestRange(from: Position, to: Position): RequestRangeResult
}

/********************************************************************************** */
/** define all built-in folder types */
export interface builtinFolderContainer<T> {
  image: T,
  link: T,
}

export var builtinFolder: builtinFolderContainer<FolderFunc> = {
  image(stream, token) {
    const cm = stream.cm
    const imgRE = /\bimage-marker\b/
    const urlRE = /\bformatting-link-string\b/   // matches the parentheses

    if (imgRE.test(token.type) && token.string === "!") {
      var lineNo = stream.lineNo

      // find the begin and end of url part
      var url_begin = stream.findNext(urlRE)
      var url_end = stream.findNext(urlRE, url_begin.i_token + 1)

      let from: Position = { line: lineNo, ch: token.start }
      let to: Position = { line: lineNo, ch: url_end.token.end }
      let rngReq = stream.requestRange(from, to)

      if (rngReq === RequestRangeResult.OK) {
        var url: string
        var title: string

        { // extract the URL
          let rawurl = cm.getRange(    // get the URL or footnote name in the parentheses
            { line: lineNo, ch: url_begin.token.start + 1 },
            { line: lineNo, ch: url_end.token.start }
          )
          if (url_end.token.string === "]") {
            let tmp = cm.hmdReadLink(rawurl, lineNo)
            if (!tmp) return null // Yup! bad URL?!
            rawurl = tmp.content
          }
          url = splitLink(rawurl).url
        }

        { // extract the title
          title = cm.getRange(
            { line: lineNo, ch: from.ch + 2 },
            { line: lineNo, ch: url_begin.token.start - 1 }
          )
        }

        var img = document.createElement("img")
        var marker = cm.markText(
          from, to,
          {
            collapsed: true,
            replacedWith: img,
          }
        )

        img.addEventListener('load', () => {
          img.classList.remove("hmd-image-loading")
          marker.changed()
        }, false)
        img.addEventListener('error', () => {
          img.classList.remove("hmd-image-loading")
          img.classList.add("hmd-image-error")
          marker.changed()
        }, false)
        img.addEventListener('click', () => breakMark(cm, marker), false)

        img.className = "hmd-image hmd-image-loading"
        img.src = url
        img.title = title
        return marker
      } else {
        if (DEBUG) {
          console.log("[image]FAILED TO REQUEST RANGE: ", rngReq)
        }
      }
    }

    return null
  },

  link(stream, token) {
    const cm = stream.cm
    const urlRE = /\bformatting-link-string\b/   // matches the parentheses

    const endTest = (token: Token) => (urlRE.test(token.type) && token.string === ")")

    if (
      token.string === "(" && urlRE.test(token.type) && // is URL left parentheses
      (stream.i_token === 0 || !/\bimage/.test(stream.lineTokens[stream.i_token - 1].type)) // not a image URL
    ) {
      var lineNo = stream.lineNo

      var url_end = stream.findNext(endTest)

      let from: Position = { line: lineNo, ch: token.start }
      let to: Position = { line: lineNo, ch: url_end.token.end }
      let rngReq = stream.requestRange(from, to)

      if (rngReq === RequestRangeResult.OK) {
        var text = cm.getRange(from, to)
        var { url, title } = splitLink(text.substr(1, text.length - 2))

        var img = document.createElement("span")
        img.setAttribute("class", "hmd-link-icon")
        img.setAttribute("title", url + "\n" + title)
        img.setAttribute("data-url", url)

        var marker = cm.markText(
          from, to,
          {
            collapsed: true,
            replacedWith: img,
          }
        )

        img.addEventListener('click', () => breakMark(cm, marker), false)
        return marker
      } else {
        if (DEBUG) {
          console.log("[link]FAILED TO REQUEST RANGE: ", rngReq)
        }
      }
    }

    return null
  },
}

/********************************************************************************** */
/** UTILS */

/** break a TextMarker, move cursor to where marker is */
export function breakMark(cm: cm_t, marker: TextMarker, chOffset?: number) {
  cm.operation(function () {
    var pos = marker.find().from
    pos = { line: pos.line, ch: pos.ch + ~~chOffset }
    cm.setCursor(pos)
    cm.focus()
    marker.clear()
  })
}

/********************************************************************************** */
/** ADDON OPTIONS */

export interface FoldOptions extends Addon.AddonOptions, builtinFolderContainer<boolean> {
  math?: boolean // only works when fold-math addon presents
  customFolders: { [type: string]: FolderFunc }
}

export const defaultOption: FoldOptions = {
  image: false,
  link: false,
  customFolders: {},
}

const OptionName = "hmdFold"
type OptionValueType = Partial<FoldOptions> | boolean;

CodeMirror.defineOption(OptionName, false, function (cm: cm_t, newVal: OptionValueType) {
  const enabled = !!newVal

  if (!enabled || typeof newVal === "boolean") {
    // enable/disable all builtinFolder
    newVal = {}
    for (const type in builtinFolder) newVal[type] = enabled
  }

  var newCfg = Addon.migrateOption(newVal, defaultOption)

  ///// apply config
  var inst = getAddon(cm)
  for (const type in builtinFolder) inst.setBuiltinStatus(type, newVal[type])

  if (typeof newVal.customFolders !== "object") newVal.customFolders = {}

  var customFolderTypes = []
  for (const key in newVal.customFolders) {
    if (newVal.customFolders.hasOwnProperty(key)) {
      customFolderTypes.push(key)
      if (!(key in inst.folded)) inst.folded[key] = []
    }
  }

  //TODO: shall we clear disappeared folder's legacy?
  inst.customFolderTypes = customFolderTypes

  ///// start a fold
  inst.startFold()
})

declare global { namespace HyperMD { interface EditorConfiguration { [OptionName]?: OptionValueType } } }

export enum RequestRangeResult {
  // Use string values because in TypeScript, string enum members do not get a reverse mapping generated at all.
  // Otherwise the generated code looks ugly
  OK = "ok",
  CURSOR_INSIDE = "ci",
  HAS_MARKERS = "hm",
}

/********************************************************************************** */
/** ADDON CLASS */

const AddonAlias = "fold"
export class Fold implements Addon.Addon, FoldStream {
  // stores builtin Folder status with FlipFlops
  public ff_builtin = {} as { [type: string]: FlipFlop<boolean> }

  customFolders: { [type: string]: FolderFunc; };
  customFolderTypes: string[];

  /** Folder's output goes here */
  public folded: { [type: string]: CodeMirror.TextMarker[]; } = {};

  /** Update a builtin folder's status, and fold/unfold */
  setBuiltinStatus(type: string, status: boolean) {
    if (!(type in builtinFolder)) return

    var ff = this.ff_builtin[type]
    if (!ff) { //whoops, the FlipFlop not created
      ff = new FlipFlop(this.startFold, this.clear.bind(this, type))
      this.ff_builtin[type] = ff
    }

    ff.setBool(status)
  }

  constructor(public cm: cm_t) {
    cm.on("changes", (cm, changes) => {
      var fromLine = changes.reduce((prev, curr) => Math.min(prev, curr.from.line), cm.lastLine())
      this.startFold()
    })
    cm.on("cursorActivity", (cm) => {
      this.startQuickFold()
    })
  }

  ///////////////////////////////////////////////////////////////////////////////////////////
  /// BEGIN OF APIS THAT EXPOSED TO FolderFunc
  /// @see FoldStream

  // folding status related
  // current line, tokens of line, index of token

  public line: CodeMirror.LineHandle
  public lineNo: number
  public lineTokens: Token[]    // always same as cm.getLineTokens(line)
  public i_token: number

  findNext(condition: RegExp | ((token: Token) => boolean), varg?: boolean | number, since?: Position): { lineNo: number, token: Token, i_token: number } {
    var lineNo = this.lineNo
    var tokens = this.lineTokens
    var token: Token = null

    var i_token: number

    if (varg === true && !since) {
      since = { line: lineNo + 1, ch: 0 }
    } else if (varg === false && since) {
      if (since.line !== lineNo) return null
      for (i_token = 0; i_token < tokens.length; i_token++) {
        if (tokens[i_token].start >= since.ch) break
      }
    } else if (typeof varg === 'number') {
      i_token = varg
    } else {
      i_token = this.i_token + 1
    }

    for (; i_token < tokens.length; i_token++) {
      var token_tmp = tokens[i_token]
      if ((typeof condition === "function") ? condition(token_tmp) : condition.test(token_tmp.type)) {
        token = token_tmp
        break
      }
    }

    if (!token && varg === true) {
      const cm = this.cm
      cm.eachLine(since.line, cm.lastLine() + 1, (line_i) => {
        lineNo = line_i.lineNo()
        tokens = cm.getLineTokens(lineNo)

        i_token = 0
        if (lineNo === since.line) {
          for (; i_token < tokens.length; i_token++) {
            if (tokens[i_token].start >= since.ch) break
          }
        }

        for (; i_token < tokens.length; i_token++) {
          var token_tmp = tokens[i_token]
          if ((typeof condition === "function") ? condition(token_tmp) : condition.test(token_tmp.type)) {
            token = token_tmp
            return true // stop `eachLine`
          }
        }
      })
    }

    return token ? { lineNo, token, i_token } : null
  }

  setPos(ch: number);
  setPos(line: number | CodeMirror.LineHandle, ch: number);
  setPos(line: number | CodeMirror.LineHandle, ch: number, precise: boolean);

  /** Update `Fold` stream's current position */
  setPos(line: number | CodeMirror.LineHandle, ch?: number, precise?: boolean) {
    if (ch === void 0) { ch = line as number; line = this.line }
    else if (typeof line === 'number') line = this.cm.getLineHandle(line);

    const sameLine = line === this.line;
    var i_token = 0

    if (precise || !sameLine) {
      this.line = line
      this.lineNo = line.lineNo()
      this.lineTokens = this.cm.getLineTokens(this.lineNo)
    } else {
      // try to speed-up seeking
      i_token = this.i_token
      let token = this.lineTokens[i_token]
      if (token.start > ch) i_token = 0
    }

    var tokens = this.lineTokens
    for (; i_token < tokens.length; i_token++) {
      if (tokens[i_token].end > ch) break // found
    }

    this.i_token = i_token
  }

  /**
   * Check if a range is foldable and update _quickFoldHint
   *
   * NOTE: this function is always called after `_quickFoldHint` reset by `startFoldImmediately`
   */
  requestRange(from: Position, to: Position): RequestRangeResult {
    const cm = this.cm, cmpPos = CodeMirror.cmpPos
    var cursorPos = cm.getCursor()
    var markers = cm.findMarks(from, to)

    var ans: RequestRangeResult = RequestRangeResult.OK

    if (markers.length !== 0) ans = RequestRangeResult.HAS_MARKERS
    else if (cmpPos(cursorPos, from) >= 0 && cmpPos(cursorPos, to) <= 0) ans = RequestRangeResult.CURSOR_INSIDE

    if (ans !== RequestRangeResult.OK) this._quickFoldHint.push(from.line)

    return ans
  }


  /// END OF APIS THAT EXPOSED TO FolderFunc
  ///////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Fold everything! (This is a debounced, and `this`-binded version)
   */
  startFold = debounce(this.startFoldImmediately.bind(this), 100)

  /**
   * Fold everything!
   *
   * @param toLine last line to fold. Inclusive
   */
  startFoldImmediately(fromLine?: number, toLine?: number) {
    const cm = this.cm

    fromLine = fromLine || cm.firstLine()
    toLine = (toLine || cm.lastLine()) + 1

    this._quickFoldHint = []
    this.setPos(fromLine, 0, true)

    cm.eachLine(fromLine, toLine, line => {
      var lineNo = line.lineNo()
      if (lineNo < this.lineNo) return // skip current line...
      else if (lineNo > this.lineNo) this.setPos(lineNo, 0) // hmmm... maybe last one is empty line

      var charMarked: boolean[] = new Array(line.text.length)
      {
        // populate charMarked array.
        // @see CodeMirror's findMarksAt
        let lineMarkers = line.markedSpans
        if (lineMarkers) {
          for (let i = 0; i < lineMarkers.length; ++i) {
            let span = lineMarkers[i]
            let spanFrom = span.from == null ? 0 : span.from
            let spanTo = span.to == null ? charMarked.length : span.to
            for (let j = spanFrom; j < spanTo; j++) charMarked[j] = true
          }
        }
      }

      const tokens = this.lineTokens

      while (this.i_token < tokens.length) {
        var token = tokens[this.i_token]
        var type: string
        var marker: TextMarker = null

        var tokenFoldable: boolean = true
        {
          for (let i = token.start; i < token.end; i++) {
            if (charMarked[i]) {
              tokenFoldable = false
              break
            }
          }
        }

        if (tokenFoldable) {
          // try built-in folders
          for (type in this.ff_builtin) {
            if (this.ff_builtin[type].state && (marker = builtinFolder[type](this, token))) break
          }

          if (!marker) {
            // try custom folders
            for (type of this.customFolderTypes) {
              if (marker = this.customFolders[type](this, token)) break
            }
          }
        }

        if (!marker) {
          // this token not folded. check next
          this.i_token++
        } else {
          var { from, to } = marker.find();
          (this.folded[type] || (this.folded[type] = [])).push(marker)
          marker.on('clear', (from, to) => {
            var markers = this.folded[type]
            var idx: number
            if (markers && (idx = markers.indexOf(marker)) !== -1) markers.splice(idx, 1)
            this._quickFoldHint.push(from.line)
          })

          if (DEBUG) {
            console.log("[FOLD] New marker ", type, from, to, marker)
          }

          if (to.line !== lineNo) {
            this.setPos(to.line, to.ch)
            return // nothing left in this line
          } else {
            this.setPos(to.ch) // i_token will be updated by this.setPos()
          }
        }
      }
    })
  }

  /** stores every affected lineNo */
  private _quickFoldHint: number[] = []

  /**
   * Start a quick fold: only process recent `requestRange`-failed ranges
   */
  startQuickFold() {
    var hint = this._quickFoldHint
    if (hint.length === 0) return

    var from = hint[0], to = from
    for (const lineNo of hint) {
      if (from > lineNo) from = lineNo
      if (to < lineNo) to = lineNo
    }

    this.startFold.stop()
    this.startFoldImmediately(from, to)
  }

  /**
   * Clear one type of folded TextMarkers
   *
   * @param type builtin folder type ("image", "link" etc) or custom fold type
   */
  clear(type: string) {
    var folded = this.folded[type]
    if (!folded || !folded.length) return

    for (const marker of folded) {
      marker.clear()
    }
    folded.splice(0)
  }

  /**
   * Clear all folding result
   */
  clearAll() {
    for (const type in this.folded) {
      var folded = this.folded[type]
      for (const marker of folded) {
        marker.clear()
      }
      folded.splice(0)
    }
  }
}


declare global { namespace HyperMD { interface HelperCollection { [AddonAlias]?: Fold } } }

/** ADDON GETTER: Only one addon instance allowed in a editor */
export const getAddon = Addon.Getter(AddonAlias, Fold, defaultOption /** if has options */)
