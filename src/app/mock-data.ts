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
  },
  {
    id: 'STAFF-0002',
    name: 'Fiona MacLean',
    role: 'Senior Hire Specialist',
    email: 'fiona@kilt-hire.co.uk',
    pin: '1234',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    registeredAt: '2026-05-15 10:30'
  }
];

export const INITIAL_INVITES: StaffInvite[] = [
  {
    id: 'INV-9901',
    code: 'HIGHLAND-STAFF-9901',
    email: 'calum@kilt-hire.co.uk',
    role: 'Senior Hire Specialist',
    createdAt: '2026-07-28 14:00',
    createdByName: 'Allan (Master Admin)',
    status: 'PENDING'
  },
  {
    id: 'INV-9902',
    code: 'HIGHLAND-STAFF-9902',
    email: 'isla@kilt-hire.co.uk',
    role: 'Inventory & Workshop Staff',
    createdAt: '2026-07-29 09:15',
    createdByName: 'Allan (Master Admin)',
    status: 'PENDING'
  }
];

// Master Pricing Matrix (Duplicated for Adults and Kids)
export const DEFAULT_PRICING_MATRIX: CategoryPriceSetting[] = [
  { category: 'Kilts', adultHireRate: 50, adultDeposit: 50, kidHireRate: 35, kidDeposit: 35 },
  { category: 'Jackets', adultHireRate: 50, adultDeposit: 50, kidHireRate: 30, kidDeposit: 30 },
  { category: 'Waistcoats', adultHireRate: 20, adultDeposit: 20, kidHireRate: 15, kidDeposit: 15 },
  { category: 'Sporrans', adultHireRate: 15, adultDeposit: 15, kidHireRate: 10, kidDeposit: 10 },
  { category: 'Ghillie Brogues', adultHireRate: 15, adultDeposit: 15, kidHireRate: 10, kidDeposit: 10 },
  { category: 'Shirts', adultHireRate: 10, adultDeposit: 10, kidHireRate: 8, kidDeposit: 8 },
  { category: 'Socks & Garters', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5 },
  { category: 'Belts & Buckles', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5 },
  { category: 'Sgian-dubh (Knife)', adultHireRate: 8, adultDeposit: 8, kidHireRate: 5, kidDeposit: 5 },
  { category: 'Miscellaneous', adultHireRate: 10, adultDeposit: 10, kidHireRate: 5, kidDeposit: 5 }
];

export const INITIAL_ITEMS: KiltItem[] = [
  {
    id: 'KILT-1001',
    name: 'Royal Stewart Heavyweight 8-Yard Kilt',
    category: 'Kilts',
    sizeGroup: 'Adult',
    tartanOrColour: 'Royal Stewart',
    size: 'Waist 34 / Length 24',
    brandMake: 'Highland Scottish Outfitters',
    hireRate: 50,
    depositAmount: 50,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-9011',
    registeredAt: '2026-06-01 10:00',
    registeredByStaff: 'Allan',
    conditionNotes: 'Good condition, pressed.'
  },
  {
    id: 'JKT-1002',
    name: 'Prince Charlie Jacket & Vest Set',
    category: 'Jackets',
    sizeGroup: 'Adult',
    tartanOrColour: 'Midnight Black Wool',
    size: 'Chest 40R',
    brandMake: 'Lochcarron Scotland',
    hireRate: 50,
    depositAmount: 50,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-9011',
    registeredAt: '2026-06-01 10:15',
    registeredByStaff: 'Allan'
  },
  {
    id: 'SPO-1003',
    name: 'Full Dress Bovine Leather Sporran',
    category: 'Sporrans',
    sizeGroup: 'Adult',
    tartanOrColour: 'Black & Cantle Silver',
    size: 'Standard Adult',
    brandMake: 'Highland Craftsmen',
    hireRate: 15,
    depositAmount: 15,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-9011',
    registeredAt: '2026-06-02 11:30',
    registeredByStaff: 'Fiona MacLean'
  },
  {
    id: 'SHO-1004',
    name: 'Ghillie Brogues Genuine Leather',
    category: 'Ghillie Brogues',
    sizeGroup: 'Adult',
    tartanOrColour: 'Polished Black',
    size: 'UK Size 10',
    brandMake: 'Kiltmaker Co.',
    hireRate: 15,
    depositAmount: 15,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-9011',
    registeredAt: '2026-06-02 11:45',
    registeredByStaff: 'Fiona MacLean'
  },
  {
    id: 'KILT-KIDS-501',
    name: 'Kids Royal Stewart Lightweight Kilt',
    category: 'Kilts',
    sizeGroup: 'Kid',
    tartanOrColour: 'Royal Stewart',
    size: 'Kids 8Y (Waist 22 / Length 16)',
    brandMake: 'Highland Junior Outfitters',
    hireRate: 35,
    depositAmount: 35,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-8802',
    registeredAt: '2026-06-10 14:00',
    registeredByStaff: 'Allan',
    conditionNotes: 'Adjustable waistband.'
  },
  {
    id: 'VST-KIDS-502',
    name: 'Kids Prince Charlie Waistcoat',
    category: 'Waistcoats',
    sizeGroup: 'Kid',
    tartanOrColour: 'Black Tweed',
    size: 'Kids 8Y (Chest 26)',
    brandMake: 'Highland Junior Outfitters',
    hireRate: 15,
    depositAmount: 15,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-8802',
    registeredAt: '2026-06-10 14:15',
    registeredByStaff: 'Allan'
  },
  {
    id: 'SPO-KIDS-503',
    name: 'Kids Semi-Dress Leather Sporran',
    category: 'Sporrans',
    sizeGroup: 'Kid',
    tartanOrColour: 'Black Leather',
    size: 'Junior',
    brandMake: 'Highland Craftsmen',
    hireRate: 10,
    depositAmount: 10,
    status: 'ON_HIRE',
    currentPoId: 'PO-2026-8802',
    registeredAt: '2026-06-10 14:20',
    registeredByStaff: 'Allan'
  },
  {
    id: 'KILT-1005',
    name: 'Black Watch Modern Tartan Kilt',
    category: 'Kilts',
    sizeGroup: 'Adult',
    tartanOrColour: 'Black Watch',
    size: 'Waist 36 / Length 24.5',
    brandMake: 'Strathmore Tweed',
    hireRate: 50,
    depositAmount: 50,
    status: 'AVAILABLE',
    registeredAt: '2026-06-03 09:10',
    registeredByStaff: 'Allan'
  },
  {
    id: 'JKT-2002',
    name: 'Argyll Charcoal Tweed Jacket',
    category: 'Jackets',
    sizeGroup: 'Adult',
    tartanOrColour: 'Charcoal Tweed',
    size: 'Chest 42L',
    brandMake: 'House of Edgar',
    hireRate: 50,
    depositAmount: 50,
    status: 'IN_REPAIR',
    registeredAt: '2026-06-05 16:20',
    registeredByStaff: 'Fiona MacLean',
    repairHistory: [
      {
        id: 'REP-901',
        dateSent: '2026-07-28 11:00',
        sentByStaff: 'Fiona MacLean',
        reason: 'Slight fraying on cuff button stitching.',
        severity: 'Minor'
      }
    ]
  }
];

