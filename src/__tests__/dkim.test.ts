import { describe, it, expect } from "vitest";
import { signMessage, createDkimSigner } from "../dkim.js";
import type { DkimOptions } from "../dkim.js";

const KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCyfpEIFQocXGNP
hCjNzkgzTPKDDlnCHZbY57dc4DYUScxxJBnIskI/IFzx/nZAYqxwIofBEPQSlJ09
jJS4eqJyFoqaHxN1UokGpVVgT4MULnFMrzn8VE4hGB1ClJkKTc3/QHuOVupSg8dQ
fGa6yZENxFpCeLIYmKNndQcQbfy1e7xUTx3sbenBX/myO2MRaSpDCIX3lR2HC5bq
uoTVKLrEpSX7oVyqpMbPWZ1JNVOj2r0pGQWELrCOLf4yS3bkvd/Wk0sxS5oxs592
KlwYLbZIVqBJzgNBkMXM9j9YR2DbCzlLldxGAqVF1rN6l0AHnUs6aAuNmXKCGPZ1
nV3fDnvrAgMBAAECggEAP+Hzh0h8a2UXeAyNTAdBqPanrwcSUdqkM/JOmnN2d3Fo
NbAdeEpwUkaDbWrMqMOIAsQhARTPvdypoC8xxQrDHAD8TyfDH5DQEOxYb5VVjQII
M9Fc9/W2VrraMgub8GejS/Eop2ttBuY6DhDP9ZcRjrNROIwY9Zufk/X69sLemJbc
77kovEmudeTTpjt12XSQlFwee0ISCRmWBf0KU1r26JrR+TAhYV24t/Mfcbkdq7bD
SlhqyljeRVt2+15jpE2GAIaH2KSDivoADoLLK50lHB/D4xDfooPup4SVvLRm3+fm
JoRH9iKtWeJw0LsVot0xIP7Xu45OJIBLBy/7ST8DhQKBgQDV6MRFZ2xncUC7UjTW
BPiM/QFLDuA9/e8MXRVpsQMafMj/MidFf6MAFP/CkwoJBN/IMBjewRmamVFP6JgB
vmNkEFQUedl8DZ1aDhacisOim44AHx0lQqiurQUtyFOmHu5+YZv7/8OWVF7ZU7WO
KGREQ539h6pOLUV64jh/iSVVJQKBgQDVndnIpphzbNFp1cuDxFSFRhuhcdERKTY4
n9lqLZndpUBBqGv/2YOqj88QYl/AjT1nLbV4DHqstSRRh3ot6QIGfSzpcQoMSm8R
wpGxEI/6zyumnQ2p5y8FOdPnIT85ARfNPW7Sp38dTOCo688kWNTjgytLCP7E3cCA
oRjHpG4nzwKBgFonSRlLNof+Vl7cjcIpxCt/slzU/zOBY4+dZ5ns7bbrIrdThvOm
kKdHMmfqGs+kS0CO7NxtHAJpXbjE+dO6Tx9sNlOO61d6UXgT+fmuDjfpQZbRhjIe
/wLnjwg1pvObk76WGuzBZchk9Li5rAonAeM3cE3bMK7UK7VXxKITxjU1AoGAYtL/
AOvJlYSfMPY+i7wVWf7AI6VTEjxdoD6bR5rHFxovKvDu3dNULWEQa0UHhT4STRyB
WoNzcVjv72Pcq0ajsDrSv0CTZHI/Bhlca2z9Hwwe5pq7yoFwaFuDY+cmp4mQ6Ftm
XMAud3Cscpl9IBSUkJiLO9ByhMMOHrPokdvJNlMCgYANMCGGQoTSkAYd/qVhAFyq
kprJHwvddUqnYUq2eYVfb6VqI3vFWXimyK3S3eldEtGTpwY+Ak43G1AslA+QDfyo
AonC0OAdBvip5kgfCfnZdGKNbk64oSERTYoRJ5dV1+PZGGcaLnFoFwqJeq0wEPo+
8G+O1zk2n+/mPdmF5ptiHQ==
-----END PRIVATE KEY-----`;

const opts: DkimOptions = { domain: "example.com", selector: "default", privateKey: KEY };

const MSG = [
  "From: sender@example.com",
  "To: recipient@example.com",
  "Subject: Test Subject",
  "Date: Mon, 01 Jan 2024 00:00:00 +0000",
  "Message-ID: <test123@example.com>",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=UTF-8",
  "",
  "Hello World",
].join("\r\n");

describe("DKIM", () => {
  it("adds DKIM-Signature with correct domain/selector", async () => {
    const signed = await signMessage(MSG, opts);
    expect(signed).toContain("DKIM-Signature:");
    expect(signed).toContain("d=example.com");
    expect(signed).toContain("s=default");
    expect(signed).toContain("a=rsa-sha256");
    expect(signed).toContain("v=1");
  });

  it("includes body hash and signature", async () => {
    const signed = await signMessage(MSG, opts);
    expect(signed).toMatch(/bh=[A-Za-z0-9+/=]+/);
    expect(signed).toMatch(/b=[A-Za-z0-9+/=]+/);
  });

  it("preserves original headers and body", async () => {
    const signed = await signMessage(MSG, opts);
    expect(signed).toContain("From: sender@example.com");
    expect(signed).toContain("Subject: Test Subject");
    expect(signed).toContain("Hello World");
  });

  it("supports custom signed headers", async () => {
    const signed = await signMessage(MSG, { ...opts, headers: ["from", "subject"] });
    expect(signed).toMatch(/h=from: subject/);
  });

  it("createDkimSigner returns working signer", async () => {
    const signer = createDkimSigner(opts);
    const signed = await signer(MSG);
    expect(signed).toContain("DKIM-Signature:");
  });
});
