import type { OrganisationType, Role } from './enums';

/** Signed-in user. The API reloads this from the database on each request. */
export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
  organisationId: string;
  /** The branch a Karam user is working in. An airline user has none. */
  branchId?: string | null;
}

/** The signed-in person's own organisation. Partners only ever receive their own. */
export interface AccountRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  organisationId: string;
  organisationCode: string;
  organisationName: string;
  organisationType: OrganisationType;
  branchId: string | null;
  branchName: string | null;
}
