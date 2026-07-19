import type { EmailMessage } from "./types.js";

export type TemplateData = Record<string, string | number | boolean | null | undefined>;

export interface TemplateOptions {
  openDelimiter?: string;
  closeDelimiter?: string;
  defaultValue?: string;
}

export function compile(
  template: string,
  data: TemplateData,
  options?: TemplateOptions,
): string {
  const open = options?.openDelimiter ?? "{{";
  const close = options?.closeDelimiter ?? "}}";
  const defaultVal = options?.defaultValue ?? "";

  return template.replace(
    new RegExp(`${escapeRegex(open)}\\s*([\\w.]+)\\s*${escapeRegex(close)}`, "g"),
    (_match: string, key: string) => {
      const value = resolveKey(data, key.trim());
      if (value === undefined || value === null) return defaultVal;
      return String(value);
    },
  );
}

export function compileMessage(
  message: EmailMessage,
  data: TemplateData,
  options?: TemplateOptions,
): EmailMessage {
  const result = { ...message };

  if (result.subject) {
    result.subject = compile(result.subject, data, options);
  }
  if (result.html) {
    result.html = compile(result.html, data, options);
  }
  if (result.text) {
    result.text = compile(result.text, data, options);
  }

  return result;
}

function resolveKey(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
