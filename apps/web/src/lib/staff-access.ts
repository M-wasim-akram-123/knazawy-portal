import { can, canRaiseRoomInvoice, isKaramRole, type Role } from '@knazawy/shared';

const routePermissions: Array<{
  path: string;
  allowed: (role: Role) => boolean;
}> = [
  { path: '/purchases', allowed: (role) => can(role, 'purchases', 'R') },
  { path: '/bills', allowed: (role) => can(role, 'stock', 'C') },
  { path: '/store', allowed: (role) => can(role, 'stock', 'R') },
  { path: '/issues', allowed: (role) => can(role, 'stock', 'C') },
  { path: '/transfers', allowed: (role) => can(role, 'stock', 'R') },
  { path: '/counts', allowed: (role) => can(role, 'stock', 'R') },
  { path: '/items', allowed: (role) => can(role, 'stock', 'R') },
  { path: '/suppliers', allowed: (role) => can(role, 'purchases', 'R') },
  { path: '/locations', allowed: (role) => can(role, 'stock', 'R') },
  { path: '/recipes', allowed: (role) => can(role, 'recipes', 'R') },
  { path: '/production', allowed: (role) => can(role, 'recipes', 'R') },
  { path: '/meal-cost', allowed: (role) => can(role, 'recipes', 'R') },
  { path: '/requests', allowed: (role) => can(role, 'service_requests', 'R') },
  { path: '/deliveries', allowed: (role) => can(role, 'distribution', 'R') },
  { path: '/rates', allowed: (role) => can(role, 'service_rates', 'R') },
  { path: '/airlines', allowed: (role) => can(role, 'users', 'R') },
  { path: '/invoices', allowed: (role) => can(role, 'invoices', 'R') },
  { path: '/room-requests', allowed: (role) => can(role, 'room_requests', 'R') },
  { path: '/room-bills', allowed: canRaiseRoomInvoice },
  { path: '/rooms', allowed: (role) => can(role, 'rooms', 'R') },
  { path: '/disputes', allowed: (role) => can(role, 'disputes', 'R') },
  { path: '/ledger', allowed: (role) => can(role, 'ledger', 'R') },
  { path: '/forecast', allowed: (role) => can(role, 'forecast', 'R') },
  { path: '/branches', allowed: (role) => isKaramRole(role) },
];

export function canAccessStaffPath(role: Role, pathname: string): boolean {
  const route = routePermissions.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return route ? route.allowed(role) : true;
}
