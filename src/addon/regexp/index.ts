// DESCRIPTION: Common

// Please note that "-" and "_" are not in this RegExpr
export const StopRegExp = /[\s@#,.!$%^&*()\[\]+=~`<>?\\，。]/;

export const HashTagRegExp = /^(?:[-()_/a-zA-Z0-9ァ-ヺー-ヾｦ-ﾟｰ０-９Ａ-Ｚａ-ｚぁ-ゖ゙-ゞー々ぁ-んァ-ヾ一-\u9FEF㐀-䶵﨎﨏﨑﨓﨔﨟﨡﨣﨤﨧-﨩]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d])+/;

export const BlocKReferenceStopRegExp = /[\s@#,.!$%^&*()\[\]_+=~`<>?\\，。]/;

// Referred from https://github.com/mathiasbynens/emoji-regex/blob/main/src/index.js
export const EmojiRegExp = /<% RGI_Emoji %>|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/gu;
