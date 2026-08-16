import { KiltItem, QRBatch, PurchaseOrder, AuditLog, StaffUser, StaffInvite, CategoryPriceSetting, AlterationTask, DepositLedgerEntry, StoreEmailSettings } from './types';

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

export const INITIAL_ALTERATIONS: AlterationTask[] = [
  {
    id: 'ALT-2026-001',
    taskType: 'PRE_HIRE_FITTING',
    poId: 'PO-2026-1042',
    wearerName: 'Gordon MacLeod (Groom)',
    customerPhone: '07700 900123',
    itemId: 'KILT-1088',
    itemName: 'Royal Stewart Heavyweight 8-Yard Kilt',
    category: 'Kilts',
    sizeGroup: 'Adult',
    originalGarmentSize: 'Waist 36" / Length 24"',
    targetMeasurement: 'Take in waist 2" (36" ➔ 34")',
    adjustmentType: 'WAIST_TAKE_IN',
    instructions: 'Customer measured 34" waist. Move inner buckle strap inwards 2 inches. Double stitch thread.',
    stage: 'QUEUED',
    destination: 'BAG_FOR_CUSTOMER',
    collectionDate: '2026-08-20',
    eventDate: '2026-08-22',
    assignedTailor: 'Mary (Seamstress)',
    createdAt: '2026-08-16 09:30'
  },
  {
    id: 'ALT-2026-002',
    taskType: 'POST_HIRE_RESTOCK_RESET',
    itemId: 'KILT-1092',
    itemName: 'Black Watch 8-Yard Traditional Kilt',
    category: 'Kilts',
    sizeGroup: 'Adult',
    originalGarmentSize: 'Waist 38" (Currently altered to 35")',
    targetMeasurement: 'Reset waist back to standard 38"',
    adjustmentType: 'RESTOCK_RESET',
    instructions: 'Returned from Campbell hire. Shift buckle strap back out to standard 38" position for store shelf restock.',
    stage: 'IN_PROGRESS',
    destination: 'RESTOCK_TO_SHELVES',
    assignedTailor: 'John (Tailor)',
    createdAt: '2026-08-15 14:00',
    startedAt: '2026-08-16 08:30'
  }
];

export const INITIAL_DEPOSIT_LEDGER_ENTRIES: DepositLedgerEntry[] = [
  {
    id: 'LEDGER-001',
    entryType: 'DEPOSIT_RETAINED',
    poId: 'PO-2026-0089',
    customerName: 'Robert Menzies',
    itemId: 'KILT-1044',
    itemName: 'Royal Stewart 8-Yard Kilt',
    amount: 35.00,
    reason: 'Deep red wine spill on front apron requiring specialized organic stain extraction.',
    vendorOrPayer: 'Customer (Robert Menzies)',
    date: '2026-08-14 11:30',
    recordedByStaff: 'Allan',
    status: 'SETTLED',
    notes: '£35 deducted from £50 held deposit. Remaining £15 returned to customer.'
  },
  {
    id: 'LEDGER-002',
    entryType: 'EXPENSE_DRY_CLEANING',
    poId: 'PO-2026-0089',
    customerName: 'Robert Menzies',
    itemId: 'KILT-1044',
    itemName: 'Royal Stewart 8-Yard Kilt',
    amount: 22.50,
    reason: 'Specialty dry cleaning & wool stain lifting invoice.',
    vendorOrPayer: 'Highland Sparkle Cleaners Ltd',
    invoiceRef: 'INV-HSC-8841',
    date: '2026-08-15 09:15',
    recordedByStaff: 'Allan',
    status: 'SETTLED',
    notes: 'Paid via shop BACS.'
  },
  {
    id: 'LEDGER-003',
    entryType: 'DEPOSIT_RETAINED',
    poId: 'PO-2026-0074',
    customerName: 'Fraser MacGregor',
    itemId: 'JKT-2005',
    itemName: 'Prince Charlie Black Jacket',
    amount: 40.00,
    reason: 'Torn interior satin lining and broken sleeve button from wedding ceilidh dance.',
    vendorOrPayer: 'Customer (Fraser MacGregor)',
    date: '2026-08-12 16:45',
    recordedByStaff: 'Allan',
    status: 'SETTLED',
    notes: 'Full £40 deposit retained against repairs.'
  },
  {
    id: 'LEDGER-004',
    entryType: 'EXPENSE_TAILOR_REPAIR',
    poId: 'PO-2026-0074',
    customerName: 'Fraser MacGregor',
    itemId: 'JKT-2005',
    itemName: 'Prince Charlie Black Jacket',
    amount: 28.00,
    reason: 'Lining seam restitching & silver embossed button replacement.',
    vendorOrPayer: 'Mary (Seamstress Workshop)',
    invoiceRef: 'SEW-2026-042',
    date: '2026-08-13 14:00',
    recordedByStaff: 'Allan',
    status: 'SETTLED',
    notes: 'Completed in house.'
  },
  {
    id: 'LEDGER-005',
    entryType: 'EXPENSE_REPLACEMENT',
    poId: 'PO-2026-0061',
    customerName: 'Calum Sinclair',
    itemId: 'SPO-3012',
    itemName: 'Dress Sporran Antique Thistle',
    amount: 45.00,
    reason: 'Sporran lost / not returned by client. Full deposit forfeited and replacement unit ordered.',
    vendorOrPayer: 'Highland Leathercrafters Wholesale',
    invoiceRef: 'HLW-9901',
    date: '2026-08-10 10:20',
    recordedByStaff: 'Allan',
    status: 'SETTLED',
    notes: 'Unit replaced in active inventory.'
  }
];

