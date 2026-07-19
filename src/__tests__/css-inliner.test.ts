import { describe, it, expect } from "vitest";
import { inlineCss } from "../css-inliner.js";

describe("inlineCss", () => {
  it("inlines simple class selector", () => {
    const html = `<style>.btn { color: red; }</style><p class="btn">Click</p>`;
    expect(inlineCss(html)).toBe('<p class="btn" style="color: red;">Click</p>');
  });

  it("inlines tag selector", () => {
    const html = `<style>p { margin: 0; }</style><p>Hello</p>`;
    expect(inlineCss(html)).toBe('<p style="margin: 0;">Hello</p>');
  });

  it("inlines id selector", () => {
    const html = `<style>#header { font-size: 24px; }</style><div id="header">Title</div>`;
    expect(inlineCss(html)).toBe('<div id="header" style="font-size: 24px;">Title</div>');
  });

  it("merges with existing inline styles", () => {
    const html = `<style>.x { color: blue; }</style><p class="x" style="font-size: 12px;">Hi</p>`;
    expect(inlineCss(html)).toBe('<p class="x" style="font-size: 12px; color: blue;">Hi</p>');
  });

  it("removes style blocks", () => {
    const html = `<style>.a { color: red; }</style><p class="a">X</p>`;
    const result = inlineCss(html);
    expect(result).not.toContain("<style>");
    expect(result).not.toContain("</style>");
  });

  it("handles multiple rules", () => {
    const html = `<style>.a { color: red; } .b { font-size: 14px; }</style><p class="a b">X</p>`;
    const result = inlineCss(html);
    expect(result).toContain("color: red");
    expect(result).toContain("font-size: 14px");
  });

  it("returns unchanged html if no style blocks", () => {
    const html = `<p>No styles here</p>`;
    expect(inlineCss(html)).toBe(html);
  });

  it("handles empty style block", () => {
    const html = `<style></style><p>Content</p>`;
    expect(inlineCss(html)).toBe(html);
  });

  it("handles class+tag combined selector", () => {
    const html = `<style>span.highlight { text-decoration: underline; }</style><span class="highlight">Text</span>`;
    expect(inlineCss(html)).toContain("text-decoration: underline");
  });

  it("strips CSS comments", () => {
    const html = `<style>/* comment */ .x { color: red; } /* another */</style><p class="x">Y</p>`;
    expect(inlineCss(html)).toContain("color: red");
    expect(inlineCss(html)).not.toContain("comment");
  });

  it("handles multiple elements with same class", () => {
    const html = `<style>.red { color: red; }</style><p class="red">A</p><p class="red">B</p>`;
    const result = inlineCss(html);
    expect(result).toContain('<p class="red" style="color: red;">A</p>');
    expect(result).toContain('<p class="red" style="color: red;">B</p>');
  });
});
