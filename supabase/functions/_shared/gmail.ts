export const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export function getLovableApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return key;
}

export function getGoogleMailApiKey(): string {
  const key = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!key) throw new Error("GOOGLE_MAIL_API_KEY not configured");
  return key;
}

function b64urlUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeader(value: string): string {
  // RFC 2047 encoding for non-ASCII headers (subject, names)
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

export function createRawEmail(
  to: string,
  subject: string,
  body: string,
  options: { html?: boolean; replyTo?: string; inReplyTo?: string; references?: string; cc?: string[] } = {}
): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ];
  if (options.cc && options.cc.length) lines.push(`Cc: ${options.cc.join(", ")}`);
  if (options.replyTo) lines.push(`Reply-To: ${options.replyTo}`);
  if (options.inReplyTo) lines.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) lines.push(`References: ${options.references}`);
  lines.push(
    `Content-Type: ${options.html ? "text/html" : "text/plain"}; charset="UTF-8"`,
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  );
  return b64urlUtf8(lines.join("\r\n"));
}

export async function sendGmailMessage(raw: string, threadId?: string | null): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getLovableApiKey()}`,
      "X-Connection-Api-Key": getGoogleMailApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed [${res.status}]: ${text}`);
  }

  return await res.json();
}

/** Returns the RFC822 Message-ID header of a sent Gmail message. */
export async function getRfcMessageId(messageId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GATEWAY_URL}/users/me/messages/${messageId}?format=metadata&metadataHeaders=Message-ID`,
      {
        headers: {
          "Authorization": `Bearer ${getLovableApiKey()}`,
          "X-Connection-Api-Key": getGoogleMailApiKey(),
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const h = (data.payload?.headers || []).find((x: any) => x.name?.toLowerCase() === "message-id");
    return h?.value || null;
  } catch {
    return null;
  }
}

export async function listUnreadMessages(maxResults = 50): Promise<any[]> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages?q=${encodeURIComponent("is:unread in:inbox newer_than:7d subject:Commande")}&maxResults=${maxResults}`, {
    headers: {
      "Authorization": `Bearer ${getLovableApiKey()}`,
      "X-Connection-Api-Key": getGoogleMailApiKey(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail list failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data.messages || [];
}

export async function getGmailMessage(messageId: string): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/${messageId}?format=full`, {
    headers: {
      "Authorization": `Bearer ${getLovableApiKey()}`,
      "X-Connection-Api-Key": getGoogleMailApiKey(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get failed [${res.status}]: ${text}`);
  }

  return await res.json();
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getLovableApiKey()}`,
      "X-Connection-Api-Key": getGoogleMailApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail modify failed [${res.status}]: ${text}`);
  }
}

function decodeB64Utf8(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Removes quoted previous messages from an email reply. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^(On|Le) .+(wrote|écrit)\s*:?\s*$/i.test(line.trim())) break;
    if (/^-{2,}\s*(Original Message|Message d'origine)/i.test(line.trim())) break;
    if (/^(From|De)\s*:.+/i.test(line.trim()) && out.length > 0) break;
    out.push(line);
  }
  const result = out.join("\n").trim();
  return result || text.trim();
}

export function extractTextBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return decodeB64Utf8(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeB64Utf8(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.body?.data) {
        return decodeB64Utf8(part.body.data);
      }
    }
  }
  return "";
}

export function extractOrderNumber(subject: string): string | null {
  const match = subject.match(/RC\d+/i);
  return match ? match[0].toUpperCase() : null;
}

export interface GmailAttachmentRef { filename: string; mimeType: string; attachmentId: string; size: number }

/** Recursively collects file attachments (including inline images with a filename). */
export function listAttachments(payload: any, out: GmailAttachmentRef[] = []): GmailAttachmentRef[] {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId) {
    out.push({ filename: payload.filename, mimeType: payload.mimeType || "application/octet-stream", attachmentId: payload.body.attachmentId, size: payload.body.size || 0 });
  }
  for (const p of payload.parts || []) listAttachments(p, out);
  return out;
}

export async function getAttachmentBytes(messageId: string, attachmentId: string): Promise<Uint8Array> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { "Authorization": `Bearer ${getLovableApiKey()}`, "X-Connection-Api-Key": getGoogleMailApiKey() },
  });
  if (!res.ok) throw new Error(`Gmail attachment failed [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  const bin = atob(String(data.data).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
