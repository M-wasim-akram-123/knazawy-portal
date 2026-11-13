import type { OrganisationType, Role, UserStatus } from './enums';

export interface OrganisationRef {
  id: string;
  type: OrganisationType;
  name: string;
}

export interface UserRef {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  organisationId: string;
}
