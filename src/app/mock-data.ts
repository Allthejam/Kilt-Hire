import { KiltItem, QRBatch, PurchaseOrder, AuditLog, StaffUser, StaffInvite, CategoryPriceSetting } from './types';

export const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'STAFF-0001',
    name: 'Allan',
    role: 'Master Admin',
    email: 'admin@kilt-hire.co.uk',
    pin: '1234',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    registeredAt: '2026-05-01 09:00'
  }
];

export const INITIAL_INVITES: StaffInvite[] = [];

// Master Pricing Matrix (Duplicated for Adults and Kids)
export const DEFAULT_PRICING_MATRIX: CategoryPriceSetting[] = [
  { category: 'Kilts', adultHireRate: 50, adultDeposit: 50, kidHireRate: 35, kidDeposit: 35, allowAlterations: true },
  { category: 'Jackets', adultHireRate: 50, adultDeposit: 50, kidHireRate: 30, kidDeposit: 30, allowAlterations: true },
  { category: 'Waistcoats', adultHireRate: 20, adultDeposit: 20, kidHireRate: 15, kidDeposit: 15, allowAlterations: true },
  { category: 'Sporrans', adultHireRate: 15, adultDeposit: 15, kidHireRate: 10, kidDeposit: 10, allowAlterations: false },
  { category: 'Ghillie Brogues', adultHireRate: 15, adultDeposit: 15, kidHireRate: 10, kidDeposit: 10, allowAlterations: false },
  { category: 'Shirts', adultHireRate: 10, adultDeposit: 10, kidHireRate: 8, kidDeposit: 8, allowAlterations: false },
  { category: 'Socks & Garters', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Belts & Buckles', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Sgian-dubh (Knife)', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Miscellaneous', adultHireRate: 10, adultDeposit: 10, kidHireRate: 5, kidDeposit: 5, allowAlterations: false }
];

export const INITIAL_ITEMS: KiltItem[] = [];

export const INITIAL_BATCHES: QRBatch[] = [];

export const INITIAL_POS: PurchaseOrder[] = [];

export const INITIAL_LOGS: AuditLog[] = [];