export const INITIAL_BATCHES: QRBatch[] = [
  {
    id: 'BATCH-882101',
    title: 'Highland Adult Kilts Sheet A',
    category: 'Kilts',
    sizeGroup: 'Adult',
    count: 12,
    createdAt: '2026-07-01 10:00',
    createdByName: 'Allan (Master Admin)',
    qrCodes: [
      'KILT-1001', 'KILT-1005', 'KILT-1008', 'KILT-1009', 'KILT-1010', 'KILT-1011',
      'KILT-1012', 'KILT-1013', 'KILT-1014', 'KILT-1015', 'KILT-1016', 'KILT-1017'
    ]
  },
  {
    id: 'BATCH-882102',
    title: 'Kids Kilts & Waistcoats Batch',
    category: 'Kilts',
    sizeGroup: 'Kid',
    count: 8,
    createdAt: '2026-07-05 14:30',
    createdByName: 'Allan (Master Admin)',
    qrCodes: [
      'KILT-KIDS-501', 'KILT-KIDS-502', 'KILT-KIDS-503', 'KILT-KIDS-504',
      'KILT-KIDS-505', 'KILT-KIDS-506', 'KILT-KIDS-507', 'KILT-KIDS-508'
    ]
  }
];

export const INITIAL_POS: PurchaseOrder[] = [
  {
    id: 'PO-2026-9011',
    customerName: 'Gordon MacLeod',
    customerEmail: 'gordon.macleod@highlandwedding.co.uk',
    customerPhone: '07700 900123',
    eventDate: '2026-07-28',
    hireStartDate: '2026-07-25',
    hireEndDate: '2026-08-01', // 1 Day Overdue -> AMBER WARNING
    items: [
      {
        qrCodeId: 'KILT-1001',
        itemName: 'Royal Stewart Heavyweight 8-Yard Kilt',
        category: 'Kilts',
        sizeGroup: 'Adult',
        size: 'Waist 34 / Length 24',
        hireRate: 50,
        depositAmount: 50,
        returned: false
      },
      {
        qrCodeId: 'JKT-1002',
        itemName: 'Prince Charlie Jacket & Vest Set',
        category: 'Jackets',
        sizeGroup: 'Adult',
        size: 'Chest 40R',
        hireRate: 50,
        depositAmount: 50,
        returned: false
      },
      {
        qrCodeId: 'SPO-1003',
        itemName: 'Full Dress Bovine Leather Sporran',
        category: 'Sporrans',
        sizeGroup: 'Adult',
        size: 'Standard Adult',
        hireRate: 15,
        depositAmount: 15,
        returned: false
      },
      {
        qrCodeId: 'SHO-1004',
        itemName: 'Ghillie Brogues Genuine Leather',
        category: 'Ghillie Brogues',
        sizeGroup: 'Adult',
        size: 'UK Size 10',
        hireRate: 15,
        depositAmount: 15,
        returned: false
      }
    ],
    itemizedSubtotal: 130,
    fullRigoutCapApplied: true,
    fullRigoutDiscount: 10,
    totalHireFee: 120, // Capped at £120 Adult Cap
    totalDepositHeld: 130,
    paypalTransactionId: 'PAYPAL-TX-9881A2X',
    paymentStatus: 'PAID_WITH_DEPOSIT',
    issuedByStaff: 'Fiona MacLean',
    createdAt: '2026-07-25 11:20',
    notes: 'Wedding order. Return deadline was yesterday 1st Aug. 1 Day Overdue!'
  },
  {
    id: 'PO-2026-8802',
    customerName: 'Fiona Sinclair',
    customerEmail: 'fiona.sinclair@edinburgh.co.uk',
    customerPhone: '07890 123456',
    eventDate: '2026-07-20',
    hireStartDate: '2026-07-18',
    hireEndDate: '2026-07-27', // 6 Days Overdue -> RED ALERT!
    items: [
      {
        qrCodeId: 'KILT-KIDS-501',
        itemName: 'Kids Royal Stewart Lightweight Kilt',
        category: 'Kilts',
        sizeGroup: 'Kid',
        size: 'Kids 8Y (Waist 22)',
        hireRate: 35,
        depositAmount: 35,
        returned: false
      },
      {
        qrCodeId: 'VST-KIDS-502',
        itemName: 'Kids Prince Charlie Waistcoat',
        category: 'Waistcoats',
        sizeGroup: 'Kid',
        size: 'Kids 8Y (Chest 26)',
        hireRate: 15,
        depositAmount: 15,
        returned: false
      },
      {
        qrCodeId: 'SPO-KIDS-503',
        itemName: 'Kids Semi-Dress Leather Sporran',
        category: 'Sporrans',
        sizeGroup: 'Kid',
        size: 'Junior',
        hireRate: 10,
        depositAmount: 10,
        returned: false
      }
    ],
    itemizedSubtotal: 60,
    fullRigoutCapApplied: false,
    fullRigoutDiscount: 0,
    totalHireFee: 60,
    totalDepositHeld: 60,
    paypalTransactionId: 'PAYPAL-TX-7711B8Z',
    paymentStatus: 'PAID_WITH_DEPOSIT',
    issuedByStaff: 'Allan',
    createdAt: '2026-07-18 09:45',
    notes: 'Kids outfit. Return deadline was 27th July - 6 Days Overdue! Customer contacted by phone.'
  },
  {
    id: 'PO-2026-5501',
    customerName: 'Alastair Fraser',
    customerEmail: 'alastair.fraser@glasgow.ac.uk',
    customerPhone: '07711 223344',
    eventDate: '2026-07-25',
    hireStartDate: '2026-07-22',
    hireEndDate: '2026-07-27',
    items: [
      {
        qrCodeId: 'KILT-1006',
        itemName: 'Black Watch 8-Yard Kilt',
        category: 'Kilts',
        sizeGroup: 'Adult',
        size: 'Waist 32 / Length 24',
        hireRate: 50,
        depositAmount: 50,
        returned: true,
        returnedAt: '2026-07-27 10:15',
        returnCondition: 'GOOD_CLEAN',
        depositAction: 'REFUNDED'
      },
      {
        qrCodeId: 'JKT-1007',
        itemName: 'Argyll Charcoal Tweed Jacket',
        category: 'Jackets',
        sizeGroup: 'Adult',
        size: 'Chest 38R',
        hireRate: 50,
        depositAmount: 50,
        returned: true,
        returnedAt: '2026-07-27 10:15',
        returnCondition: 'GOOD_CLEAN',
        depositAction: 'REFUNDED'
      }
    ],
    itemizedSubtotal: 100,
    fullRigoutCapApplied: false,
    fullRigoutDiscount: 0,
    totalHireFee: 100,
    totalDepositHeld: 100,
    paypalTransactionId: 'PAYPAL-TX-5501C19',
    paymentStatus: 'FULLY_REFUNDED',
    issuedByStaff: 'Allan',
    createdAt: '2026-07-20 14:10',
    notes: 'University graduation hire. All items returned clean, deposit refunded.'
  }
];

export const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'LOG-001',
    timestamp: '2026-08-02 09:45',
    staffName: 'Allan',
    action: 'CREATED_PO_PAYPAL',
    details: 'Created Purchase Order PO-2026-8802 for Fiona Sinclair (£60 + £60 PayPal deposit)'
  },
  {
    id: 'LOG-002',
    timestamp: '2026-08-01 11:20',
    staffName: 'Fiona MacLean',
    action: 'CREATED_PO_PAYPAL',
    details: 'Created Purchase Order PO-2026-9011 for Gordon MacLeod. Applied Full Rigout Price Cap (£120)'
  }
];
