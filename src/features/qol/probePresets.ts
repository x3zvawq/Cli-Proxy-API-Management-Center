export const candyPrompt = `不使用任何外部工具回答以下问题：
在一个黑色的袋子里放有三种口味的糖果，每种糖果有两种不同的形状（圆形和五角星形，不同的形状靠手感可以分辨）。现已知不同口味的糖和不同形状的数量统计如下表。参赛者需要在活动前决定摸出的糖果数目，那么，最少取出多少个糖果才能保证手中同时拥有不同形状的苹果味和桃子味的糖？（同时手中有圆形苹果味匹配五角星桃子味糖果，或者有圆形桃子味匹配五角星苹果味糖果都满足要求）
       苹果味  桃子味  西瓜味
圆形       7      9      8
五角星形   7      6      4`;

// Inspired by cockpit-tools' pelican test; the answer is evidence for a human,
// not an automatic model-identity or account-risk verdict.
export const pelicanPrompt =
  '创建一个自包含的 HTML，内容是用 SVG 绘制一个鹈鹕骑自行车的 2D 动画。不使用外部工具或外部资源，不需要测试。请使用 CSS 或 SVG 原生动画而非 JavaScript，让文件可以直接预览。只输出完整 HTML 源码。';

export function pelicanDocument(text: string): string | null {
  const fenced = text.match(/```(?:html|svg)\s*\n([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const start = source.search(/<!doctype\s+html|<html\b|<svg\b/i);
  if (start < 0) return null;
  const content = source.slice(start).replace(/```\s*$/, '');
  // A separate opaque-origin frame plus CSP protects the management session.
  return (
    '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    content
  );
}

export function nonNavigatingPreview(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  // sandbox/CSP isolate scripts and resources; remove document navigators too,
  // because a frame's own link/meta-refresh navigation is not a subresource.
  document
    .querySelectorAll(
      'meta[http-equiv="refresh" i],base,a,area,form,iframe,frame,frameset,object,embed'
    )
    .forEach((node) => node.remove());
  return '<!doctype html>' + document.documentElement.outerHTML;
}
