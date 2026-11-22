import { GmailMessagePreview, InvestmentMilestone } from '../types/simulator';

function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
  } catch {
    return 'Asia/Karachi';
  }
}

function buildEventPayload(milestone: InvestmentMilestone) {
  const timeZone = getLocalTimeZone();
  const startIso = `${milestone.isoDate}T09:00:00`;
  const endIso = `${milestone.isoDate}T09:30:00`;

  return {
    summary: `PakFX: ${milestone.title}`,
    location: 'PakFX Planner · USD/PKR Market',
    description: milestone.details,
    start: {
      dateTime: startIso,
      timeZone,
    },
    end: {
      dateTime: endIso,
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 60 },
      ],
    },
  };
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  milestone: InvestmentMilestone
): Promise<{ id: string; htmlLink: string }> {
  const payload = buildEventPayload(milestone);
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Google Calendar permission expired or not granted. Please sign in with Google again to authorize Calendar access.'
      );
    }
    throw new Error(`Calendar API error (${res.status}): ${errText}`);
  }

  const created = (await res.json()) as { id: string; htmlLink?: string };
  const safeHtmlLink =
    typeof created.htmlLink === 'string' && created.htmlLink.startsWith('https://')
      ? created.htmlLink
      : '';
  return {
    id: created.id,
    htmlLink: safeHtmlLink,
  };
}

function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmailReport(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    bodyText: string;
  }
): Promise<{ id: string }> {
  const cleanTo = params.to.trim();
  const cleanSubject = params.subject.replace(/[\r\n]/g, ' ').trim();
  const utf8Subject = `=?UTF-8?B?${btoa(
    unescape(encodeURIComponent(cleanSubject))
  )}?=`;

  const rawMime = [
    `To: ${cleanTo}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.bodyText,
  ].join('\r\n');

  const encoded = encodeBase64UrlUtf8(rawMime);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Gmail send permission expired or not granted. Please sign in with Google again to authorize Gmail.'
      );
    }
    throw new Error(`Gmail API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export async function fetchRecentFxEmails(
  accessToken: string,
  searchQuery = 'USD OR PKR OR exchange OR PakFX'
): Promise<GmailMessagePreview[]> {
  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('maxResults', '6');
  if (searchQuery.trim()) {
    listUrl.searchParams.set('q', searchQuery.trim());
  }

  const listRes = await fetch(listUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!listRes.ok) {
    if (listRes.status === 401 || listRes.status === 403) {
      throw new Error(
        'Gmail read permission expired or not granted. Please sign in with Google again.'
      );
    }
    throw new Error(`Failed to list Gmail messages (${listRes.status})`);
  }

  const listJson = (await listRes.json()) as {
    messages?: Array<{ id: string }>;
  };
  const messageIds = (listJson.messages ?? []).slice(0, 6);
  if (messageIds.length === 0) return [];

  const details = await Promise.all(
    messageIds.map(async ({ id }) => {
      const msgUrl = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`
      );
      msgUrl.searchParams.set('format', 'metadata');
      msgUrl.searchParams.append('metadataHeaders', 'Subject');
      msgUrl.searchParams.append('metadataHeaders', 'From');
      msgUrl.searchParams.append('metadataHeaders', 'Date');

      const msgRes = await fetch(msgUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) return null;

      const msgJson = (await msgRes.json()) as {
        id: string;
        snippet?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
        };
      };

      const headers = msgJson.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      return {
        id: msgJson.id,
        subject: getHeader('Subject') || '(No subject)',
        from: getHeader('From') || 'Unknown sender',
        date: getHeader('Date') || '',
        snippet: msgJson.snippet ?? '',
      } satisfies GmailMessagePreview;
    })
  );

  return details.filter((item): item is GmailMessagePreview => item !== null);
}
