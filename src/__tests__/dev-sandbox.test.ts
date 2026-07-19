import { describe, it, expect } from "vitest";
import { DevSandbox } from "../dev-sandbox.js";
import type { EmailMessage } from "../types.js";

const email: EmailMessage = {
  from: "sender@example.com", to: "recipient@example.com",
  subject: "Test Email", html: "<p>Hello World</p>",
};

describe("DevSandbox", () => {
  it("intercepts send and returns result", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send(email);
    expect(result.messageId).toMatch(/^dev-/);
    expect(result.transportId).toBe("dev-sandbox");
  });

  it("stores and retrieves emails", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send(email);
    expect(sandbox.count()).toBe(1);
    expect(sandbox.getById(result.messageId)?.message.subject).toBe("Test Email");
    expect(sandbox.getLast()?.message.subject).toBe("Test Email");
  });

  it("respects maxIntercepted limit", async () => {
    const sandbox = new DevSandbox({ maxIntercepted: 2 });
    await sandbox.send({ ...email, subject: "1" });
    await sandbox.send({ ...email, subject: "2" });
    await sandbox.send({ ...email, subject: "3" });
    expect(sandbox.count()).toBe(2);
    expect(sandbox.getIntercepted()[0]!.message.subject).toBe("2");
  });

  it("clear removes all", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send(email);
    sandbox.clear();
    expect(sandbox.count()).toBe(0);
  });

  it("toHtmlPreview renders email", async () => {
    const sandbox = new DevSandbox();
    const result = await sandbox.send(email);
    const html = sandbox.toHtmlPreview(result.messageId)!;
    expect(html).toContain("Test Email");
    expect(html).toContain("<iframe");
  });

  it("toHtmlPreview returns null for missing id", () => {
    expect(new DevSandbox().toHtmlPreview("nope")).toBeNull();
  });

  it("toListHtml shows email list", async () => {
    const sandbox = new DevSandbox();
    await sandbox.send(email);
    expect(sandbox.toListHtml()).toContain("1 email(s) intercepted");
  });

  it("toListHtml shows empty state", () => {
    expect(new DevSandbox().toListHtml()).toContain("No emails sent yet");
  });
});
