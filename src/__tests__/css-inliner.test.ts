import { describe, it, expect } from "vitest";
import { inlineCss } from "../css-inliner.js";

describe("inlineCss", () => {
  it("inlines class selector", () => {
    const html = '<style>.btn { color: red; }</style><p class="btn">Click</p>';
    expect(inlineCss(html)).toBe('<p class="btn" style="color: red;">Click</p>');
  });

  it("inlines tag selector", () => {
    expect(inlineCss('<style>p { margin: 0; }</style><p>Hello</p>'))
      .toBe('<p style="margin: 0;">Hello</p>');
  });

  it("inlines id selector", () => {
    expect(inlineCss('<style>#h { font-size: 24px; }</style><div id="h">T</div>'))
      .toContain('style="font-size: 24px;"');
  });

  it("merges with existing inline styles", () => {
    const html = '<style>.x { color: blue; }</style><p class="x" style="font-size: 12px;">Hi</p>';
    const result = inlineCss(html);
    expect(result).toContain("font-size: 12px");
    expect(result).toContain("color: blue");
  });

  it("removes style blocks", () => {
    const result = inlineCss('<style>.a { color: red; }</style><p class="a">X</p>');
    expect(result).not.toContain("<style>");
  });

  it("returns unchanged if no style blocks", () => {
    const html = '<p>No styles</p>';
    expect(inlineCss(html)).toBe(html);
  });
});
