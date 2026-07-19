import { describe, it, expect } from "vitest";
import { DevSandbox } from "../dev-sandbox.js";
import type { EmailMessage } from "../types.js";

const email: EmailMessage = {
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Test Email",
  html: "<p>Hello World</p>",
};

describe("DevSandbox", () => {
  it("has id 'dev-sandbox'", () => {
    const sandbox = new DevSandbox();
    expect(sandbox.id).toBe("dev-sandbox");
  });

  it("intercepts send and returns a result", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send(email);
    expect(result.messageId).toMatch(/^dev-/);
    expect(result.transportId).toBe("dev-sandbox");
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it("stores intercepted emails", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send(email);
    await sandbox.send({ ...email, subject: "Second" });
    expect(sandbox.count()).toBe(2);
  });

  it("getIntercepted returns all emails", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send(email);
    const all = sandbox.getIntercepted();
    expect(all.length).toBe(1);
    expect(all[0]!.message.subject).toBe("Test Email");
  });

  it("getLast returns most recent", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send({ ...email, subject: "First" });
    await sandbox.send({ ...email, subject: "Last" });
    expect(sandbox.getLast()?.message.subject).toBe("Last");
  });

  it("getById returns specific email", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send(email);
    const found = sandbox.getById(result.messageId);
    expect(found).toBeDefined();
    expect(found!.message.subject).toBe("Test Email");
  });

  it("getById returns undefined for missing id", async () => {
    const sandbox = new DevSandbox();
    expect(sandbox.getById("nonexistent")).toBeUndefined();
  });

  it("clear removes all intercepted emails", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send(email);
    expect(sandbox.count()).toBe(1);
    sandbox.clear();
    expect(sandbox.count()).toBe(0);
  });

  it("respects maxIntercepted limit", async () => {
    const sandbox = new DevSandbox({ maxIntercepted: 2 });
    await sandbox.send({ ...email, subject: "1" });
    await sandbox.send({ ...email, subject: "2" });
    await sandbox.send({ ...email, subject: "3" });
    expect(sandbox.count()).toBe(2);
    expect(sandbox.getIntercepted()[0]!.message.subject).toBe("2");
  });

  it("toHtmlPreview returns HTML for existing id", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send(email);
    const html = sandbox.toHtmlPreview(result.messageId);
    expect(html).toContain("Test Email");
    expect(html).toContain("sender@example.com");
    expect(html).toContain("recipient@example.com");
    expect(html).toContain("<iframe");
  });

  it("toHtmlPreview returns null for missing id", async () => {
    const sandbox = new DevSandbox();
    expect(sandbox.toHtmlPreview("nonexistent")).toBeNull();
  });

  it("toListHtml returns preview page", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send(email);
    const html = sandbox.toListHtml();
    expect(html).toContain("1 email(s) intercepted");
    expect(html).toContain("Test Email");
    expect(html).toContain("sender@example.com");
  });

  it("toListHtml shows empty state", () => {
    const sandbox = new DevSandbox();
    const html = sandbox.toListHtml();
    expect(html).toContain("No emails sent yet");
  });

  it("text-only emails render as pre block", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send({
      ...email,
      html: undefined,
      text: "Plain text body",
    });
    const html = sandbox.toHtmlPreview(result.messageId);
    expect(html).toContain("<pre>");
    expect(html).toContain("Plain text body");
  });
});
