import { google } from "googleapis";
import type { CalendarEvent } from "@/lib/types";

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_CALENDAR_ID
  );
}

function toGCalEvent(event: CalendarEvent) {
  return {
    summary: event.title,
    location: event.location ?? undefined,
    description: event.notes ?? undefined,
    start: {
      dateTime: event.start,
      timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? "America/Chicago",
    },
    end: {
      dateTime: event.end ?? event.start,
      timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? "America/Chicago",
    },
  };
}

export async function createGCalEvent(event: CalendarEvent): Promise<{ gcalId: string } | null> {
  const auth = getOAuthClient();
  if (!auth) return null;

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: toGCalEvent(event),
  });

  return data.id ? { gcalId: data.id } : null;
}

export async function updateGCalEvent(gcalId: string, event: CalendarEvent): Promise<void> {
  const auth = getOAuthClient();
  if (!auth) return;

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.update({
    calendarId,
    eventId: gcalId,
    requestBody: toGCalEvent(event),
  });
}

export async function deleteGCalEvent(gcalId: string): Promise<void> {
  const auth = getOAuthClient();
  if (!auth) return;

  const calendarId = process.env.GOOGLE_CALENDAR_ID!;
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({ calendarId, eventId: gcalId });
}
