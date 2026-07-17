const CRLF = "\r\n";

export interface DkimOptions {
  domain: string;
  selector: string;
  privateKey: string;
  headers?: string[];
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importPrivateKey(pem: string) {
  const keyData = pemToBytes(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function canonicalizeBody(body: string): string {
  let result = body.replace(/\r\n/g, "\n");
  if (!result.endsWith("\n")) {
    result += "\n";
  }
  return result.replace(/\n/g, "\r\n");
}

function canonicalizeHeaders(
  headers: string[],
  signedHeaders: string[],
): string {
  const signed = new Set(signedHeaders.map((h) => h.toLowerCase()));
  return headers
    .filter((h) => {
      const colonIdx = h.indexOf(":");
      if (colonIdx === -1) return false;
      const name = h.slice(0, colonIdx).trim().toLowerCase();
      return signed.has(name);
    })
    .map((h) => {
      const colonIdx = h.indexOf(":");
      const name = h.slice(0, colonIdx).trim().toLowerCase();
      const value = h.slice(colonIdx + 1).replace(/^\s+/, "").replace(/\s+$/, " ");
      return `${name}:${value}`;
    })
    .join(CRLF);
}

function parseHeaders(rawHeaders: string): string[] {
  return rawHeaders
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

function formatDkimHeader(
  options: DkimOptions,
  bodyHash: string,
  signedHeaders: string[],
  signature: string,
): string {
  const hdr = [
    `v=1`,
    `a=rsa-sha256`,
    `c=simple`,
    `d=${options.domain}`,
    `s=${options.selector}`,
    `bh=${bodyHash}`,
    `h=${signedHeaders.join(": ")}`,
    `b=${signature}`,
  ].join("; ");

  return `DKIM-Signature: ${hdr}`;
}

const DEFAULT_SIGNED_HEADERS = [
  "from",
  "to",
  "subject",
  "date",
  "message-id",
  "from",
];

export async function signMessage(
  rawMessage: string,
  options: DkimOptions,
): Promise<string> {
  const headerEnd = rawMessage.indexOf(CRLF + CRLF);
  const headerSection =
    headerEnd === -1 ? rawMessage : rawMessage.slice(0, headerEnd);
  const body = headerEnd === -1 ? "" : rawMessage.slice(headerEnd + 4);

  const headers = parseHeaders(headerSection);
  const signedHeaders = options.headers ?? DEFAULT_SIGNED_HEADERS;

  const canonicalBody = canonicalizeBody(body);
  const bodyHashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalBody),
  );
  const bodyHash = btoa(
    String.fromCharCode(...new Uint8Array(bodyHashBuffer)),
  );

  const canonicalHeaders = canonicalizeHeaders(headers, signedHeaders);

  const privateKey = await importPrivateKey(options.privateKey);
  const dataToSign = new TextEncoder().encode(
    `${canonicalHeaders}${CRLF}`,
  );
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    dataToSign,
  );
  const signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  );

  // Break signature into 76-char lines
  const foldedSig = signature.match(/.{1,76}/g)?.join("") ?? signature;

  const dkimHeader = formatDkimHeader(options, bodyHash, signedHeaders, foldedSig);

  // Insert DKIM-Signature after existing headers
  if (headerEnd === -1) {
    return `${rawMessage}${CRLF}${dkimHeader}`;
  }

  return `${headerSection}${CRLF}${dkimHeader}${rawMessage.slice(headerEnd)}`;
}

export function createDkimSigner(
  options: DkimOptions,
): (rawMessage: string) => Promise<string> {
  return (rawMessage: string) => signMessage(rawMessage, options);
}
