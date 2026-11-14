import type { OrganisationType, Role, UserStatus } from './enums';

export interface OrganisationRef {
  id: string;
  type: OrganisationType;
  name: string;
}

/** Signed-in user. The API reloads this from the database on each request. */
export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
  organisationId: string;
}

export interface UserRef {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  organisationId: string;
}
