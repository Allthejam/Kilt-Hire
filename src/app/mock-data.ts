import { KiltItem, QRBatch, PurchaseOrder, AuditLog, StaffUser, StaffInvite, CategoryPriceSetting, AlterationTask, DepositLedgerEntry, StoreEmailSettings, HistoricalFinancialYear } from './types';

export const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'STAFF-0001',
    name: 'Allan',
    role: 'Master Admin',
    jobTitle: 'IT / Technical Support & Business Development',
    responsibilities: [
      'IT / Technical Systems',
      'Business Development',
      'Garment Stock Control',
      'Till & Banking Audit'
    ],
    employmentType: 'FULL_TIME',
    monthlySalary: 3200,
    hoursPerWeek: 37.5,
    payNotes: 'Paid monthly on the 28th via BACS / PAYE',
    email: 'admin@kilt-hire.co.uk',
    pin: '1234',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    registeredAt: '2026-05-01 09:00',
    notes: 'System Architect, Lead Technical Support & Business Growth Strategy.'
  }
];

export const INITIAL_INVITES: StaffInvite[] = [];

// Master Pricing Matrix (Duplicated for Adults and Kids)
export const DEFAULT_PRICING_MATRIX: CategoryPriceSetting[] = [
  { category: 'Belts & Buckles', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Ghillie Brogues', adultHireRate: 15, adultDeposit: 15, kidHireRate: 10, kidDeposit: 10, allowAlterations: false },
  { category: 'Jackets', adultHireRate: 50, adultDeposit: 50, kidHireRate: 30, kidDeposit: 30, allowAlterations: true },
  { category: 'Kilts', adultHireRate: 50, adultDeposit: 50, kidHireRate: 35, kidDeposit: 35, allowAlterations: true },
  { category: 'Miscellaneous', adultHireRate: 10, adultDeposit: 10, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Sgian-dubh (Knife)', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Shirts', adultHireRate: 10, adultDeposit: 10, kidHireRate: 8, kidDeposit: 8, allowAlterations: false },
  { category: 'Socks & Garters', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5, allowAlterations: false },
  { category: 'Sporrans', adultHireRate: 15, adultDeposit: 15, kidHireRate: 10, kidDeposit: 10, allowAlterations: false },
  { category: 'Waistcoats', adultHireRate: 20, adultDeposit: 20, kidHireRate: 15, kidDeposit: 15, allowAlterations: true }
];

export const INITIAL_ITEMS: KiltItem[] = [];

export const INITIAL_BATCHES: QRBatch[] = [];

export const INITIAL_POS: PurchaseOrder[] = [];

export const INITIAL_LOGS: AuditLog[] = [];

export const INITIAL_ALTERATIONS: AlterationTask[] = [];

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
    headline: 'Booking Confirmation & Reservation Summary',
    customIntro: 'Thank you for choosing Highland Kiltmakers! Your bespoke outfit reservation has been confirmed in our store schedule.',
    paypalNotice: 'Instant secure online payment via PayPal or Credit/Debit card.',
    policyNotice: 'Please bring photo ID when collecting your hire outfit from our shop.',
    showMeasurements: true
  },
  paymentReceiptInvoice: {
    headline: 'Official Payment Receipt & Security Deposit Invoice',
    customIntro: 'Thank you for your payment! We confirm that your payment has been successfully received and credited towards your hire reservation.',
    taxOrVatNotice: 'Official small business hire invoice & security bond receipt. Please retain this document for your financial records.',
    depositPolicyStatement: 'Your refundable security deposit is held safely in escrow and will be returned to your original payment method upon safe garment check-in.',
    showItemizedSummary: true
  },
  orderCancellation: {
    headline: 'Order Cancellation Notice & Deposit Settlement',
    customIntro: 'We confirm that your Highland kilt hire booking has been cancelled in our store management schedule.',
    depositRetentionPolicy: 'In accordance with our booking terms, any applicable administrative retention from the deposit held has been recorded.',
    refundProcessingNotice: 'Any net refundable amount has been initiated back to your original payment method and typically settles in 2-5 business days.',
    supportContactPrompt: 'If you have questions regarding this cancellation or wish to reschedule for a future date, please contact our team.'
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

// 10-Year Historical Trading & Company Valuation Ledger (Editable Baseline for 2016 – 2025)
export const INITIAL_HISTORICAL_FINANCIAL_YEARS: HistoricalFinancialYear[] = [
  {
    id: 'FY-2016',
    year: 2016,
    label: '2016 / 2017 Financial Year',
    turnover: 145000,
    alterationsCost: 6500,
    subHiresCost: 31500,
    costOfSales: 38000,
    operatingExpenses: 32000,
    staffPayroll: 36000,
    netProfitBeforeTax: 39000,
    taxPaid: 7410,
    retainedEarnings: 31590,
    yearEndAssetValuation: 85000,
    fleetGrowthOrDepreciation: 85000,
    totalHiresCount: 620,
    isVerifiedByAccountant: true,
    notes: 'Store establishment and initial 350-kilt stock collection investment.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2017',
    year: 2017,
    label: '2017 / 2018 Financial Year',
    turnover: 168000,
    alterationsCost: 7500,
    subHiresCost: 34500,
    costOfSales: 42000,
    operatingExpenses: 34500,
    staffPayroll: 39000,
    netProfitBeforeTax: 52500,
    taxPaid: 9975,
    retainedEarnings: 42525,
    yearEndAssetValuation: 102000,
    fleetGrowthOrDepreciation: 17000,
    totalHiresCount: 710,
    isVerifiedByAccountant: true,
    notes: 'Expanded into Prince Charlie and Argyll jacket packages.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2018',
    year: 2018,
    label: '2018 / 2019 Financial Year',
    turnover: 195000,
    alterationsCost: 8500,
    subHiresCost: 39500,
    costOfSales: 48000,
    operatingExpenses: 38000,
    staffPayroll: 44000,
    netProfitBeforeTax: 65000,
    taxPaid: 12350,
    retainedEarnings: 52650,
    yearEndAssetValuation: 125000,
    fleetGrowthOrDepreciation: 23000,
    totalHiresCount: 840,
    isVerifiedByAccountant: true,
    notes: 'Highland wedding boom; introduced wedding party bulk rigouts.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2019',
    year: 2019,
    label: '2019 / 2020 Financial Year',
    turnover: 220000,
    alterationsCost: 9500,
    subHiresCost: 44500,
    costOfSales: 54000,
    operatingExpenses: 41000,
    staffPayroll: 48000,
    netProfitBeforeTax: 77000,
    taxPaid: 14630,
    retainedEarnings: 62370,
    yearEndAssetValuation: 148000,
    fleetGrowthOrDepreciation: 23000,
    totalHiresCount: 950,
    isVerifiedByAccountant: true,
    notes: 'Record turnover; peak Edinburgh festival & ceilidh hire volume.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2020',
    year: 2020,
    label: '2020 / 2021 Financial Year',
    turnover: 78000,
    alterationsCost: 3500,
    subHiresCost: 14500,
    costOfSales: 18000,
    operatingExpenses: 28000,
    staffPayroll: 24000,
    netProfitBeforeTax: 8000,
    taxPaid: 1520,
    retainedEarnings: 6480,
    yearEndAssetValuation: 135000,
    fleetGrowthOrDepreciation: -13000,
    totalHiresCount: 290,
    isVerifiedByAccountant: true,
    notes: 'COVID wedding restrictions; staff furlough and garment stock maintenance preservation.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2021',
    year: 2021,
    label: '2021 / 2022 Financial Year',
    turnover: 165000,
    alterationsCost: 7000,
    subHiresCost: 32000,
    costOfSales: 39000,
    operatingExpenses: 35000,
    staffPayroll: 38000,
    netProfitBeforeTax: 53000,
    taxPaid: 10070,
    retainedEarnings: 42930,
    yearEndAssetValuation: 155000,
    fleetGrowthOrDepreciation: 20000,
    totalHiresCount: 680,
    isVerifiedByAccountant: true,
    notes: 'Post-pandemic Scottish wedding surge and tartan stock collection restocking.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2022',
    year: 2022,
    label: '2022 / 2023 Financial Year',
    turnover: 235000,
    alterationsCost: 10500,
    subHiresCost: 46500,
    costOfSales: 57000,
    operatingExpenses: 44000,
    staffPayroll: 52000,
    netProfitBeforeTax: 82000,
    taxPaid: 15580,
    retainedEarnings: 66420,
    yearEndAssetValuation: 185000,
    fleetGrowthOrDepreciation: 30000,
    totalHiresCount: 1020,
    isVerifiedByAccountant: true,
    notes: 'Expanded modern tweed collections and bespoke ghillie brogues.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2023',
    year: 2023,
    label: '2023 / 2024 Financial Year',
    turnover: 285000,
    alterationsCost: 12500,
    subHiresCost: 55500,
    costOfSales: 68000,
    operatingExpenses: 49000,
    staffPayroll: 61000,
    netProfitBeforeTax: 107000,
    taxPaid: 26750,
    retainedEarnings: 80250,
    yearEndAssetValuation: 220000,
    fleetGrowthOrDepreciation: 35000,
    totalHiresCount: 1210,
    isVerifiedByAccountant: true,
    notes: 'Introduced back office digital fitting and integrated payment portal.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2024',
    year: 2024,
    label: '2024 / 2025 Financial Year',
    turnover: 318000,
    alterationsCost: 13500,
    subHiresCost: 59500,
    costOfSales: 73000,
    operatingExpenses: 53000,
    staffPayroll: 68000,
    netProfitBeforeTax: 124000,
    taxPaid: 31000,
    retainedEarnings: 93000,
    yearEndAssetValuation: 250000,
    fleetGrowthOrDepreciation: 30000,
    totalHiresCount: 1340,
    isVerifiedByAccountant: true,
    notes: 'Major stock collection expansion; added Spirit of Scotland and Hebridean Heather.',
    updatedAt: '2026-08-17 12:00'
  },
  {
    id: 'FY-2025',
    year: 2025,
    label: '2025 / 2026 Financial Year',
    turnover: 345000,
    alterationsCost: 14000,
    subHiresCost: 65000,
    costOfSales: 79000,
    operatingExpenses: 56000,
    staffPayroll: 74000,
    netProfitBeforeTax: 136000,
    taxPaid: 34000,
    retainedEarnings: 102000,
    yearEndAssetValuation: 275000,
    fleetGrowthOrDepreciation: 25000,
    totalHiresCount: 1450,
    isVerifiedByAccountant: true,
    notes: '52-Year milestone record trading year; high retention and 5.25x EBITDA valuation model.',
    updatedAt: '2026-08-17 12:00'
  }
];
