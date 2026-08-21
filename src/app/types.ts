export type ItemCategory = string;

export type ItemStatus = 'AVAILABLE' | 'ON_HIRE' | 'NEEDS_CLEANING' | 'IN_REPAIR' | 'RETIRED';

export type SizeGroup = 'Adult' | 'Kid';

export interface CategoryPriceSetting {
  category: ItemCategory;
  adultHireRate: number;
  adultDeposit: number;
  kidHireRate: number;
  kidDeposit: number;
  allowAlterations?: boolean; // Can this garment category be altered / made-to-measure (e.g. Kilts, Jackets) vs fixed (Sporrans, Pins)
}

export interface LaundryRecord {
  id: string;
  dateSent: string;
  sentByStaff: string;
  cleanerName?: string;
  treatmentType?: string; // e.g. "Standard Dry Clean & Steam", "Specialist Wool Wine Stain Extraction"
  cost?: number; // £ cleaning fee attached to this specific item cycle
  invoiceRef?: string; // Receipt / invoice reference number
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
  executionType?: 'IN_HOUSE' | 'OUTSOURCED';
  staffLaborHours?: number;
  staffHourlyRate?: number;
  staffLaborCost?: number;
  outsourcedProviderName?: string;
  outsourcedCost?: number;
  outsourcedInvoiceRef?: string;
  materialsCost?: number;
  cost?: number; // Total repair expense (£)
  dateFixed?: string;
  fixedByStaff?: string;
  fixedNotes?: string;
}

export type AlterationStage = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED';
export type AlterationType = 'PRE_HIRE_FITTING' | 'POST_HIRE_RESTOCK_RESET' | 'REPAIR_SEWING';

export interface AlterationTask {
  id: string; // e.g. "ALT-2026-101"
  taskType: AlterationType;
  poId?: string; // Linked Customer PO (for pre-hire)
  wearerName?: string; // e.g. "Gordon MacLeod"
  customerPhone?: string;
  itemId: string; // QR ID, e.g. "KILT-1088"
  itemName: string; // e.g. "Royal Stewart Heavyweight 8-Yard Kilt"
  category: string; // "Kilts", "Jackets", "Waistcoats"
  sizeGroup: SizeGroup;
  originalGarmentSize: string; // e.g. "Waist 36"
  targetMeasurement: string; // e.g. "Take in waist 2 inches (36\" -> 34\")" or "Reset waist back to standard 36\""
  adjustmentType: 'WAIST_TAKE_IN' | 'WAIST_LET_OUT' | 'HEM_SHORTEN' | 'HEM_LENGTHEN' | 'SLEEVE_SHORTEN' | 'SLEEVE_LENGTHEN' | 'STRAP_BUCKLE' | 'RESTOCK_RESET' | 'OTHER';
  instructions: string;
  stage: AlterationStage;
  destination: 'BAG_FOR_CUSTOMER' | 'RESTOCK_TO_SHELVES';
  collectionDate?: string; // Target completion deadline
  eventDate?: string;
  assignedTailor?: string; // e.g. "Mary (Seamstress)"
  
