/** A message for one signed-in user. It is not an email or a text message. */
export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  entity: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
}

/** Sent down a user's live stream the moment a notification is written for them. */
export interface NotificationPing {
  title: string;
  body: string;
  entity: string;
  entityId: string;
}
