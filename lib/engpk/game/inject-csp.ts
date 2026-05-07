/**
 * engpk · CSP 注入器（决策 #10）
 *
 * 在 LLM 生成的 HTML <head> 中注入严格 CSP meta 标签。
 * 如果 HTML 没有 <head>，在 <html> 后插入。
 */

const CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src \'none\'; frame-src \'none\';">';

/**
 * 注入 CSP meta 到 HTML 字符串。
 * 如果已经包含 Content-Security-Policy meta，不重复注入。
 */
export function injectCSP(html: string): string {
  if (html.includes('Content-Security-Policy')) return html;

  // 尝试在 <head> 开标签后插入
  const headIdx = html.indexOf('<head>');
  if (headIdx >= 0) {
    const insertAt = headIdx + '<head>'.length;
    return html.slice(0, insertAt) + '\n' + CSP_META + '\n' + html.slice(insertAt);
  }

  // 没有 <head>，在 <html> 后插入
  const htmlIdx = html.indexOf('<html');
  if (htmlIdx >= 0) {
    const closeAngle = html.indexOf('>', htmlIdx);
    if (closeAngle >= 0) {
      const insertAt = closeAngle + 1;
      return (
        html.slice(0, insertAt) +
        '\n<head>' +
        CSP_META +
        '</head>\n' +
        html.slice(insertAt)
      );
    }
  }

  // 兜底：直接前置
  return CSP_META + '\n' + html;
}

export { CSP_META };