  // Workshop Accounting & Labor/Outsourced Cost Tracking
  executionType?: 'IN_HOUSE' | 'OUTSOURCED';
  staffLaborHours?: number; // In-house hours spent (e.g. 1.5 hrs)
  staffHourlyRate?: number; // In-house staff hourly rate (£/hr)
  staffLaborCost?: number; // Auto-calculated (hours * rate)
  outsourcedProviderName?: string; // e.g. "Edinburgh Highland Tailoring Ltd"
  outsourcedCost?: number; // External contractor invoice fee (£)
  outsourcedInvoiceRef?: string; // e.g. "INV-8831"
  materialsCost?: number; // Cost of buckles, straps, lining, thread (£)
  totalCost?: number; // Total job expense (labor/outsourced + materials)
  isSyncedToExpenses?: boolean; // Posted to statutory P&L / loss ledger
  expenseLedgerEntryId?: string;
  
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export type DepositLedgerEntryType = 
  | 'DEPOSIT_RETAINED' 
  | 'EXPENSE_DRY_CLEANING' 
  | 'EXPENSE_SPECIALIST_CLEANING'
  | 'EXPENSE_TAILOR_REPAIR' 
  | 'EXPENSE_OUTSOURCED_ALTERATION'
  | 'EXPENSE_IN_HOUSE_LABOR'
  | 'EXPENSE_REPLACEMENT' 
  | 'DEPOSIT_REFUNDED';

export interface DepositLedgerEntry {
  id: string;
  entryType: DepositLedgerEntryType;
  poId?: string;
  customerName?: string;
  itemId?: string;
  itemName?: string;
  amount: number; // £ positive value
  reason: string;
  vendorOrPayer?: string; // e.g. "Customer (Gordon MacLeod)", "Highland Dry Cleaners Ltd", "Mary (Seamstress)"
  invoiceRef?: string; // Receipt / invoice number
  date: string;
  recordedByStaff: string;
  status: 'SETTLED' | 'PENDING_INVOICE';
  notes?: string;
}

export interface StoreEmailSettings {
  storeName: string;
  senderEmail: string;
  storePhone: string;
  storeAddress: string;
  storeOpeningHours: string;
  brandColor: string; // e.g. '#b45309'
  bookingConfirmation: {
    headline: string;
    customIntro: string;
    paypalNotice: string;
    policyNotice: string;
    showMeasurements: boolean;
  };
  paymentReceiptInvoice: {
    headline: string;
    customIntro: string;
    taxOrVatNotice: string;
    depositPolicyStatement: string;
    showItemizedSummary: boolean;
  };
  orderCancellation: {
    headline: string;
    customIntro: string;
    depositRetentionPolicy: string;
    refundProcessingNotice: string;
    supportContactPrompt: string;
  };
  collectionReady: {
    headline: string;
    customIntro: string;
    idRequirementNotice: string;
    parkingOrPickupTips: string;
  };
  returnReminder: {
    headline: string;
    customIntro: string;
    checklistNotice: string;
    depositRefundNotice: string;
  };
  overdueAlert: {
    headline: string;
    customIntro: string;
    urgencyStatement: string;
    depositForfeitureNotice: string;
  };
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
  currentAssetValue?: number; // Current market/asset valuation of the garment
  status: ItemStatus;
  currentPoId?: string; // Linked PO when on hire
  registeredAt: string;
  registeredByStaff?: string;
  conditionNotes?: string;
  laundryHistory?: LaundryRecord[];
  totalLifetimeCleaningCost?: number; // Cumulative cleaning outlay on this specific garment
  repairHistory?: RepairRecord[];
  totalLifetimeRepairCost?: number; // Cumulative repair & alteration outlay on this specific garment
  isBulkPool?: boolean; // True for bulk bin items (Sgian-dubhs, Kilt Pins, Belts, Garters)
  bulkQuantity?: number; // Current available count in shop bin
  bulkTotal?: number; // Total pool inventory count
  boxNumber?: string; // e.g. "Box 1", "Box 2", "Bin A"
  isPrinted?: boolean; // True once side label has been printed
  printedAt?: string;
  printedBy?: string;
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
  isBulkBatch?: boolean;
  bulkBinId?: string;
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
  picked?: boolean;
  pickedAt?: string;
  returned: boolean;
  returnedAt?: string;
  returnCondition?: 'GOOD_CLEAN' | 'NEEDS_CLEANING' | 'HEAVY_SOILING_CLEANING' | 'NEEDS_REPAIR' | 'MISSING';
  depositAction?: 'REFUNDED' | 'HELD_FOR_REPAIR' | 'HELD_FOR_MISSING' | 'HELD_FOR_CLEANING';
  notes?: string;
}

export interface CancellationRecord {
  cancelledAt: string;
  cancelledByStaff: string;
  reason: string;
  depositRefundStatus: 'FULL_REFUND_ISSUED' | 'DEPOSIT_FORFEITED' | 'NO_DEPOSIT_WAS_PAID';
  refundAmount: number;
}

export interface POOutfit {
  id: string; // e.g. "OUTFIT-1"
  roleLabel: string; // e.g. "Groom", "Best Man", "Groomsman #1"
  wearerName?: string;
  items: POLineItem[];
  outfitBagQr?: string;
  outfitBagScannedAt?: string;
  hangerQr?: string;
  hangerScannedAt?: string;
  assembledAt?: string;
  assembledByStaff?: string;
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
  outfits?: POOutfit[];
  outfitBagQr?: string;
  outfitBagScannedAt?: string;
  hangerQr?: string;
  hangerScannedAt?: string;
  itemizedSubtotal: number;
  fullRigoutCapApplied: boolean;
  fullRigoutDiscount: number;
  totalHireFee: number;
  totalDepositHeld: number;
  paypalTransactionId?: string;
  paypalCaptureId?: string;
  paypalRefundId?: string;
  paypalRefundAmount?: number;
  paypalRefundDate?: string;
  paymentStatus: 'UNPAID' | 'PARTIAL_DEPOSIT' | 'PAID_WITH_DEPOSIT' | 'FULL_BALANCE_PAID' | 'REFUNDED' | 'FULLY_REFUNDED' | 'DEPOSIT_PARTIALLY_REFUNDED' | 'CANCELLED' | 'DISPUTED';
  orderStatus: POOrderStatus;
  measurements?: CustomerMeasurements;
  depositPaymentMethod?: 'PAYPAL_ONLINE' | 'CARD_IN_STORE' | 'CASH_IN_STORE' | 'IN_STORE_CASH' | 'IN_STORE_CARD' | 'PAPER_DIARY_LEGACY';
  depositPaidAt?: string;
  cancellationRecord?: CancellationRecord;
  balancePaidAt?: string;
  disputeStatus?: 'DISPUTE_OPENED' | 'DISPUTE_RESOLVED' | 'CHARGEBACK_REVERSED';
  disputeDetails?: {
    disputeId: string;
    reason: string;
    amountDisputed: number;
    openedAt: string;
    status: string;
  };
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

export type StaffRole = 'Master Admin' | 'Admin' | 'Shop Assistant' | 'Senior Hire Specialist' | 'Inventory & Workshop Staff' | 'Accountant & Auditor';

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'DIRECTOR_DRAWING' | 'CONTRACTOR' | 'HOURLY';

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole; // System permission level (Master Admin, Admin, Shop Assistant, Accountant & Auditor)
  jobTitle?: string; // Operational Title: e.g. "IT & Business Development", "Store Owner & Managing Director", "Senior Hire Specialist", etc.
  responsibilities?: string[]; // e.g. ["IT / Technical Systems", "Business Development", "Customer Fittings", "Workshop & Tailoring", "Cash & Bank Auditing"]
  employmentType?: EmploymentType;
  monthlySalary?: number; // Monthly remuneration in £ (e.g. 2800.00)
  hourlyRate?: number; // Optional hourly rate in £
  hoursPerWeek?: number; // Standard working hours per week (e.g. 37.5)
  payNotes?: string; // e.g. "Paid 28th monthly via BACS / PAYE", "Director drawing & dividends"
  phone?: string;
  email: string;
  pin: string;
  avatar?: string;
  registeredAt: string;
  notes?: string;
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

export interface HistoricalFinancialYear {
  id: string; // e.g. "FY-2025"
  year: number; // e.g. 2025
  label: string; // e.g. "2025 / 2026 Financial Year"
  turnover: number; // Gross hire revenue & sales in £
  alterationsCost?: number; // In-house & outsourced alterations, repairs, hardware & tailoring (£)
  subHiresCost?: number; // External mill sub-hire wholesale invoices from House of Edgar/mills (£)
  costOfSales: number; // Combined direct cost of sales (alterations + sub-hires) (£)
  operatingExpenses: number; // Rent, utilities, rates, dry cleaning, insurance, software in £
  staffPayroll: number; // Total wages, PAYE & director drawings in £
  netProfitBeforeTax: number; // EBITDA / Operating profit in £ (Gross - Alterations - SubHires - Wages - Utilities)
  taxPaid: number; // UK Corporation tax in £
  retainedEarnings: number; // Net profit after tax in £ (EBITDA - Tax)
  yearEndAssetValuation: number; // Garment stock inventory valuation + equipment at year end in £
  fleetGrowthOrDepreciation?: number; // YoY garment stock appreciation/expansion (+) or depreciation (-)
  totalHiresCount?: number; // Total wedding/hire events serviced that year
  isVerifiedByAccountant?: boolean;
  notes?: string; // Key milestones, notes
  updatedAt: string;
}

