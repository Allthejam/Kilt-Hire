export type ItemCategory = 
  | 'Kilts'
  | 'Jackets'
  | 'Waistcoats'
  | 'Sporrans'
  | 'Ghillie Brogues'
  | 'Shirts'
  | 'Socks & Garters'
  | 'Belts & Buckles'
  | 'Sgian-dubh (Knife)'
  | 'Miscellaneous';

export type ItemStatus = 'AVAILABLE' | 'ON_HIRE' | 'NEEDS_CLEANING' | 'IN_REPAIR' | 'RETIRED';

export type SizeGroup = 'Adult' | 'Kid';

export interface CategoryPriceSetting {
  category: ItemCategory;
  adultHireRate: number;
  adultDeposit: number;
  kidHireRate: number;
  kidDeposit: number;
}

export interface LaundryRecord {
  id: string;
  dateSent: string;
  sentByStaff: string;
  cleanerName?: string;
  dateReturned?: string;
  returnedByStaff?: string;
  notes?: string;
}

export interface RepairRecord {
  id: string;
  dateSent: string;
  sentByStaff: string;
  reason: string;
  severity: 'Minor' | 'Medium' | 'Severe';
  dateFixed?: string;
  fixedByStaff?: string;
  fixedNotes?: string;
}

export interface CalendarNote {
  id: string;
  date: string;
  text: string;
  type: 'NOTE' | 'EVENT' | 'CLOSURE';
  createdAt: string;
  createdByStaff?: string;
}

export interface KiltItem {
  id: string; // The QR code text, e.g. "KILT-1088" or "KILT-KID-501"
  name: string; // e.g. "Royal Stewart Heavyweight 8-Yard Kilt"
  category: ItemCategory;
  sizeGroup: SizeGroup; // 'Adult' vs 'Kid'
  tartanOrColour: string; // e.g. "Royal Stewart" or "Midnight Black"
  size: string; // e.g. "Waist 34 / Length 24" or "Kids 8Y"
  brandMake?: string;
  hireRate: number; // Single item hire rate
  depositAmount: number; // Deposit required
  purchaseCost?: number; // Initial wholesale purchase cost for ROI tracking
  status: ItemStatus;
  currentPoId?: string; // Linked PO when on hire
  registeredAt: string;
  registeredByStaff?: string;
  conditionNotes?: string;
  laundryHistory?: LaundryRecord[];
  repairHistory?: RepairRecord[];
  isBulkPool?: boolean; // True for bulk bin items (Sgian-dubhs, Kilt Pins, Belts, Garters)
  bulkQuantity?: number; // Current available count in shop bin
  bulkTotal?: number; // Total pool inventory count
  retiredReason?: string; // Audit explanation if retired from rotation (Sold, Stolen, Destroyed)
  retiredAt?: string;
  retiredByStaff?: string;
  isOutsourcedDefault?: boolean; // True for default sub-hire items hired in from external stores
  outsourcedSupplier?: string; // e.g. "Highland Scottish Supplies Ltd", "Lochcarron Sub-Hire"
  outsourcedWholesaleCost?: number; // Cost paid to external supplier to hire in
}

export interface QRReprintLog {
  id: string;
  reprintedAt: string;
  reprintedByStaff: string;
  reprintedCodes: string[];
  reason?: string;
}

export interface QRBatch {
  id: string;
  title: string;
  category: ItemCategory;
  sizeGroup: SizeGroup;
  count: number;
  createdAt: string;
  createdByName: string;
  qrCodes: string[]; // List of generated QR string IDs
  isPrinted?: boolean;
  printedAt?: string;
  printedBy?: string;
  reprintHistory?: QRReprintLog[];
}

export interface CustomerMeasurements {
  waistInches?: number;
  chestInches?: number;
  sleeveLengthInches?: number;
  kiltLengthInches?: number;
  shoeSize?: string;
  heightFtInches?: string;
  jacketStylePreference?: string;
  tartanPreference?: string;
  notes?: string;
}

export type POOrderStatus = 
  | 'FITTING_DRAFT' 
  | 'RESERVED_PENDING_PAYMENT' 
  | 'DEPOSIT_PAID_CONFIRMED' 
  | 'ASSEMBLY_DUE' 
  | 'READY_FOR_COLLECTION' 
  | 'OUT_ON_HIRE' 
  | 'RETURNED_COMPLETED' 
  | 'CANCELLED';

export interface POLineItem {
  qrCodeId: string;
  itemName: string;
  category: ItemCategory;
  sizeGroup: SizeGroup;
  size: string;
  hireRate: number;
  depositAmount: number;
  returned: boolean;
  returnedAt?: string;
  returnCondition?: 'GOOD_CLEAN' | 'NEEDS_CLEANING' | 'NEEDS_REPAIR' | 'MISSING';
  depositAction?: 'REFUNDED' | 'HELD_FOR_REPAIR' | 'HELD_FOR_MISSING';
  notes?: string;
}

export interface CancellationRecord {
  cancelledAt: string;
  cancelledByStaff: string;
  reason: string;
  depositRefundStatus: 'FULL_REFUND_ISSUED' | 'DEPOSIT_FORFEITED' | 'NO_DEPOSIT_WAS_PAID';
  refundAmount: number;
}

export interface PurchaseOrder {
  id: string; // e.g. "PO-2026-9011"
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventDate: string; // YYYY-MM-DD
  hireStartDate: string; // YYYY-MM-DD (Pick-up)
  hireEndDate: string; // YYYY-MM-DD (Return)
  items: POLineItem[];
  itemizedSubtotal: number;
  fullRigoutCapApplied: boolean;
  fullRigoutDiscount: number;
  totalHireFee: number;
  totalDepositHeld: number;
  paypalTransactionId?: string;
  paymentStatus: 'UNPAID' | 'PARTIAL_DEPOSIT' | 'PAID_WITH_DEPOSIT' | 'FULL_BALANCE_PAID' | 'REFUNDED' | 'FULLY_REFUNDED' | 'DEPOSIT_PARTIALLY_REFUNDED' | 'CANCELLED';
  orderStatus: POOrderStatus;
  measurements?: CustomerMeasurements;
  depositPaymentMethod?: 'PAYPAL_ONLINE' | 'CARD_IN_STORE' | 'CASH_IN_STORE' | 'IN_STORE_CASH' | 'IN_STORE_CARD' | 'PAPER_DIARY_LEGACY';
  depositPaidAt?: string;
  cancellationRecord?: CancellationRecord;
  balancePaidAt?: string;
  assembledAt?: string;
  assembledByStaff?: string;
  readyNotificationSentAt?: string;
  issuedByStaff: string;
  createdAt: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  staffName: string;
  action: string;
  details: string;
  relatedQrCode?: string;
}

export type StaffRole = 'Master Admin' | 'Admin' | 'Shop Assistant' | 'Senior Hire Specialist' | 'Inventory & Workshop Staff';

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
  pin: string;
  avatar?: string;
  registeredAt: string;
}

export interface StaffInvite {
  id: string;
  code: string;
  email: string;
  role: StaffRole;
  createdAt: string;
  createdByName: string;
  status: 'PENDING' | 'REGISTERED' | 'EXPIRED';
  usedAt?: string;
}

