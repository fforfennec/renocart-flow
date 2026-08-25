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

export function createRawEmail(
  to: string,
  subject: string,
  body: string,
  options: { html?: boolean; replyTo?: string } = {}
): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];
  if (options.replyTo) {
    lines.push(`Reply-To: ${options.replyTo}`);
  }
  lines.push(
    `Content-Type: ${options.html ? "text/html" : "text/plain"}; charset="UTF-8"`,
    "",
    body,
  );
  const email = lines.join("\r\n");
  return btoa(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmailMessage(raw: string): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getLovableApiKey()}`,
      "X-Connection-Api-Key": getGoogleMailApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed [${res.status}]: ${text}`);
  }

  return await res.json();
}

export async function listUnreadMessages(maxResults = 50): Promise<any[]> {
  const res = await fetch(`${GATEWAY_URL}/users/me/messages?q=is:unread&maxResults=${maxResults}`, {
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

export function extractTextBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      }
    }
    for (const part of payload.parts) {
      if (part.body?.data) {
        return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      }
    }
  }
  return "";
}

export function extractOrderNumber(subject: string): string | null {
  const match = subject.match(/RC\d+/i);
  return match ? match[0].toUpperCase() : null;
}
