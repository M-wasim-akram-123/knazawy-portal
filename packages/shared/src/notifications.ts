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
