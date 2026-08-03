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
  status: ItemStatus;
  currentPoId?: string; // Linked PO when on hire
  registeredAt: string;
  registeredByStaff?: string;
  conditionNotes?: string;
  laundryHistory?: LaundryRecord[];
  repairHistory?: RepairRecord[];
  retiredReason?: string; // Audit explanation if retired from rotation (Sold, Stolen, Destroyed)
  retiredAt?: string;
  retiredByStaff?: string;
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

export interface PurchaseOrder {
  id: string; // e.g. "PO-2026-9011"
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventDate: string;
  hireStartDate: string;
  hireEndDate: string;
  items: POLineItem[];
  itemizedSubtotal: number;
  fullRigoutCapApplied: boolean;
  fullRigoutDiscount: number;
  totalHireFee: number;
  totalDepositHeld: number;
  paypalTransactionId?: string;
  paymentStatus: 'PAID_WITH_DEPOSIT' | 'DEPOSIT_PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';
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

export interface StaffUser {
  id: string;
  name: string;
  role: 'Master Admin' | 'Senior Hire Specialist' | 'Inventory & Workshop Staff';
  email: string;
  pin: string;
  avatar?: string;
  registeredAt: string;
}

export interface StaffInvite {
  id: string;
  code: string;
  email: string;
  role: 'Senior Hire Specialist' | 'Inventory & Workshop Staff';
  createdAt: string;
  createdByName: string;
  status: 'PENDING' | 'REGISTERED' | 'EXPIRED';
  usedAt?: string;
}