export const DEFAULT_STORE_EMAIL_SETTINGS: StoreEmailSettings = {
  storeName: 'Highland Kiltmakers',
  senderEmail: 'sales@scottishhighlandkilthire.co.uk',
  storePhone: '0131 555 1234',
  storeAddress: '123 High Street, Edinburgh, EH1 1AA',
  storeOpeningHours: 'Mon - Sat: 9:00am - 5:30pm | Sun: Closed',
  brandColor: '#b45309', // Highland Amber
  bookingConfirmation: {
    headline: 'Booking Confirmation & PayPal Invoice',
    customIntro: 'Thank you for choosing Highland Kiltmakers! Your bespoke outfit reservation has been confirmed in our store schedule.',
    paypalNotice: 'Instant secure online payment via PayPal or Credit/Debit card.',
    policyNotice: 'Please bring photo ID when collecting your hire outfit from our shop.',
    showMeasurements: true
  },
  collectionReady: {
    headline: 'Your Highland Kilt Outfit is Ready for Collection!',
    customIntro: 'Great news! Your outfit has been picked, inspected, custom fitted, and bagged on our shop floor collection rail.',
    idRequirementNotice: 'Please present your Order Reference or Photo ID at the counter.',
    parkingOrPickupTips: 'Free customer parking is available at the rear of the store.'
  },
  returnReminder: {
    headline: 'Reminder: Kilt Hire Return Due Tomorrow',
    customIntro: 'We hope you had a fantastic event! This is a friendly reminder that your hire outfit is due back to our store tomorrow.',
    checklistNotice: 'Please ensure all accessories (sporran, belt, socks, shoes, and cufflinks) are inside your garment bag.',
    depositRefundNotice: 'Your security deposit will be promptly refunded back to your payment card upon safe return check-in.'
  },
  overdueAlert: {
    headline: 'URGENT NOTICE: Overdue Garment Return',
    customIntro: 'Our records indicate that your hired Highland outfit is now overdue for return to our store.',
    urgencyStatement: 'Our hire outfits are strictly reserved for upcoming events. Unreturned garments cause immediate booking conflicts for other customers.',
    depositForfeitureNotice: 'Security deposits will be forfeited for unnotified late returns to cover rescheduling disruption and replacement costs.'
  }
};
