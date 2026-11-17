import type { CommonCopy, chromeCopy } from '@knazawy/i18n';
import type { Role } from '@knazawy/shared';

import { canAccessStaffPath } from './staff-access';

/**
 * The staff app is organised by job, not by database table. Each role sees its own work first,
 * and the menu hides anything the role cannot open. Permission checks stay in staff-access.
 * Labels are copy keys, so the menu follows the chosen language.
 */

type Common = CommonCopy;
type Chrome = (typeof chromeCopy)['en'];

export type WorkspaceKey = 'orders' | 'stock' | 'kitchen' | 'billing' | 'setup';

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  key: WorkspaceKey | 'home';
  label: string;
  links: NavLink[];
}

const GROUPS: Record<WorkspaceKey, { label: keyof Common; links: Array<[string, keyof Common]> }> =
  {
    orders: {
      label: 'navOrders',
      links: [
        ['/requests', 'airlineOrders'],
        ['/room-requests', 'roomRequests'],
        ['/deliveries', 'deliveries'],
      ],
    },
    stock: {
      label: 'navStock',
      links: [
        ['/store', 'stockOnHand'],
        ['/bills', 'goodsIn'],
        ['/purchases', 'purchaseOrders'],
        ['/issues', 'issueStock'],
        ['/transfers', 'transferStock'],
        ['/counts', 'countStock'],
      ],
    },
    kitchen: {
      label: 'navKitchen',
      links: [
        ['/recipes', 'recipes'],
        ['/production', 'production'],
        ['/meal-cost', 'mealCost'],
        ['/forecast', 'forecast'],
      ],
    },
    billing: {
      label: 'navBilling',
      links: [
        ['/invoices', 'invoices'],
        ['/room-bills', 'roomBills'],
        ['/rates', 'rateCards'],
        ['/disputes', 'disputes'],
        ['/ledger', 'ledger'],
      ],
    },
    setup: {
      label: 'navSetup',
      links: [
        ['/users', 'users'],
        ['/airlines', 'airlines'],
        ['/items', 'items'],
        ['/suppliers', 'suppliers'],
        ['/locations', 'locations'],
        ['/rooms', 'rooms'],
        ['/branches', 'branches'],
      ],
    },
  };

/** The order a role sees its menu in. Its own job comes first; setup is always last. */
const ROLE_ORDER: Partial<Record<Role, WorkspaceKey[]>> = {
  OPERATIONS_MANAGER: ['orders', 'stock', 'kitchen', 'billing', 'setup'],
  STOREKEEPER: ['stock', 'orders', 'kitchen', 'billing', 'setup'],
  KITCHEN_LEAD: ['kitchen', 'orders', 'stock', 'billing', 'setup'],
  FINANCE_OFFICER: ['billing', 'orders', 'stock', 'kitchen', 'setup'],
  ADMINISTRATOR: ['orders', 'stock', 'kitchen', 'billing', 'setup'],
};

const WORKSPACE_NAMES: Partial<Record<Role, keyof Chrome>> = {
  OPERATIONS_MANAGER: 'wsOperations',
  STOREKEEPER: 'wsStore',
  KITCHEN_LEAD: 'wsKitchen',
  FINANCE_OFFICER: 'wsFinance',
  ADMINISTRATOR: 'wsAdministration',
};

export function workspaceName(role: Role, chrome: Chrome): string {
  return chrome[WORKSPACE_NAMES[role] ?? 'wsStaff'];
}

export function navigationFor(role: Role, common: Common): NavGroup[] {
  const order = ROLE_ORDER[role] ?? ['orders', 'stock', 'kitchen', 'billing', 'setup'];
  const home: NavGroup = {
    key: 'home',
    label: common.home,
    links: [{ href: '/', label: common.today }],
  };
  return [
    home,
    ...order.map((key) => ({
      key,
      label: common[GROUPS[key].label],
      links: GROUPS[key].links.map(([href, label]) => ({ href, label: common[label] })),
    })),
  ]
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => canAccessStaffPath(role, link.href)),
    }))
    .filter((group) => group.links.length > 0);
}

export interface WorkStep {
  href: string;
  title: string;
  description: string;
}

/** The few things each role does day to day, in the order they happen. */
const ROLE_STEPS: Partial<Record<Role, Array<[string, keyof Chrome, keyof Chrome]>>> = {
  OPERATIONS_MANAGER: [
    ['/requests', 'opsOrdersTitle', 'opsOrdersText'],
    ['/room-requests', 'opsRoomsTitle', 'opsRoomsText'],
    ['/deliveries', 'opsDeliverTitle', 'opsDeliverText'],
    ['/forecast', 'opsWeekTitle', 'weekText'],
  ],
  STOREKEEPER: [
    ['/store', 'storeStockTitle', 'storeStockText'],
    ['/bills', 'storeGoodsTitle', 'storeGoodsText'],
    ['/issues', 'storeIssueTitle', 'storeIssueText'],
    ['/counts', 'storeCountTitle', 'storeCountText'],
  ],
  KITCHEN_LEAD: [
    ['/requests', 'kitchenOrdersTitle', 'kitchenOrdersText'],
    ['/recipes', 'kitchenRecipesTitle', 'kitchenRecipesText'],
    ['/production', 'kitchenCookTitle', 'kitchenCookText'],
    ['/forecast', 'kitchenWeekTitle', 'weekText'],
  ],
  FINANCE_OFFICER: [
    ['/invoices', 'financeInvoicesTitle', 'financeInvoicesText'],
    ['/rates', 'financeRatesTitle', 'financeRatesText'],
    ['/disputes', 'financeDisputesTitle', 'financeDisputesText'],
    ['/ledger', 'financeLedgerTitle', 'financeLedgerText'],
  ],
  ADMINISTRATOR: [
    ['/requests', 'adminOrdersTitle', 'adminOrdersText'],
    ['/store', 'adminStockTitle', 'adminStockText'],
    ['/recipes', 'adminKitchenTitle', 'adminKitchenText'],
    ['/users', 'adminSetupTitle', 'adminSetupText'],
  ],
};

export function stepsFor(role: Role, chrome: Chrome): WorkStep[] {
  return (ROLE_STEPS[role] ?? [])
    .filter(([href]) => canAccessStaffPath(role, href))
    .map(([href, title, description]) => ({
      href,
      title: chrome[title],
      description: chrome[description],
    }));
}
