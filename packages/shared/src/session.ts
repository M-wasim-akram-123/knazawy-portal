/**
 * Browser sessions. The access token lives in an httpOnly cookie that page scripts cannot read.
 * Each app names itself in a header on every request; the API reads that app's cookie only when
 * the header is present. A form or link on another site cannot add the header, so it cannot act
 * with the cookie (cross-site request forgery), and the staff and airline apps on one browser
 * keep separate sessions.
 */

export const SESSION_CLIENTS = ['staff', 'portal'] as const;

export type SessionClient = (typeof SESSION_CLIENTS)[number];

/** Request header carrying the app's name. Lower case, as Node delivers it. */
export const SESSION_CLIENT_HEADER = 'x-karam-client';

export function isSessionClient(value: unknown): value is SessionClient {
  return typeof value === 'string' && (SESSION_CLIENTS as readonly string[]).includes(value);
}

export function sessionCookieName(client: SessionClient): string {
  return `kz_${client}_session`;
}
