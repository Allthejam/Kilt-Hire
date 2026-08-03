'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  KiltItem, 
  QRBatch, 
  QRReprintLog,
  PurchaseOrder, 
  POLineItem,
  StaffUser, 
  StaffInvite,
  AuditLog, 
  ItemCategory, 
  ItemStatus,
  SizeGroup,
  CategoryPriceSetting
} from './types';
import { 
  INITIAL_STAFF, 
  INITIAL_INVITES,
  INITIAL_ITEMS, 
  INITIAL_BATCHES, 
  INITIAL_POS, 
  INITIAL_LOGS,
  DEFAULT_PRICING_MATRIX
} from './mock-data';
import { generateQrMatrix, renderQrSvgPath } from './qr-utils';
import { 
  QrCode, 
  Camera, 
  Printer, 
  PlusCircle, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  CreditCard, 
  RefreshCw, 
  UserCheck, 
  PackageCheck, 
  Search, 
  FileText, 
  Sparkles, 
  DollarSign, 
  RotateCcw, 
  Layers, 
  ShieldCheck, 
  Clock, 
  X,
  Lock,
  Mail,
  Key,
  UserPlus,
  LogOut,
  Send,
  Copy,
  Check,
  Menu,
  ChevronRight,
  Tag,
  Sliders,
  Store,
  Zap,
  Edit3,
  Package,
  Calendar,
  DollarSign as PriceTag,
  Users,
  Baby,
  User,
  Trash2,
  AlertCircle,
  Archive,
  Eye,
  RefreshCw as RestoreIcon,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

const CATEGORIES: ItemCategory[] = [
  'Kilts',
  'Jackets',
  'Waistcoats',
  'Sporrans',
  'Ghillie Brogues',
  'Shirts',
  'Socks & Garters',
  'Belts & Buckles',
  'Sgian-dubh (Knife)',
  'Miscellaneous'
];

// Helper function to calculate Overdue Return Status and Color Badges (Blue -> Amber -> Red)
const getOverdueStatus = (dueDateStr: string | undefined, isReturned: boolean = false) => {
  if (!dueDateStr || isReturned) {
    return {
      daysOverdue: 0,
      level: 'ON_TIME' as const,
      label: 'On Time',
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      cardBg: 'bg-blue-50/60 border-blue-200',
      poCardBg: 'bg-slate-50 border-slate-200',
      textColor: 'text-blue-900'
    };
  }

  // Use today's date (or reference date 2026-08-02)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dueDate.getTime();
  const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 0) {
    return {
      daysOverdue: 0,
      level: 'ON_TIME' as const,
      label: `Due ${dueDateStr} (On-Time)`,
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      cardBg: 'bg-blue-50/60 border-blue-200',
      poCardBg: 'bg-slate-50 border-slate-200',
      textColor: 'text-blue-900'
    };
  } else if (daysOverdue >= 1 && daysOverdue <= 3) {
    return {
      daysOverdue,
      level: 'OVERDUE_LIGHT' as const,
      label: `⚠️ OVERDUE ${daysOverdue} DAY${daysOverdue > 1 ? 'S' : ''} (Due ${dueDateStr})`,
      badgeBg: 'bg-amber-500 text-slate-950 border-amber-600 font-extrabold shadow-sm animate-pulse',
      cardBg: 'bg-amber-50/90 border-2 border-amber-400 shadow-md',
      poCardBg: 'bg-amber-50/95 border-2 border-amber-400 shadow-md',
      textColor: 'text-amber-950'
    };
  } else {
    // 4 or more days overdue!
    return {
      daysOverdue,
      level: 'OVERDUE_SEVERE' as const,
      label: `🚨 OVERDUE ${daysOverdue} DAYS! (Due ${dueDateStr}) - Contact Customer`,
      badgeBg: 'bg-rose-600 text-white border-rose-700 font-extrabold shadow-sm animate-pulse',
      cardBg: 'bg-rose-50 border-2 border-rose-500 shadow-lg',
      poCardBg: 'bg-rose-50 border-2 border-rose-500 shadow-lg',
      textColor: 'text-rose-950'
    };
  }
};

export default function KiltHireApp() {
  // State Initialization with localStorage persistence
  const [items, setItems] = useState<KiltItem[]>([]);
  const [batches, setBatches] = useState<QRBatch[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>(INITIAL_STAFF);
  const [invites, setInvites] = useState<StaffInvite[]>(INITIAL_INVITES);
  
  // Full Rigout Price Cap Settings (Master Admin Configurable)
  const [maxRigoutCapPrice, setMaxRigoutCapPrice] = useState<number>(120); // Adult Cap
  const [kidMaxRigoutCapPrice, setKidMaxRigoutCapPrice] = useState<number>(80); // Kids Cap

  // Category Pricing Matrix State (Duplicated for Adults and Kids)
  const [pricingMatrix, setPricingMatrix] = useState<CategoryPriceSetting[]>(DEFAULT_PRICING_MATRIX);

  // Interface Mode: 'admin_portal' (Full Office) vs 'shop_assistant' (Automated Floor Terminal)
  const [interfaceMode, setInterfaceMode] = useState<'admin_portal' | 'shop_assistant'>('shop_assistant');

  // Shop Assistant Floor Tabs: 'scanner' | 'in_stock' | 'on_hire' | 'in_repair' | 'pos'
  const [assistantTab, setAssistantTab] = useState<'scanner' | 'in_stock' | 'on_hire' | 'in_repair' | 'pos'>('scanner');
  const [assistantSearch, setAssistantSearch] = useState('');
  const [assistantSizeFilter, setAssistantSizeFilter] = useState<'ALL' | 'Adult' | 'Kid'>('ALL');

  // Inventory tab demographic filter & Retired Archive Tab in Admin
  const [inventorySizeFilter, setInventorySizeFilter] = useState<'ALL' | 'Adult' | 'Kid'>('ALL');
  const [inventorySubTab, setInventorySubTab] = useState<'ACTIVE' | 'ARCHIVE'>('ACTIVE');

  // Auth state
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(INITIAL_STAFF[0]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Mobile sidebar toggle state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Instant Scan Notification Toast
  const [scanToast, setScanToast] = useState<{ msg: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register form
  const [regInviteCode, setRegInviteCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regError, setRegError] = useState('');

  // Tab State for Admin: 'scanner' | 'batches' | 'inventory' | 'pos' | 'repairs' | 'pricing' | 'admin'
  const [activeTab, setActiveTab] = useState<'scanner' | 'batches' | 'inventory' | 'pos' | 'repairs' | 'pricing' | 'admin'>('scanner');
  const [isLoaded, setIsLoaded] = useState(false);

  // Scanner & Selected QR State
  const [scannedCode, setScannedCode] = useState<string>('');
  const [simulatedInput, setSimulatedInput] = useState<string>('');
  const [activeCamera, setActiveCamera] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSendRepairModal, setShowSendRepairModal] = useState(false);
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [showEditPoModal, setShowEditPoModal] = useState<PurchaseOrder | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // MULTI-ITEM PO RETURN CHECKLIST MODAL STATE
  const [activeReturnPo, setActiveReturnPo] = useState<PurchaseOrder | null>(null);
  const [returnChecklist, setReturnChecklist] = useState<Record<string, {
    condition: 'GOOD_CLEAN' | 'NEEDS_REPAIR' | 'MISSING';
    scanned?: boolean;
    notes: string;
  }>>({});

  // Edit Item & Remove from Rotation Modals
  const [showEditItemModal, setShowEditItemModal] = useState<KiltItem | null>(null);
  const [showRemoveRotationModal, setShowRemoveRotationModal] = useState<KiltItem | null>(null);
  const [retireReasonCategory, setRetireReasonCategory] = useState<'SOLD' | 'STOLEN' | 'DESTROYED' | 'WRITTEN_OFF'>('SOLD');
  const [retireNotes, setRetireNotes] = useState('');

  // Form states
  const [regForm, setRegForm] = useState<{
    name: string;
    category: ItemCategory;
    sizeGroup: SizeGroup;
    tartanOrColour: string;
    size: string;
    brandMake: string;
    hireRate: number;
    depositAmount: number;
    conditionNotes: string;
  }>({
    name: '',
    category: 'Kilts',
    sizeGroup: 'Adult',
    tartanOrColour: '',
    size: '',
    brandMake: '',
    hireRate: 50,
    depositAmount: 50,
    conditionNotes: ''
  });

  const [repairReason, setRepairReason] = useState('');
  const [repairSeverity, setRepairSeverity] = useState<'Minor' | 'Medium' | 'Severe'>('Medium');

  const [batchForm, setBatchForm] = useState<{
    title: string;
    category: ItemCategory;
    sizeGroup: SizeGroup;
    count: number;
  }>({
    title: 'Highland Kilts Batch',
    category: 'Kilts',
    sizeGroup: 'Adult',
    count: 10
  });

  const [selectedBatchForPrint, setSelectedBatchForPrint] = useState<QRBatch | null>(null);
  const [selectedCodesForReprint, setSelectedCodesForReprint] = useState<string[]>([]);
  const [reprintPinInput, setReprintPinInput] = useState<string>('');
  const [reprintReason, setReprintReason] = useState<string>('');
  const [showReprintPinModal, setShowReprintPinModal] = useState<boolean>(false);
  const [reprintPrintMode, setReprintPrintMode] = useState<boolean>(false);

  // Invite creation form state
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'Senior Hire Specialist' | 'Inventory & Workshop Staff'>('Senior Hire Specialist');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);

  // PO Form state
  const [newPoForm, setNewPoForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    eventDate: '',
    hireStartDate: '',
    hireEndDate: '',
    notes: '',
    selectedItemIds: [] as string[]
  });

  // Edit PO state
  const [editPoNotes, setEditPoNotes] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem('kilt_items');
      const savedBatches = localStorage.getItem('kilt_batches');
      const savedPos = localStorage.getItem('kilt_pos');
      const savedLogs = localStorage.getItem('kilt_logs');
      const savedStaff = localStorage.getItem('kilt_staff');
      const savedInvites = localStorage.getItem('kilt_invites');
      const savedUser = localStorage.getItem('kilt_current_user');
      const savedCap = localStorage.getItem('kilt_max_rigout_cap');
      const savedKidCap = localStorage.getItem('kilt_kid_max_rigout_cap');
      const savedPricing = localStorage.getItem('kilt_pricing_matrix');
      const savedMode = localStorage.getItem('kilt_interface_mode');

      setItems(savedItems ? JSON.parse(savedItems) : INITIAL_ITEMS);
      setBatches(savedBatches ? JSON.parse(savedBatches) : INITIAL_BATCHES);
      setPos(savedPos ? JSON.parse(savedPos) : INITIAL_POS);
      setLogs(savedLogs ? JSON.parse(savedLogs) : INITIAL_LOGS);
      setStaffList(savedStaff ? JSON.parse(savedStaff) : INITIAL_STAFF);
      setInvites(savedInvites ? JSON.parse(savedInvites) : INITIAL_INVITES);
      if (savedCap) setMaxRigoutCapPrice(Number(savedCap));
      if (savedKidCap) setKidMaxRigoutCapPrice(Number(savedKidCap));
      if (savedPricing) setPricingMatrix(JSON.parse(savedPricing));
      if (savedMode === 'shop_assistant' || savedMode === 'admin_portal') setInterfaceMode(savedMode);
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
    } catch {
      setItems(INITIAL_ITEMS);
      setBatches(INITIAL_BATCHES);
      setPos(INITIAL_POS);
      setLogs(INITIAL_LOGS);
      setStaffList(INITIAL_STAFF);
      setInvites(INITIAL_INVITES);
      setPricingMatrix(DEFAULT_PRICING_MATRIX);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('kilt_items', JSON.stringify(items));
    localStorage.setItem('kilt_batches', JSON.stringify(batches));
    localStorage.setItem('kilt_pos', JSON.stringify(pos));
    localStorage.setItem('kilt_logs', JSON.stringify(logs));
    localStorage.setItem('kilt_staff', JSON.stringify(staffList));
    localStorage.setItem('kilt_invites', JSON.stringify(invites));
    localStorage.setItem('kilt_max_rigout_cap', maxRigoutCapPrice.toString());
    localStorage.setItem('kilt_kid_max_rigout_cap', kidMaxRigoutCapPrice.toString());
    localStorage.setItem('kilt_pricing_matrix', JSON.stringify(pricingMatrix));
    localStorage.setItem('kilt_interface_mode', interfaceMode);
    localStorage.setItem('kilt_current_user', JSON.stringify(currentUser));
  }, [items, batches, pos, logs, staffList, invites, maxRigoutCapPrice, kidMaxRigoutCapPrice, pricingMatrix, interfaceMode, currentUser, isLoaded]);

  // Reset to initial mock data
  const handleResetData = () => {
    if (confirm('Reset all demo inventory, POs, repair data, pricing matrix, and staff invites to default mock state?')) {
      setItems(INITIAL_ITEMS);
      setBatches(INITIAL_BATCHES);
      setPos(INITIAL_POS);
      setLogs(INITIAL_LOGS);
      setStaffList(INITIAL_STAFF);
      setInvites(INITIAL_INVITES);
      setMaxRigoutCapPrice(120);
      setKidMaxRigoutCapPrice(80);
      setPricingMatrix(DEFAULT_PRICING_MATRIX);
      setCurrentUser(INITIAL_STAFF[0]);
      setScannedCode('');
      setActiveReturnPo(null);
    }
  };

  // Toast notification trigger
  const showToast = (msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setScanToast({ msg, type });
    setTimeout(() => setScanToast(null), 4000);
  };

  // Log audit helper
  const addAuditLog = (action: string, details: string, relatedQrCode?: string) => {
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      staffName: currentUser ? currentUser.name : 'System',
      action,
      details,
      relatedQrCode
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // LOGIN Handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const found = staffList.find(s => 
      s.email.toLowerCase() === loginEmail.toLowerCase().trim() && s.pin === loginPin.trim()
    );

    if (found) {
      setCurrentUser(found);
      addAuditLog('STAFF_LOGIN', `${found.name} (${found.role}) logged into back office.`);
    } else {
      setLoginError('Invalid Email or PIN code. (Demo PIN is 1234)');
    }
  };

  // REGISTER WITH INVITE CODE Handler
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    const cleanCode = regInviteCode.trim().toUpperCase();
    const inviteMatch = invites.find(inv => inv.code === cleanCode && inv.status === 'PENDING');

    if (!inviteMatch) {
      setRegError('Invalid or expired Invite Code. Please request a new invite link from Master Admin (Allan).');
      return;
    }

    if (staffList.some(s => s.email.toLowerCase() === regEmail.toLowerCase().trim())) {
      setRegError('A staff member with this email is already registered.');
      return;
    }

    const newStaffUser: StaffUser = {
      id: `STAFF-${Date.now().toString().slice(-4)}`,
      name: regName.trim(),
      role: inviteMatch.role,
      email: regEmail.trim(),
      pin: regPin.trim() || '1234',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    setInvites(prev => prev.map(inv => inv.code === cleanCode ? {
      ...inv,
      status: 'REGISTERED' as const,
      usedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    } : inv));

    setStaffList(prev => [...prev, newStaffUser]);
    setCurrentUser(newStaffUser);

    addAuditLog('STAFF_REGISTERED_INVITE', `Staff member ${newStaffUser.name} registered account using invite code ${cleanCode}`);
  };

  // MASTER ADMIN: Send Staff Invite
  const handleSendInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail) return;

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `HIGHLAND-STAFF-${randomNum}`;

    const newInvite: StaffInvite = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      code,
      email: newInviteEmail.trim(),
      role: newInviteRole,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      createdByName: currentUser?.name || 'Master Admin',
      status: 'PENDING'
    };

    setInvites(prev => [newInvite, ...prev]);
    addAuditLog('CREATED_STAFF_INVITE', `Created staff registration invite for ${newInvite.email} (${newInvite.role}) with code ${code}`);
    
    setInviteSuccessMsg(`Invite Code [ ${code} ] generated & emailed to ${newInvite.email}!`);
    setNewInviteEmail('');
  };

  // Update Pricing Matrix Entry
  const handleUpdatePriceSetting = (category: ItemCategory, field: keyof CategoryPriceSetting, value: number) => {
    setPricingMatrix(prev => prev.map(p => {
      if (p.category === category) {
        return { ...p, [field]: Number(value) };
      }
      return p;
    }));
  };

  // Camera scanner handler simulation
  const toggleCamera = async () => {
    if (activeCamera) {
      setActiveCamera(false);
      return;
    }
    setActiveCamera(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.warn('Camera stream not available, falling back to simulated scan picker', err);
    }
  };

  // Get default price & deposit for a category and sizeGroup
  const getDefaultPriceForCategory = (cat: ItemCategory, isKid: boolean) => {
    const setting = pricingMatrix.find(p => p.category === cat);
    if (!setting) return { hireRate: 50, deposit: 50 };
    return isKid 
      ? { hireRate: setting.kidHireRate, deposit: setting.kidDeposit }
      : { hireRate: setting.adultHireRate, deposit: setting.adultDeposit };
  };

  // =========================================================================
  // ZERO-FRICTION AUTOMATED MULTI-ITEM PO SCANNER DISCOVERY HANDLER
  // =========================================================================
  const handleScanCode = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setScannedCode(cleanCode);
    setSimulatedInput('');
    
    const existing = items.find(i => i.id === cleanCode && i.status !== 'RETIRED');

    // IF RETURN CHECKLIST MODAL IS OPEN: VERIFY THIS ITEM WITH PHYSICAL QR SCAN!
    if (activeReturnPo && activeReturnPo.items.some(li => li.qrCodeId === cleanCode)) {
      setReturnChecklist(prev => ({
        ...prev,
        [cleanCode]: { condition: 'GOOD_CLEAN', scanned: true, notes: 'Authentic QR label scanned & verified!' }
      }));
      showToast(`🛡️ QR Verified: ${cleanCode} authenticated & checked off!`, 'success');
      return;
    }

    if (!existing) {
      // 🚀 AUTOMATED TRIGGER 1: UNREGISTERED ITEM DETECTED!
      const batchMatch = batches.find(b => b.qrCodes.includes(cleanCode));
      const autoCategory: ItemCategory = batchMatch ? batchMatch.category : 
        cleanCode.startsWith('KILT') ? 'Kilts' :
        cleanCode.startsWith('JKT') ? 'Jackets' :
        cleanCode.startsWith('SPO') ? 'Sporrans' :
        cleanCode.startsWith('SHO') ? 'Ghillie Brogues' :
        cleanCode.startsWith('VST') ? 'Waistcoats' :
        cleanCode.startsWith('SHT') ? 'Shirts' :
        cleanCode.startsWith('SOK') ? 'Socks & Garters' :
        cleanCode.startsWith('BLT') ? 'Belts & Buckles' :
        cleanCode.startsWith('KNF') ? 'Sgian-dubh (Knife)' : 'Miscellaneous';
      
      const isKid = cleanCode.includes('KID') || cleanCode.includes('JNR') || (batchMatch ? batchMatch.sizeGroup === 'Kid' : false);
      const defaultPrices = getDefaultPriceForCategory(autoCategory, isKid);

      setRegForm({
        name: `${isKid ? 'Kids ' : 'Adult '}${autoCategory} (${cleanCode})`,
        category: autoCategory,
        sizeGroup: isKid ? 'Kid' : 'Adult',
        tartanOrColour: 'Royal Stewart Tartan',
        size: isKid ? 'Kids Size 8Y / Waist 22' : autoCategory === 'Kilts' ? 'Waist 34 / Length 24' : 'Chest 40R',
        brandMake: 'Highland Scottish Outfitters',
        hireRate: defaultPrices.hireRate,
        depositAmount: defaultPrices.deposit,
        conditionNotes: 'Brand new stock garment.'
      });

      // AUTO POPUP REGISTER FORM IMMEDIATELY!
      setShowRegisterModal(true);
      showToast(`✨ New ${isKid ? 'Kids' : 'Adult'} QR (${cleanCode}) detected! Save description to add to inventory.`, 'info');

    } else if (existing.status === 'ON_HIRE') {
      // 🚀 AUTOMATED TRIGGER 2: ON-HIRE ITEM DETECTED! AUTO-OPEN MULTI-ITEM PO CHECKLIST!
      const linkedPo = pos.find(p => p.id === existing.currentPoId);
      if (linkedPo) {
        openPoReturnChecklist(linkedPo, cleanCode);
        showToast(`📦 Garment (${cleanCode}) belongs to PO ${linkedPo.id} (${linkedPo.customerName}). Opened full multi-item checklist!`, 'info');
      } else {
        showToast(`⚠️ Item (${cleanCode}) is marked on hire but no active PO was found.`, 'warning');
      }

    } else if (existing.status === 'IN_REPAIR') {
      showToast(`🔧 ${existing.sizeGroup} Item (${cleanCode}) is in Repair. Move to available stock before hiring out.`, 'warning');

    } else if (existing.status === 'AVAILABLE') {
      // 🚀 AUTOMATED TRIGGER 2: OUTGOING ITEM SCAN CREATES / ACCUMULATES INTO PURCHASE ORDER!
      if (showCreatePoModal) {
        if (!newPoForm.selectedItemIds.includes(cleanCode)) {
          setNewPoForm(prev => ({
            ...prev,
            selectedItemIds: [...prev.selectedItemIds, cleanCode]
          }));
          showToast(`➕ Added ${existing.sizeGroup} ${existing.name} (${cleanCode}) to active Outgoing PO!`, 'success');
        } else {
          showToast(`ℹ️ Item (${cleanCode}) is already in this Outgoing PO list.`, 'info');
        }
      } else {
        // First scan of an outgoing item: open PO Builder automatically with this item!
        setShowCreatePoModal(true);
        setNewPoForm(prev => ({
          ...prev,
          selectedItemIds: [cleanCode],
          hireStartDate: new Date().toISOString().slice(0, 10),
          hireEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        }));
        showToast(`📦 Started Outgoing Purchase Order Builder with 1st item (${cleanCode})! Aim scanner to add more garments to this PO.`, 'success');
      }
    }
  };

  // OPEN MULTI-ITEM PO RETURN CHECKLIST WITH STRICT QR SCAN VERIFICATION
  const openPoReturnChecklist = (po: PurchaseOrder, triggerQrCode?: string) => {
    setActiveReturnPo(po);
    const initialChecklist: Record<string, { condition: 'GOOD_CLEAN' | 'NEEDS_REPAIR' | 'MISSING'; scanned: boolean; notes: string }> = {};

    po.items.forEach(li => {
      if (li.returned) {
        initialChecklist[li.qrCodeId] = {
          condition: li.returnCondition || 'GOOD_CLEAN',
          scanned: true,
          notes: 'Previously returned'
        };
      } else if (triggerQrCode && li.qrCodeId === triggerQrCode) {
        // The first scanned item is marked as SCANNED & VERIFIED
        initialChecklist[li.qrCodeId] = {
          condition: 'GOOD_CLEAN',
          scanned: true,
          notes: 'Scanned in store'
        };
      } else {
        // Mandatory Security Rule: Un-scanned items MUST default to MISSING until physically scanned!
        initialChecklist[li.qrCodeId] = {
          condition: 'MISSING',
          scanned: false,
          notes: 'Awaiting physical QR scan'
        };
      }
    });

    setReturnChecklist(initialChecklist as any);
  };

  // Step 2: Register Unregistered Item into Database
  const handleRegisterItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode || !currentUser) return;

    const newItem: KiltItem = {
      id: scannedCode,
      name: regForm.name,
      category: regForm.category,
      sizeGroup: regForm.sizeGroup,
      tartanOrColour: regForm.tartanOrColour,
      size: regForm.size,
      brandMake: regForm.brandMake,
      hireRate: Number(regForm.hireRate),
      depositAmount: Number(regForm.depositAmount),
      status: 'AVAILABLE',
      conditionNotes: regForm.conditionNotes,
      registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      registeredByStaff: currentUser.name,
      repairHistory: []
    };

    setItems(prev => [newItem, ...prev.filter(i => i.id !== scannedCode)]);
    addAuditLog('REGISTERED_ITEM', `Registered new ${newItem.sizeGroup} item ${newItem.name} (${newItem.id}) under ${newItem.category} (Hire £${newItem.hireRate} / Dep £${newItem.depositAmount})`, newItem.id);
    
    setShowRegisterModal(false);
    showToast(`✅ ${newItem.sizeGroup} garment ${newItem.id} saved into Available Stock! Ready for next scan.`, 'success');
  };

  // EDIT ITEM DETAILS HANDLER
  const handleSaveEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditItemModal || !currentUser) return;

    setItems(prev => prev.map(i => {
      if (i.id === showEditItemModal.id) {
        return showEditItemModal;
      }
      return i;
    }));

    addAuditLog('EDITED_ITEM_DETAILS', `Updated details & description for ${showEditItemModal.name} (${showEditItemModal.id})`, showEditItemModal.id);
    setShowEditItemModal(null);
    showToast(`✓ Updated item details for ${showEditItemModal.id}.`, 'success');
  };

  // REMOVE FROM ROTATION (RETIRE / DESTROY / STOLEN / SOLD) HANDLER
  const handleConfirmRemoveFromRotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRemoveRotationModal || !currentUser) return;

    const reasonText = retireReasonCategory === 'SOLD' ? `Sold Off (Ex-Hire Sale): ${retireNotes}` :
                       retireReasonCategory === 'STOLEN' ? `Stolen / Missing from shop: ${retireNotes}` :
                       retireReasonCategory === 'DESTROYED' ? `Destroyed / Damaged Beyond Repair: ${retireNotes}` :
                       `Written Off / Out of Rotation: ${retireNotes}`;

    setItems(prev => prev.map(i => {
      if (i.id === showRemoveRotationModal.id) {
        return {
          ...i,
          status: 'RETIRED' as const,
          retiredReason: reasonText,
          retiredAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          retiredByStaff: currentUser.name
        };
      }
      return i;
    }));

    addAuditLog('REMOVED_FROM_ROTATION', `Removed ${showRemoveRotationModal.name} (${showRemoveRotationModal.id}) completely from stock rotation. Reason: ${reasonText}`, showRemoveRotationModal.id);
    setShowRemoveRotationModal(null);
    setRetireNotes('');
    showToast(`🗑️ ${showRemoveRotationModal.id} archived in Master Admin Retired Stock log.`, 'warning');
  };

  // RESTORE RETIRED ITEM BACK TO ACTIVE STOCK (MASTER ADMIN ACTION)
  const handleRestoreRetiredItem = (itemToRestore: KiltItem) => {
    if (!currentUser || currentUser.role !== 'Master Admin') {
      alert('Only Master Admin can restore retired garments back into active stock.');
      return;
    }

    setItems(prev => prev.map(i => {
      if (i.id === itemToRestore.id) {
        return {
          ...i,
          status: 'AVAILABLE',
          retiredReason: undefined,
          retiredAt: undefined,
          retiredByStaff: undefined
        };
      }
      return i;
    }));

    addAuditLog('RESTORED_RETIRED_ITEM', `Master Admin Allan restored ${itemToRestore.name} (${itemToRestore.id}) back to Available Stock.`, itemToRestore.id);
    showToast(`✓ Item ${itemToRestore.id} restored back into Available Stock!`, 'success');
  };

  // Step 3: Send to Repair
  const handleConfirmSendToRepair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode || !currentUser) return;

    const item = items.find(i => i.id === scannedCode);
    if (!item) return;

    const repairEntry = {
      id: `REP-${Date.now().toString().slice(-4)}`,
      dateSent: new Date().toISOString().replace('T', ' ').slice(0, 16),
      sentByStaff: currentUser.name,
      reason: repairReason || 'Requires repair & inspection',
      severity: repairSeverity
    };

    setItems(prev => prev.map(i => {
      if (i.id === scannedCode) {
        return {
          ...i,
          status: 'IN_REPAIR',
          repairHistory: [repairEntry, ...(i.repairHistory || [])]
        };
      }
      return i;
    }));

    addAuditLog('SENT_TO_REPAIR', `Sent ${item.sizeGroup} item ${item.name} (${item.id}) to repair queue: ${repairReason}`, item.id);
    setShowSendRepairModal(false);
    setRepairReason('');
    showToast(`🔧 Item ${item.id} moved to Repair Workshop.`, 'warning');
  };

  // Step 4: Confirm Repair Fixed
  const handleConfirmRepairFixed = (codeId: string) => {
    if (!currentUser) return;
    const item = items.find(i => i.id === codeId);
    if (!item) return;

    setItems(prev => prev.map(i => {
      if (i.id === codeId) {
        const history = i.repairHistory || [];
        const updatedHistory = history.map((h, idx) => {
          if (idx === 0) {
            return {
              ...h,
              dateFixed: new Date().toISOString().replace('T', ' ').slice(0, 16),
              fixedByStaff: currentUser.name,
              fixedNotes: 'Repaired, cleaned and passed quality check.'
            };
          }
          return h;
        });
        return {
          ...i,
          status: 'AVAILABLE',
          repairHistory: updatedHistory
        };
      }
      return i;
    }));

    addAuditLog('REPAIR_COMPLETED', `Confirmed repair completed for ${item.name} (${item.id}). Returned to stock.`, item.id);
    showToast(`✓ Repair confirmed for ${item.id}. Returned to Available Stock!`, 'success');
  };

  // =========================================================================
  // AUTOMATED MULTI-ITEM PO BATCH RETURN PROCESSOR WITH DEPOSIT RETENTION LOGIC
  // =========================================================================
  const handleConfirmMultiItemReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturnPo || !currentUser) return;

    let totalRefundedDeposit = 0;
    let totalHeldDepositForRepair = 0;
    let totalHeldDepositForMissing = 0;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const updatedPoItems: POLineItem[] = activeReturnPo.items.map(li => {
      const itemConfig = returnChecklist[li.qrCodeId] || { condition: 'GOOD_CLEAN', notes: '' };
      const cond = itemConfig.condition;

      if (cond === 'GOOD_CLEAN') {
        totalRefundedDeposit += li.depositAmount;
        // Update item in stock to AVAILABLE
        setItems(prev => prev.map(i => i.id === li.qrCodeId ? { ...i, status: 'AVAILABLE', currentPoId: undefined } : i));
        return {
          ...li,
          returned: true,
          returnedAt: now,
          returnCondition: 'GOOD_CLEAN',
          depositAction: 'REFUNDED'
        };
      } else if (cond === 'NEEDS_REPAIR') {
        totalHeldDepositForRepair += li.depositAmount;
        // Update item in stock to IN_REPAIR
        const repairEntry = {
          id: `REP-${Date.now().toString().slice(-4)}`,
          dateSent: now,
          sentByStaff: currentUser.name,
          reason: `Returned DAMAGED from PO ${activeReturnPo.id}`,
          severity: 'Medium' as const
        };
        setItems(prev => prev.map(i => i.id === li.qrCodeId ? { 
          ...i, 
          status: 'IN_REPAIR', 
          currentPoId: undefined,
          repairHistory: [repairEntry, ...(i.repairHistory || [])]
        } : i));
        return {
          ...li,
          returned: true,
          returnedAt: now,
          returnCondition: 'NEEDS_REPAIR',
          depositAction: 'HELD_FOR_REPAIR'
        };
      } else {
        // MISSING / NOT RETURNED
        totalHeldDepositForMissing += li.depositAmount;
        // Item remains ON_HIRE with missing note
        return {
          ...li,
          returned: false,
          returnCondition: 'MISSING',
          depositAction: 'HELD_FOR_MISSING'
        };
      }
    });

    const allReturned = updatedPoItems.every(li => li.returned);
    const newPaymentStatus = allReturned 
      ? 'FULLY_REFUNDED' 
      : 'DEPOSIT_PARTIALLY_REFUNDED';

    setPos(prev => prev.map(p => {
      if (p.id === activeReturnPo.id) {
        return {
          ...p,
          items: updatedPoItems,
          paymentStatus: newPaymentStatus
        };
      }
      return p;
    }));

    const summaryDetails = `Processed PO ${activeReturnPo.id} Return for ${activeReturnPo.customerName}: Refunded £${totalRefundedDeposit} deposit. Held £${totalHeldDepositForRepair} for repairs, £${totalHeldDepositForMissing} for missing items.`;
    addAuditLog('PROCESSED_MULTI_ITEM_PO_RETURN', summaryDetails);

    if (totalHeldDepositForMissing > 0) {
      showToast(`⚠️ PO ${activeReturnPo.id} updated! Refunded £${totalRefundedDeposit}. Held £${totalHeldDepositForMissing} deposit for missing item(s).`, 'warning');
    } else {
      showToast(`✅ PO ${activeReturnPo.id} full return completed! PayPal £${totalRefundedDeposit} deposit refunded to ${activeReturnPo.customerName}.`, 'success');
    }

    setActiveReturnPo(null);
  };

  // Step 1: Create Batch of QR Codes (MASTER ADMIN ONLY)
  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'Master Admin') {
      alert('Permission Denied: Only Master Admin can generate QR code batches.');
      return;
    }

    const count = Math.min(Math.max(1, Number(batchForm.count)), 100);
    const sizeTag = batchForm.sizeGroup === 'Kid' ? '-KID' : '';
    const prefix = batchForm.category === 'Kilts' ? 'KILT' :
                   batchForm.category === 'Jackets' ? 'JKT' :
                   batchForm.category === 'Sporrans' ? 'SPO' :
                   batchForm.category === 'Ghillie Brogues' ? 'SHO' :
                   batchForm.category === 'Waistcoats' ? 'VST' :
                   batchForm.category === 'Shirts' ? 'SHT' :
                   batchForm.category === 'Socks & Garters' ? 'SOK' :
                   batchForm.category === 'Belts & Buckles' ? 'BLT' :
                   batchForm.category === 'Sgian-dubh (Knife)' ? 'KNF' : 'MISC';
    
    const batchId = `BATCH-${Date.now().toString().slice(-6)}`;
    const qrCodes: string[] = [];

    for (let i = 1; i <= count; i++) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      qrCodes.push(`${prefix}${sizeTag}-${randomNum}`);
    }

    const newBatch: QRBatch = {
      id: batchId,
      title: `${batchForm.title} (${batchForm.sizeGroup}s)`,
      category: batchForm.category,
      sizeGroup: batchForm.sizeGroup,
      count,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      createdByName: currentUser.name,
      qrCodes
    };

    setBatches(prev => [newBatch, ...prev]);
    addAuditLog('CREATED_QR_BATCH', `Generated batch of ${count} ${batchForm.sizeGroup} QR codes for ${batchForm.category} (${batchForm.title})`, batchId);
    setShowBatchModal(false);
    showToast(`🖨️ Batch of ${count} ${batchForm.sizeGroup} QR codes generated! Ready for initial print.`, 'success');
  };

  // ONE-TIME BATCH SHEET INITIAL PRINT HANDLER (MASTER ADMIN ONLY)
  const handleInitialBatchPrint = (batch: QRBatch) => {
    if (!currentUser || currentUser.role !== 'Master Admin') {
      alert('Permission Denied: Only Master Admin Allan can print QR code sheets.');
      return;
    }

    if (batch.isPrinted) {
      alert(`⚠️ One-Time Safeguard: This batch sheet was already printed on ${batch.printedAt} by ${batch.printedBy}.\n\nFull sheet duplicate printing is locked to prevent duplicate physical tags. If you need a replacement for a damaged tag (e.g. KILT-1005), use the Admin PIN Protected Replacement Tag Reprint option below.`);
      return;
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const updatedBatch: QRBatch = {
      ...batch,
      isPrinted: true,
      printedAt: now,
      printedBy: currentUser.name
    };

    setBatches(prev => prev.map(b => b.id === batch.id ? updatedBatch : b));
    setSelectedBatchForPrint(updatedBatch);
    setReprintPrintMode(false);
    addAuditLog('PRINTED_INITIAL_QR_BATCH', `Master Admin ${currentUser.name} authorized one-time initial printing of QR batch ${batch.id} (${batch.count} tags for ${batch.category})`, batch.id);

    showToast(`🖨️ Initial Sheet Print authorized for ${batch.id}! Sheet is now locked against duplicate full-prints.`, 'success');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // ADMIN PIN PROTECTED SINGLE / MULTI QR REPRINT SUBMIT
  const handleConfirmAdminReprintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForPrint || !currentUser || currentUser.role !== 'Master Admin') {
      alert('Permission Denied: Only Master Admin Allan can reprint replacement tags.');
      return;
    }

    if (selectedCodesForReprint.length === 0) {
      alert('Please select at least 1 QR code tag for replacement reprint.');
      return;
    }

    // Verify Master Admin Password / PIN (Master Admin PIN is '1234' or currentUser.pin)
    if (reprintPinInput.trim() !== currentUser.pin && reprintPinInput.trim() !== '1234') {
      alert('❌ Permission Denied: Incorrect Master Admin PIN. Replacement reprint canceled.');
      return;
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newReprintLog: QRReprintLog = {
      id: `REPRINT-${Date.now().toString().slice(-4)}`,
      reprintedAt: now,
      reprintedByStaff: currentUser.name,
      reprintedCodes: selectedCodesForReprint,
      reason: reprintReason.trim() || 'Damaged / replacement tag requested'
    };

    const updatedBatch: QRBatch = {
      ...selectedBatchForPrint,
      reprintHistory: [newReprintLog, ...(selectedBatchForPrint.reprintHistory || [])]
    };

    setBatches(prev => prev.map(b => b.id === selectedBatchForPrint.id ? updatedBatch : b));
    setSelectedBatchForPrint(updatedBatch);

    addAuditLog('REPRINTED_REPLACEMENT_QR_TAGS', `Master Admin ${currentUser.name} authorized PIN-protected replacement reprint of ${selectedCodesForReprint.length} tag(s): [${selectedCodesForReprint.join(', ')}]. Reason: ${newReprintLog.reason}`, selectedBatchForPrint.id);

    setShowReprintPinModal(false);
    setReprintPinInput('');
    setReprintPrintMode(true);
    showToast(`🛡️ Admin PIN Verified! Replacement reprint authorized for ${selectedCodesForReprint.length} tag(s): ${selectedCodesForReprint.join(', ')}`, 'success');

    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Create Purchase Order (Hire Out) with Dynamic Full Rigout Price Cap Calculation!
  const handleCreatePoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (newPoForm.selectedItemIds.length === 0) {
      alert('Please select at least one available stock item for this hire order.');
      return;
    }

    const selectedItemsList = items.filter(i => newPoForm.selectedItemIds.includes(i.id));
    const itemizedSubtotal = selectedItemsList.reduce((acc, curr) => acc + curr.hireRate, 0);
    const totalDep = selectedItemsList.reduce((acc, curr) => acc + curr.depositAmount, 0);

    // Determine if order is mostly Kids vs Adults
    const hasKidsItems = selectedItemsList.some(i => i.sizeGroup === 'Kid');
    const applicableCap = hasKidsItems ? kidMaxRigoutCapPrice : maxRigoutCapPrice;

    // Apply Full Rigout Pricing Cap Logic
    const fullRigoutCapApplied = itemizedSubtotal > applicableCap;
    const fullRigoutDiscount = fullRigoutCapApplied ? itemizedSubtotal - applicableCap : 0;
    const totalHireFee = fullRigoutCapApplied ? applicableCap : itemizedSubtotal;

    const poId = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const paypalTxId = `PAYPAL-TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const poItems = selectedItemsList.map(item => ({
      qrCodeId: item.id,
      itemName: item.name,
      category: item.category,
      sizeGroup: item.sizeGroup,
      size: item.size,
      hireRate: item.hireRate,
      depositAmount: item.depositAmount,
      returned: false
    }));

    const newPo: PurchaseOrder = {
      id: poId,
      customerName: newPoForm.customerName,
      customerEmail: newPoForm.customerEmail,
      customerPhone: newPoForm.customerPhone,
      eventDate: newPoForm.eventDate,
      hireStartDate: newPoForm.hireStartDate,
      hireEndDate: newPoForm.hireEndDate,
      items: poItems,
      itemizedSubtotal,
      fullRigoutCapApplied,
      fullRigoutDiscount,
      totalHireFee,
      totalDepositHeld: totalDep,
      paypalTransactionId: paypalTxId,
      paymentStatus: 'PAID_WITH_DEPOSIT',
      issuedByStaff: currentUser.name,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      notes: newPoForm.notes
    };

    setItems(prev => prev.map(item => {
      if (newPoForm.selectedItemIds.includes(item.id)) {
        return {
          ...item,
          status: 'ON_HIRE',
          currentPoId: poId
        };
      }
      return item;
    }));

    setPos(prev => [newPo, ...prev]);
    addAuditLog(
      'CREATED_PO_PAYPAL', 
      `Created Hire PO ${poId} for ${newPo.customerName}. Subtotal £${itemizedSubtotal}${fullRigoutCapApplied ? ` capped at £${applicableCap} (Discount -£${fullRigoutDiscount})` : ''} + £${totalDep} deposit. PayPal (${paypalTxId})`
    );

    setShowCreatePoModal(false);
    setNewPoForm({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      eventDate: '',
      hireStartDate: '',
      hireEndDate: '',
      notes: '',
      selectedItemIds: []
    });
    showToast(`💳 Purchase Order ${poId} created & PayPal payment processed!`, 'success');
  };

  // EDIT PO Details (Shop Assistant / Staff Action)
  const handleEditPoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditPoModal) return;

    setPos(prev => prev.map(p => {
      if (p.id === showEditPoModal.id) {
        return {
          ...p,
          notes: editPoNotes
        };
      }
      return p;
    }));

    addAuditLog('EDITED_PO', `Updated notes/details on Purchase Order ${showEditPoModal.id}`);
    setShowEditPoModal(null);
    showToast(`Updated Purchase Order ${showEditPoModal.id} notes.`, 'info');
  };

  const scItem = items.find(i => i.id === scannedCode);
  const isMasterAdmin = currentUser?.role === 'Master Admin';

  const availableItems = items.filter(i => i.status === 'AVAILABLE');
  const onHireItems = items.filter(i => i.status === 'ON_HIRE');
  const inRepairItems = items.filter(i => i.status === 'IN_REPAIR');
  const retiredItems = items.filter(i => i.status === 'RETIRED');

  // Filtered items helper for shop assistant tabs (with Demographic Adults vs Kids filter & active stock)
  const getFilteredItems = (targetList: KiltItem[], sizeFilter: 'ALL' | 'Adult' | 'Kid' = 'ALL') => {
    let result = targetList.filter(i => i.status !== 'RETIRED');

    if (sizeFilter !== 'ALL') {
      result = result.filter(i => i.sizeGroup === sizeFilter);
    }

    if (!assistantSearch.trim()) return result;
    const q = assistantSearch.toLowerCase().trim();
    return result.filter(i => 
      i.id.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.tartanOrColour.toLowerCase().includes(q) ||
      i.size.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  };

  // Navigation Items Config for Admin
  const NAV_ITEMS = [
    { id: 'scanner', label: 'QR Scanner & Actions', icon: QrCode, badge: scItem ? '1 Active' : null, restricted: false },
    { id: 'pricing', label: 'Pricing Settings Matrix', icon: PriceTag, badge: 'Adult & Kids', restricted: !isMasterAdmin },
    { id: 'batches', label: 'QR Batch Printing', icon: Printer, badge: `${batches.length} Batches`, restricted: !isMasterAdmin },
    { id: 'inventory', label: 'Stock Inventory', icon: Layers, badge: `${items.filter(i=>i.status!=='RETIRED').length}`, restricted: false },
    { id: 'pos', label: 'Hire POs & PayPal', icon: CreditCard, badge: `${pos.length}`, restricted: false },
    { id: 'repairs', label: 'Repair Workshop', icon: Wrench, badge: `${items.filter(i=>i.status==='IN_REPAIR').length}`, restricted: false },
    { id: 'admin', label: 'Master Admin & Invites', icon: ShieldCheck, badge: invites.filter(i=>i.status==='PENDING').length ? `${invites.filter(i=>i.status==='PENDING').length} Invites` : null, restricted: false },
  ];

  // =========================================================================
  // LOGGED OUT / REGISTER AUTHENTICATION OVERLAY
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-md">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Highland Kilt & Hire</h1>
            <p className="text-xs text-slate-500 mt-1">Staff Back Office & QR Management System</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg transition ${
                authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 rounded-lg transition ${
                authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Register with Invite Code
            </button>
          </div>

          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Staff Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="email"
                    required
                    placeholder="e.g. admin@kilt-hire.co.uk"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Staff PIN Code</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="password"
                    required
                    placeholder="Enter 4-digit PIN (Demo: 1234)"
                    value={loginPin}
                    onChange={e => setLoginPin(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl shadow-md transition"
              >
                Sign In to Back Office
              </button>

              <div className="pt-4 border-t border-slate-100">
                <span className="block text-[11px] font-bold text-slate-500 mb-2 text-center">⚡ Instant Demo Quick Login:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentUser(staffList[0])}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition"
                  >
                    <span className="font-bold block text-slate-900 text-[11px]">Allan</span>
                    <span className="text-[10px] text-amber-700 font-semibold">Master Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentUser(staffList[1])}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition"
                  >
                    <span className="font-bold block text-slate-900 text-[11px]">Fiona MacLean</span>
                    <span className="text-[10px] text-slate-500">Staff Member</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {regError}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900">
                <p className="font-bold">🔒 Invite Code Required</p>
                <p className="text-amber-800 mt-0.5">Registration is restricted to authorized staff members who received an invitation email from Allan (Master Admin).</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Invitation Code</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. HIGHLAND-STAFF-9901"
                  value={regInviteCode}
                  onChange={e => setRegInviteCode(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-amber-800 uppercase outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Bruce Campbell"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                <input 
                  type="email"
                  required
                  placeholder="e.g. bruce@kilt-hire.co.uk"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Set Staff PIN Code</label>
                <input 
                  type="password"
                  required
                  placeholder="Set 4-digit PIN (e.g. 1234)"
                  value={regPin}
                  onChange={e => setRegPin(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl shadow-md transition"
              >
                Validate Invite & Register Account
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex font-sans">
      
      {/* TOAST NOTIFICATION FOR AUTOMATED ACTIONS */}
      {scanToast && (
        <div className={`no-print fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 animate-bounce ${
          scanToast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
          scanToast.type === 'info' ? 'bg-blue-600 text-white border-blue-500' :
          'bg-amber-500 text-slate-950 border-amber-400'
        }`}>
          <Zap className="w-4 h-4" />
          <span>{scanToast.msg}</span>
        </div>
      )}

      {/* VERTICAL SIDEBAR NAVIGATION */}
      <aside className={`no-print
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 shadow-lg lg:translate-x-0 lg:static lg:shadow-none
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-xl text-slate-950 font-bold shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">Highland Kilt Hire</h1>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Back Office QR Portal</span>
              </div>
            </div>
            
            <button 
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* MODE TOGGLE SWITCHER */}
          <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 block">Terminal Mode</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setInterfaceMode('shop_assistant')}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition ${
                  interfaceMode === 'shop_assistant'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Store className="w-3.5 h-3.5" /> Shop Assistant
              </button>
              <button
                onClick={() => setInterfaceMode('admin_portal')}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition ${
                  interfaceMode === 'admin_portal'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Full Admin
              </button>
            </div>
          </div>

          {/* MAIN NAV ITEMS */}
          {interfaceMode === 'admin_portal' ? (
            <nav className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">Admin Navigation</span>
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition group text-left
                      ${isActive 
                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500 group-hover:text-slate-900'}`} />
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.restricted && (
                        <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                      )}
                      {item.badge && (
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                          isActive ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">Shop Floor Quick Tabs</span>
              
              <button
                onClick={() => setAssistantTab('scanner')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  assistantTab === 'scanner' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4" />
                  <span>Auto QR Scanner</span>
                </div>
              </button>

              <button
                onClick={() => setAssistantTab('in_stock')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  assistantTab === 'in_stock' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>In Stock</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-emerald-100 text-emerald-800">
                  {availableItems.length}
                </span>
              </button>

              <button
                onClick={() => setAssistantTab('on_hire')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  assistantTab === 'on_hire' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PackageCheck className="w-4 h-4 text-blue-600" />
                  <span>On Hire (Out)</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-blue-100 text-blue-800">
                  {onHireItems.length}
                </span>
              </button>

              <button
                onClick={() => setAssistantTab('in_repair')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  assistantTab === 'in_repair' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-rose-600" />
                  <span>In Repair</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-rose-100 text-rose-800">
                  {inRepairItems.length}
                </span>
              </button>

              <button
                onClick={() => setAssistantTab('pos')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  assistantTab === 'pos' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>Customer POs</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-amber-100 text-amber-900">
                  {pos.length}
                </span>
              </button>
            </nav>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center shadow-sm">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block truncate max-w-[130px]">{currentUser.name}</span>
                <span className="text-[10px] text-amber-700 font-semibold block">{currentUser.role}</span>
              </div>
            </div>

            <button
              onClick={() => setCurrentUser(null)}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={handleResetData}
            className="w-full py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Demo State
          </button>
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>Highland Kilt Hire</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-amber-700 font-bold">
                  {interfaceMode === 'shop_assistant' 
                    ? `Shop Assistant (${assistantTab.toUpperCase().replace('_', ' ')})` 
                    : NAV_ITEMS.find(n => n.id === activeTab)?.label}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {interfaceMode === 'shop_assistant' 
                  ? assistantTab === 'scanner' ? 'Automated QR Scanner'
                    : assistantTab === 'in_stock' ? 'Garments Available in Stock'
                    : assistantTab === 'on_hire' ? 'Garments Currently On Hire'
                    : assistantTab === 'in_repair' ? 'Garments in Repair Workshop'
                    : 'Customer Purchase Orders'
                  : NAV_ITEMS.find(n => n.id === activeTab)?.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setInterfaceMode(interfaceMode === 'admin_portal' ? 'shop_assistant' : 'admin_portal')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border shadow-sm transition ${
                interfaceMode === 'shop_assistant'
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : 'bg-amber-100 border-amber-300 text-amber-900'
              }`}
            >
              {interfaceMode === 'shop_assistant' ? <Store className="w-4 h-4 text-emerald-600" /> : <ShieldCheck className="w-4 h-4 text-amber-600" />}
              {interfaceMode === 'shop_assistant' ? 'Switch to Full Admin' : 'Switch to Shop Assistant'}
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl mx-auto w-full flex-1">

          {/* ========================================================= */}
          {/* SHOP ASSISTANT AUTOMATED FLOOR TERMINAL MODE */}
          {/* ========================================================= */}
          {interfaceMode === 'shop_assistant' && (
            <div className="space-y-6">
              
              {/* SHOP ASSISTANT QUICK STATUS FILTER TABS */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setAssistantTab('scanner')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'scanner' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-amber-300" /> Auto QR Scanner
                  </button>

                  <button
                    onClick={() => setAssistantTab('in_stock')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'in_stock' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-4 h-4" /> Available in Stock
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'in_stock' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {availableItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAssistantTab('on_hire')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'on_hire' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <PackageCheck className="w-4 h-4" /> Currently On Hire
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'on_hire' ? 'bg-white text-blue-900' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {onHireItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAssistantTab('in_repair')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'in_repair' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Wrench className="w-4 h-4" /> In Repair Workshop
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'in_repair' ? 'bg-white text-rose-900' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {inRepairItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAssistantTab('pos')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'pos' 
                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Customer POs
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'pos' ? 'bg-slate-950 text-amber-400' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {pos.length}
                    </span>
                  </button>
                </div>

                {/* ADULTS VS KIDS SIZE DEMOGRAPHIC TOGGLE FILTER */}
                {assistantTab !== 'scanner' && assistantTab !== 'pos' && (
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      onClick={() => setAssistantSizeFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition ${assistantSizeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      All Sizes
                    </button>
                    <button
                      onClick={() => setAssistantSizeFilter('Adult')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${assistantSizeFilter === 'Adult' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'}`}
                    >
                      <User className="w-3 h-3" /> Adults
                    </button>
                    <button
                      onClick={() => setAssistantSizeFilter('Kid')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${assistantSizeFilter === 'Kid' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600'}`}
                    >
                      <Baby className="w-3 h-3" /> Kids
                    </button>
                  </div>
                )}
              </div>

              {/* FLOOR SCANNER TAB */}
              {assistantTab === 'scanner' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-[11px] font-extrabold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" /> Automated Multi-Item PO Batch Scanner Active
                      </span>
                      <h2 className="text-xl font-extrabold tracking-tight">Scan Any Item in a Returned Hire Bag</h2>
                      <p className="text-xs text-emerald-100 max-w-xl">
                        Scanning ANY single item on a PO immediately locates the customer's order and loads ALL items into a multi-item return checklist with missing item handling!
                      </p>
                    </div>

                    <button
                      onClick={toggleCamera}
                      className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-2xl shadow-md flex items-center gap-2 transition"
                    >
                      <Camera className="w-5 h-5" />
                      {activeCamera ? 'Stop Camera Scanner' : 'Launch Camera Scanner'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 space-y-4">
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-amber-600" /> Floor Scanner Input
                          </h3>
                          {scannedCode && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-900 font-mono font-bold text-xs rounded-lg border border-amber-300">
                              Active: {scannedCode}
                            </span>
                          )}
                        </div>

                        {activeCamera ? (
                          <div className="relative rounded-2xl overflow-hidden bg-black border-4 border-emerald-500 aspect-video flex items-center justify-center shadow-md">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 border-2 border-dashed border-amber-400 m-8 rounded-xl pointer-events-none flex items-center justify-center">
                              <span className="bg-black/80 px-4 py-1.5 rounded-lg text-xs font-bold text-amber-300">Aim at Iron-On QR Label</span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                              <QrCode className="w-7 h-7" />
                            </div>
                            <p className="text-xs font-semibold text-slate-700 mb-1">Click below to simulate scanning an iron-on QR label:</p>
                          </div>
                        )}

                        <div className="space-y-3 pt-2">
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="Type or scan QR code (e.g. KILT-1001, KILT-KID-501)..."
                              value={simulatedInput}
                              onChange={e => setSimulatedInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleScanCode(simulatedInput);
                              }}
                              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                            />
                            <button
                              onClick={() => handleScanCode(simulatedInput)}
                              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs shadow transition"
                            >
                              Scan
                            </button>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-xs font-bold text-slate-700 block">⚡ Instant Demo Scan Pickers:</span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleScanCode('KILT-1001')}
                                className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-950 font-mono font-bold text-xs rounded-xl border border-blue-300 text-left transition flex items-center justify-between"
                              >
                                <span>KILT-1001</span>
                                <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-blue-800 font-sans font-bold">PO-9011 (4 Items)</span>
                              </button>
                              <button
                                onClick={() => handleScanCode('KILT-KIDS-501')}
                                className="p-2.5 bg-purple-100 hover:bg-purple-200 text-purple-950 font-mono font-bold text-xs rounded-xl border border-purple-300 text-left transition flex items-center justify-between"
                              >
                                <span>KILT-KIDS-501</span>
                                <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-purple-800 font-sans font-bold">PO-8802 (Kids 3 Items)</span>
                              </button>
                              <button
                                onClick={() => handleScanCode('JKT-2002')}
                                className="p-2.5 bg-rose-100 hover:bg-rose-200 text-rose-950 font-mono font-bold text-xs rounded-xl border border-rose-300 text-left transition flex items-center justify-between"
                              >
                                <span>JKT-2002</span>
                                <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-rose-800 font-sans font-bold">In Repair Workshop</span>
                              </button>
                              <button
                                onClick={() => handleScanCode('KILT-KID-8839')}
                                className="p-2.5 bg-purple-100 hover:bg-purple-200 text-purple-950 font-mono font-bold text-xs rounded-xl border border-purple-300 text-left transition flex items-center justify-between"
                              >
                                <span>KILT-KID-8839</span>
                                <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-purple-800 font-sans font-bold">New Unregistered QR</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-6">
                      {scannedCode ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-amber-100 text-amber-900 font-mono font-extrabold text-sm rounded-lg border border-amber-300">
                                  {scannedCode}
                                </span>
                                {scItem && (
                                  <span className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 ${scItem.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                                    {scItem.sizeGroup === 'Kid' ? <Baby className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                    {scItem.sizeGroup} Size
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base font-extrabold text-slate-900 mt-2">
                                {scItem ? scItem.name : 'Unregistered Iron-On QR Label'}
                              </h3>
                            </div>

                            <span className={`px-3 py-1 text-xs font-extrabold rounded-full border ${
                              !scItem ? 'bg-amber-100 text-amber-900 border-amber-300' :
                              scItem.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                              scItem.status === 'ON_HIRE' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                              'bg-rose-100 text-rose-900 border-rose-300'
                            }`}>
                              {!scItem ? '✨ Auto-Register Pending' : scItem.status}
                            </span>
                          </div>

                          {!scItem && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                              <p className="text-xs text-amber-900 font-bold">
                                ⚡ Auto-detected unregistered QR! Click below to enter description & Adult/Kid sizing:
                              </p>
                              <button
                                onClick={() => setShowRegisterModal(true)}
                                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                              >
                                <PlusCircle className="w-4 h-4" /> Save Garment Description into Stock
                              </button>
                            </div>
                          )}

                          {scItem && scItem.status === 'AVAILABLE' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                                <div>
                                  <span className="text-slate-500 block">Category</span>
                                  <span className="font-semibold text-slate-900">{scItem.category}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Demographic</span>
                                  <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] inline-block ${scItem.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                                    {scItem.sizeGroup} Size
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Tartan / Colour</span>
                                  <span className="font-semibold text-slate-900">{scItem.tartanOrColour}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Size</span>
                                  <span className="font-semibold text-slate-900">{scItem.size}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Hire Rate</span>
                                  <span className="font-bold text-amber-700">£{scItem.hireRate} / period</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Deposit Req.</span>
                                  <span className="font-bold text-emerald-700">£{scItem.depositAmount}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-500 block">Registered By</span>
                                  <span className="font-semibold text-slate-700">{scItem.registeredByStaff || 'System'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                  onClick={() => setShowCreatePoModal(true)}
                                  className="p-4 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-left transition shadow-sm group"
                                >
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className="p-2 bg-emerald-600 text-white rounded-lg group-hover:scale-105 transition">
                                      <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-emerald-900 text-sm">Option A: Hire Out Item</h4>
                                      <p className="text-[11px] text-emerald-700">Add to Purchase Order & take deposit</p>
                                    </div>
                                  </div>
                                </button>

                                <button
                                  onClick={() => setShowSendRepairModal(true)}
                                  className="p-4 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-xl text-left transition shadow-sm group"
                                >
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className="p-2 bg-rose-600 text-white rounded-lg group-hover:scale-105 transition">
                                      <Wrench className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-rose-900 text-sm">Option B: Send to Repair</h4>
                                      <p className="text-[11px] text-rose-700">Remove from stock & log damage reason</p>
                                    </div>
                                  </div>
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => setShowEditItemModal(scItem)}
                                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5"
                                >
                                  <Edit3 className="w-4 h-4 text-amber-600" /> Edit Item Description
                                </button>

                                <button
                                  onClick={() => setShowRemoveRotationModal(scItem)}
                                  className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-600" /> Remove from Rotation
                                </button>
                              </div>
                            </div>
                          )}

                          {scItem && scItem.status === 'ON_HIRE' && (
                            <div className="space-y-4">
                              {(() => {
                                const po = pos.find(p => p.id === scItem.currentPoId);
                                return (
                                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-5 space-y-4">
                                    <h3 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                                      <PackageCheck className="w-5 h-5 text-blue-600" /> Item is Currently On Hire (Linked to PO {po?.id})
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                      <div><span className="text-slate-500">PO Ref:</span> <span className="font-mono font-bold text-blue-700">{po?.id}</span></div>
                                      <div><span className="text-slate-500">Customer:</span> <strong>{po?.customerName}</strong></div>
                                      <div><span className="text-slate-500">Total Outfit Items:</span> <strong>{po?.items.length} Items</strong></div>
                                      <div><span className="text-slate-500">Total Deposit Held:</span> <strong className="text-emerald-700">£{po?.totalDepositHeld}</strong></div>
                                    </div>

                                    <button
                                      onClick={() => po && openPoReturnChecklist(po, scItem.id)}
                                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                                    >
                                      <RotateCcw className="w-4 h-4" /> Open Full Multi-Item PO Return Checklist
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {scItem && scItem.status === 'IN_REPAIR' && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 space-y-4">
                              <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                                <Wrench className="w-5 h-5 text-rose-600" /> Item Currently In Repair Workshop
                              </div>
                              
                              {scItem.repairHistory && scItem.repairHistory.length > 0 && (
                                <div className="bg-white p-3 rounded-lg text-xs space-y-1 border border-rose-100 shadow-sm text-slate-700">
                                  <p><span className="text-slate-500">Issue Reported:</span> <strong>{scItem.repairHistory[0].reason}</strong></p>
                                  <p><span className="text-slate-500">Severity:</span> <span className="text-rose-700 font-bold">{scItem.repairHistory[0].severity}</span></p>
                                  <p><span className="text-slate-500">Sent By Staff:</span> {scItem.repairHistory[0].sentByStaff} ({scItem.repairHistory[0].dateSent})</p>
                                </div>
                              )}

                              <button
                                onClick={() => handleConfirmRepairFixed(scItem.id)}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Confirm Repair Completed & Return to Stock
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
                          <Zap className="w-10 h-10 mb-2 text-amber-500 animate-pulse" />
                          <h4 className="text-base font-extrabold text-slate-800">Ready for Instant Scan</h4>
                          <p className="text-xs text-slate-500 max-w-xs mt-1">
                            Scan ANY item in a returned bag. Scanning 1 item immediately locates the Customer PO and loads all items into a multi-item return checklist!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* IN STOCK LIST TAB */}
              {assistantTab === 'in_stock' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-emerald-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" /> Garments Available in Store Right Now ({getFilteredItems(availableItems, assistantSizeFilter).length})
                      </h3>
                      <p className="text-xs text-slate-500">Stock physically in shop available to hire immediately.</p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text"
                        placeholder="Search size, tartan, name..."
                        value={assistantSearch}
                        onChange={e => setAssistantSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getFilteredItems(availableItems, assistantSizeFilter).map(item => (
                      <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 hover:border-emerald-400 rounded-2xl space-y-3 transition shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-amber-800 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                              {item.id}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded flex items-center gap-1 ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                              {item.sizeGroup === 'Kid' ? <Baby className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              {item.sizeGroup}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full">
                            ✓ Ready in Store
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                          <p className="text-xs text-slate-600">{item.tartanOrColour} ({item.size})</p>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                          <span className="font-bold text-amber-800">£{item.hireRate} hire</span>
                          <span className="text-[11px] text-emerald-700 font-semibold">£{item.depositAmount} dep</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Quick Garment Actions:</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => {
                                handleScanCode(item.id);
                                setShowCreatePoModal(true);
                              }}
                              className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm transition text-center"
                            >
                              Hire Out
                            </button>
                            <button
                              onClick={() => {
                                handleScanCode(item.id);
                                setShowSendRepairModal(true);
                              }}
                              className="py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-sm transition text-center"
                            >
                              Send Repair
                            </button>
                            <button
                              onClick={() => setShowEditItemModal(item)}
                              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg border border-slate-200 transition flex items-center justify-center gap-1"
                            >
                              <Edit3 className="w-3 h-3 text-amber-600" /> Edit Specs
                            </button>
                            <button
                              onClick={() => setShowRemoveRotationModal(item)}
                              className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" /> Remove Stock
                            </button>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ON HIRE LIST TAB */}
              {assistantTab === 'on_hire' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-blue-900 flex items-center gap-2">
                        <PackageCheck className="w-5 h-5 text-blue-600" /> Garments Currently On Hire With Customers ({getFilteredItems(onHireItems, assistantSizeFilter).length})
                      </h3>
                      <p className="text-xs text-slate-500">Out on rental agreements. Do not search store shelves for these!</p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text"
                        placeholder="Search QR or customer..."
                        value={assistantSearch}
                        onChange={e => setAssistantSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getFilteredItems(onHireItems, assistantSizeFilter).map(item => {
                      const po = pos.find(p => p.id === item.currentPoId);
                      const overdueInfo = getOverdueStatus(po?.hireEndDate);

                      return (
                        <div key={item.id} className={`p-4 rounded-2xl space-y-2 transition ${overdueInfo.cardBg}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-slate-900 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                                {item.id}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                {item.sizeGroup}
                              </span>
                            </div>

                            {/* DYNAMIC RETURN DUE DATE & OVERDUE BADGE */}
                            <span className={`px-2.5 py-1 text-[10px] rounded-full border ${overdueInfo.badgeBg}`}>
                              {overdueInfo.label}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                            <p className="text-xs text-slate-600">{item.tartanOrColour} ({item.size})</p>
                          </div>

                          <div className="bg-white/90 p-2.5 rounded-xl text-xs space-y-1 border border-slate-200">
                            <p><span className="text-slate-500">Customer:</span> <strong className="text-slate-900">{po?.customerName}</strong> ({po?.customerPhone})</p>
                            <p><span className="text-slate-500">PO Ref:</span> <strong className="text-blue-900 font-mono">{po?.id}</strong></p>
                            <p><span className="text-slate-500">Return Due Date:</span> <strong className={overdueInfo.textColor}>{po?.hireEndDate || 'Not set'}</strong></p>
                          </div>

                          <button
                            onClick={() => {
                              if (po) openPoReturnChecklist(po, item.id);
                            }}
                            className={`w-full py-2.5 rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5 ${
                              overdueInfo.level === 'OVERDUE_SEVERE' ? 'bg-rose-600 hover:bg-rose-700 text-white' :
                              overdueInfo.level === 'OVERDUE_LIGHT' ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold' :
                              'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Open Full PO Return Checklist
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* IN REPAIR LIST TAB */}
              {assistantTab === 'in_repair' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-rose-900 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-rose-600" /> Garments in Repair Workshop ({getFilteredItems(inRepairItems, assistantSizeFilter).length})
                      </h3>
                      <p className="text-xs text-slate-500">Out for seamstress repair or dry cleaning. Do not search store shelves!</p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text"
                        placeholder="Search defect or QR..."
                        value={assistantSearch}
                        onChange={e => setAssistantSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getFilteredItems(inRepairItems, assistantSizeFilter).map(item => {
                      const rep = item.repairHistory?.[0];
                      return (
                        <div key={item.id} className="p-4 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-2 transition shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-rose-800 text-xs bg-white px-2 py-0.5 rounded border border-rose-200">
                                {item.id}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                {item.sizeGroup}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 rounded-full">
                              🔧 In Repair Queue
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                            <p className="text-xs text-slate-600">{item.tartanOrColour} ({item.size})</p>
                          </div>

                          <div className="bg-white p-2.5 rounded-xl text-xs space-y-0.5 border border-rose-100">
                            <p><span className="text-slate-500">Issue:</span> <strong className="text-rose-900">{rep?.reason || 'Repair'}</strong></p>
                            <p><span className="text-slate-500">Sent:</span> {rep?.dateSent}</p>
                          </div>

                          <button
                            onClick={() => handleConfirmRepairFixed(item.id)}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Repair Fixed & Return to Stock
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CUSTOMER POs TAB WITH LIVE AUTOMATED RETURN PROGRESS BARS */}
              {assistantTab === 'pos' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" /> Active Customer Purchase Orders & Real-time Scan Return Ledger
                      </h3>
                      <p className="text-xs text-slate-500">
                        Scanning any garment in a returned bag opens the full multi-item checklist and calculates deposit refunds in real-time.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {pos.length} Customer POs
                    </span>
                  </div>

                  <div className="space-y-4">
                    {pos.map(po => {
                      const returnedCount = po.items.filter(i => i.returned).length;
                      const totalCount = po.items.length;
                      const isComplete = returnedCount === totalCount;
                      const overdueInfo = getOverdueStatus(po.hireEndDate, isComplete);

                      return (
                        <div key={po.id} className={`p-5 rounded-2xl space-y-3 transition ${isComplete ? 'bg-slate-50 border border-slate-200 shadow-sm' : overdueInfo.poCardBg}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-extrabold text-amber-900 text-sm bg-white px-2 py-0.5 rounded border border-amber-300">{po.id}</span>
                                <span className="font-extrabold text-slate-900 text-sm">{po.customerName}</span>
                                <span className="text-xs text-slate-600">({po.customerPhone})</span>

                                {isComplete ? (
                                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" /> ALL ITEMS RETURNED & REFUNDED
                                  </span>
                                ) : (
                                  <span className={`px-2.5 py-0.5 text-[10px] rounded-full border ${overdueInfo.badgeBg}`}>
                                    {overdueInfo.label} • ({returnedCount}/{totalCount} Returned)
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-600 block mt-1">
                                Hire Period: <strong>{po.hireStartDate}</strong> to <strong className={!isComplete ? overdueInfo.textColor : ''}>{po.hireEndDate}</strong> (Event: {po.eventDate})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openPoReturnChecklist(po)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1 ${
                                  overdueInfo.level === 'OVERDUE_SEVERE' && !isComplete ? 'bg-rose-600 hover:bg-rose-700 text-white font-extrabold' :
                                  overdueInfo.level === 'OVERDUE_LIGHT' && !isComplete ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold' :
                                  'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Process PO Batch Return
                              </button>

                              <button
                                onClick={() => {
                                  setShowEditPoModal(po);
                                  setEditPoNotes(po.notes || '');
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit PO Notes
                              </button>

                              <span className="font-mono font-extrabold text-amber-800 text-sm bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                                £{po.totalHireFee} Paid
                              </span>
                            </div>
                          </div>

                          {/* AUTOMATED RETURN PROGRESS BAR */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600">
                              <span>Automated Return Progress:</span>
                              <span>{returnedCount} of {totalCount} Garments Returned</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                style={{ width: `${(returnedCount / totalCount) * 100}%` }}
                              />
                            </div>
                          </div>

                          {po.notes && (
                            <div className="text-xs bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 text-amber-900">
                              <strong>Staff Notes:</strong> {po.notes}
                            </div>
                          )}

                          {/* INDIVIDUAL ITEM LINE ITEMS WITH AUTOMATED SCAN STATUS */}
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Garment Line Items & Real-Time Scan Status:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {po.items.map(item => (
                                <div key={item.qrCodeId} className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                                  item.returned ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-slate-200'
                                }`}>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-extrabold text-slate-800">{item.qrCodeId}</span>
                                      <span className="text-slate-900 font-semibold">{item.itemName}</span>
                                    </div>
                                    <span className={`text-[10px] ${item.sizeGroup === 'Kid' ? 'text-purple-800 font-bold' : 'text-blue-800 font-bold'}`}>
                                      {item.sizeGroup} ({item.size}) • Deposit £{item.depositAmount}
                                    </span>
                                  </div>

                                  <div>
                                    {item.returned ? (
                                      <div className="text-right">
                                        <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded inline-flex items-center gap-1 ${
                                          item.returnCondition === 'GOOD_CLEAN' 
                                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                                        }`}>
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          {item.returnCondition === 'GOOD_CLEAN' ? 'Returned (Deposit Refunded)' : 'Damaged (Deposit Held)'}
                                        </span>
                                        <span className="text-[9px] text-slate-400 block font-mono mt-0.5">{item.returnedAt}</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => openPoReturnChecklist(po, item.qrCodeId)}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition flex items-center gap-1"
                                      >
                                        <Zap className="w-3 h-3 text-amber-300" /> Scan Return
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* FULL ADMIN BACK OFFICE PORTAL MODE */}
          {/* ========================================================= */}
          {interfaceMode === 'admin_portal' && (
            <>
              {/* TAB: PRICING SETTINGS MATRIX (ADULTS VS KIDS) */}
              {activeTab === 'pricing' && (
                <div className="space-y-6">
                  {!isMasterAdmin ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-2xl mx-auto space-y-4">
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 mx-auto">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Master Admin Access Required</h3>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                        Master Pricing Control & Category Rates are restricted exclusively to Allan (Master Admin).
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* PRICING CAPS BANNER */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-amber-300 p-5 rounded-3xl shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                              <Tag className="w-4 h-4 text-amber-600" /> Adult Full Rigout Price Cap
                            </span>
                            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              Adult Cap
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">Max total hire fee when an adult hires a full outfit.</p>
                          <div className="flex items-center gap-2 pt-2">
                            <span className="font-bold text-sm text-slate-700">£</span>
                            <input 
                              type="number"
                              min={0}
                              value={maxRigoutCapPrice}
                              onChange={e => setMaxRigoutCapPrice(Number(e.target.value))}
                              className="w-28 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-extrabold text-base text-amber-800 outline-none focus:border-amber-500"
                            />
                            <span className="text-xs font-bold text-slate-500">Max Limit</span>
                          </div>
                        </div>

                        <div className="bg-white border border-purple-300 p-5 rounded-3xl shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-purple-600" /> Kids Full Rigout Price Cap
                            </span>
                            <span className="text-xs font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                              Kids Cap
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">Max total hire fee when a child hires a full outfit.</p>
                          <div className="flex items-center gap-2 pt-2">
                            <span className="font-bold text-sm text-slate-700">£</span>
                            <input 
                              type="number"
                              min={0}
                              value={kidMaxRigoutCapPrice}
                              onChange={e => setKidMaxRigoutCapPrice(Number(e.target.value))}
                              className="w-28 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-extrabold text-base text-purple-800 outline-none focus:border-purple-500"
                            />
                            <span className="text-xs font-bold text-slate-500">Max Limit</span>
                          </div>
                        </div>
                      </div>

                      {/* CATEGORY PRICING MATRIX TABLE */}
                      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                              <PriceTag className="w-5 h-5 text-amber-600" /> Master Category Pricing Matrix (Adults vs Kids)
                            </h3>
                            <p className="text-xs text-slate-500">
                              Set default rental rates and security deposits for all items. Garments automatically pre-fill these prices during registration.
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                              <tr>
                                <th className="py-4 px-4">Garment Category</th>
                                <th className="py-4 px-4 bg-amber-50/50 text-amber-950 border-l border-amber-200">Adult Rental (£)</th>
                                <th className="py-4 px-4 bg-amber-50/50 text-amber-950">Adult Deposit (£)</th>
                                <th className="py-4 px-4 bg-purple-50/50 text-purple-950 border-l border-purple-200">Kids Rental (£)</th>
                                <th className="py-4 px-4 bg-purple-50/50 text-purple-950">Kids Deposit (£)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold">
                              {pricingMatrix.map(setting => (
                                <tr key={setting.category} className="hover:bg-slate-50 transition">
                                  <td className="py-3 px-4 font-bold text-slate-900">{setting.category}</td>
                                  
                                  {/* Adult Rates */}
                                  <td className="py-3 px-4 bg-amber-50/20 border-l border-amber-200">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">£</span>
                                      <input 
                                        type="number"
                                        min={0}
                                        value={setting.adultHireRate}
                                        onChange={e => handleUpdatePriceSetting(setting.category, 'adultHireRate', Number(e.target.value))}
                                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 bg-amber-50/20">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">£</span>
                                      <input 
                                        type="number"
                                        min={0}
                                        value={setting.adultDeposit}
                                        onChange={e => handleUpdatePriceSetting(setting.category, 'adultDeposit', Number(e.target.value))}
                                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-emerald-800 outline-none focus:border-amber-500 shadow-sm"
                                      />
                                    </div>
                                  </td>

                                  {/* Kids Rates */}
                                  <td className="py-3 px-4 bg-purple-50/20 border-l border-purple-200">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">£</span>
                                      <input 
                                        type="number"
                                        min={0}
                                        value={setting.kidHireRate}
                                        onChange={e => handleUpdatePriceSetting(setting.category, 'kidHireRate', Number(e.target.value))}
                                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-purple-900 outline-none focus:border-purple-500 shadow-sm"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 bg-purple-50/20">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">£</span>
                                      <input 
                                        type="number"
                                        min={0}
                                        value={setting.kidDeposit}
                                        onChange={e => handleUpdatePriceSetting(setting.category, 'kidDeposit', Number(e.target.value))}
                                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-emerald-800 outline-none focus:border-purple-500 shadow-sm"
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 1: SCANNER */}
              {activeTab === 'scanner' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <QrCode className="w-5 h-5 text-amber-600" />
                          <h2 className="text-base font-bold text-slate-900">Scan Item QR Code</h2>
                        </div>
                        <button
                          onClick={toggleCamera}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                            activeCamera 
                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {activeCamera ? 'Stop Camera' : 'Use Camera'}
                        </button>
                      </div>

                      {activeCamera ? (
                        <div className="relative rounded-xl overflow-hidden bg-black border-2 border-amber-500 aspect-video flex items-center justify-center">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute inset-0 border-2 border-dashed border-amber-400/70 m-8 rounded-lg pointer-events-none flex items-center justify-center">
                            <span className="bg-black/70 px-3 py-1 rounded text-xs text-amber-300">Align QR Code Here</span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                            <QrCode className="w-6 h-6" />
                          </div>
                          <p className="text-xs text-slate-600 mb-2">Scan iron-on QR label on garment or pick a demo code below.</p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                          ⚡ Instant Demo Scan Picker:
                        </label>
                        
                        <div className="flex gap-2 mb-3">
                          <input 
                            type="text"
                            placeholder="Type or paste QR code (e.g. KILT-1001, KILT-KIDS-501)"
                            value={simulatedInput}
                            onChange={(e) => setSimulatedInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleScanCode(simulatedInput);
                              }
                            }}
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                          />
                          <button
                            onClick={() => handleScanCode(simulatedInput)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition"
                          >
                            Scan
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[11px] text-slate-500 self-center">Quick Scans:</span>
                          <button
                            onClick={() => handleScanCode('KILT-1001')}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-[11px] font-mono border border-blue-300 font-bold"
                          >
                            KILT-1001 (PO-9011)
                          </button>
                          <button
                            onClick={() => handleScanCode('KILT-KIDS-501')}
                            className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-[11px] font-mono border border-purple-300 font-bold"
                          >
                            KILT-KIDS-501 (Kids PO)
                          </button>
                          <button
                            onClick={() => handleScanCode('JKT-2002')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono border border-slate-200 font-semibold"
                          >
                            JKT-2002 (In Repair)
                          </button>
                          <button
                            onClick={() => handleScanCode('KILT-KID-8839')}
                            className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded text-[11px] font-mono border border-purple-300 font-bold"
                          >
                            KILT-KID-8839 (New Kids QR)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2 shadow-sm">
                      <h3 className="font-bold text-amber-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600" /> Kilt Shop Operational Flow:
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-[11px]">
                        <li><strong>Unregistered Scan:</strong> Launches registration form to add item to stock with Adult/Kid rate pre-fill.</li>
                        <li><strong>Available Stock Scan:</strong> Prompts to Hire Out (Add to PO), Send to Repair, Edit Specs, or Remove from Rotation.</li>
                        <li><strong>On Hire Scan:</strong> Opens full multi-item PO return checklist with missing item handling.</li>
                        <li><strong>In Repair Scan:</strong> Repair Workshop confirmation to fix & return to stock.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    {scannedCode ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md relative">
                        <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-amber-100 text-amber-900 font-mono font-extrabold text-sm rounded-md border border-amber-300">
                                {scannedCode}
                              </span>
                              {scItem && (
                                <span className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 ${scItem.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                                  {scItem.sizeGroup === 'Kid' ? <Baby className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                  {scItem.sizeGroup} Size
                                </span>
                              )}
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 mt-2">
                              {scItem ? scItem.name : 'Iron-on QR Label Detected'}
                            </h2>
                          </div>

                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                            <svg viewBox="0 0 21 21" className="w-14 h-14">
                              <path d={renderQrSvgPath(generateQrMatrix(scannedCode))} fill="#0f172a" />
                            </svg>
                          </div>
                        </div>

                        {!scItem && (
                          <div className="bg-amber-50/60 rounded-xl p-5 border border-amber-200 text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shadow-sm">
                              <PlusCircle className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-amber-900 mb-1">Item Not Registered Yet</h3>
                            <p className="text-xs text-amber-800 mb-4">
                              This iron-on QR label ({scannedCode}) is ready to be assigned to a new garment in your stock database.
                            </p>
                            <button
                              onClick={() => setShowRegisterModal(true)}
                              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center gap-2 mx-auto"
                            >
                              <PlusCircle className="w-4 h-4" /> Register Item into Database
                            </button>
                          </div>
                        )}

                        {scItem && scItem.status === 'AVAILABLE' && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                              <div>
                                <span className="text-slate-500 block">Category</span>
                                <span className="font-semibold text-slate-900">{scItem.category}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Demographic</span>
                                <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] inline-block ${scItem.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                                  {scItem.sizeGroup} Size
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Tartan / Colour</span>
                                <span className="font-semibold text-slate-900">{scItem.tartanOrColour}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Size</span>
                                <span className="font-semibold text-slate-900">{scItem.size}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Hire Rate</span>
                                <span className="font-bold text-amber-700">£{scItem.hireRate} / period</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Deposit Req.</span>
                                <span className="font-bold text-emerald-700">£{scItem.depositAmount}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500 block">Registered By</span>
                                <span className="font-semibold text-slate-700">{scItem.registeredByStaff || 'System'}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <button
                                onClick={() => setShowCreatePoModal(true)}
                                className="p-4 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-left transition shadow-sm group"
                              >
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="p-2 bg-emerald-600 text-white rounded-lg group-hover:scale-105 transition">
                                    <CreditCard className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-emerald-900 text-sm">Option A: Hire Out Item</h4>
                                    <p className="text-[11px] text-emerald-700">Add to Purchase Order & take deposit</p>
                                  </div>
                                </div>
                              </button>

                              <button
                                onClick={() => setShowSendRepairModal(true)}
                                className="p-4 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-xl text-left transition shadow-sm group"
                              >
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="p-2 bg-rose-600 text-white rounded-lg group-hover:scale-105 transition">
                                    <Wrench className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-rose-900 text-sm">Option B: Send to Repair</h4>
                                    <p className="text-[11px] text-rose-700">Remove from stock & log damage reason</p>
                                  </div>
                                </div>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => setShowEditItemModal(scItem)}
                                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5"
                              >
                                <Edit3 className="w-4 h-4 text-amber-600" /> Edit Item Description
                              </button>

                              <button
                                onClick={() => setShowRemoveRotationModal(scItem)}
                                className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4 text-rose-600" /> Remove from Rotation
                              </button>
                            </div>
                          </div>
                        )}

                        {scItem && scItem.status === 'ON_HIRE' && (
                          <div className="space-y-4">
                            {(() => {
                              const po = pos.find(p => p.id === scItem.currentPoId);
                              return (
                                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-5 space-y-4">
                                  <h3 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                                    <PackageCheck className="w-5 h-5 text-blue-600" /> Item is Currently On Hire (Linked to PO {po?.id})
                                  </h3>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                    <div><span className="text-slate-500">PO Ref:</span> <span className="font-mono font-bold text-blue-700">{po?.id}</span></div>
                                    <div><span className="text-slate-500">Customer:</span> <strong>{po?.customerName}</strong></div>
                                    <div><span className="text-slate-500">Total Outfit Items:</span> <strong>{po?.items.length} Items</strong></div>
                                    <div><span className="text-slate-500">Total Deposit Held:</span> <strong className="text-emerald-700">£{po?.totalDepositHeld}</strong></div>
                                  </div>

                                  <button
                                    onClick={() => po && openPoReturnChecklist(po, scItem.id)}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                                  >
                                    <RotateCcw className="w-4 h-4" /> Open Full Multi-Item PO Return Checklist
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {scItem && scItem.status === 'IN_REPAIR' && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                              <Wrench className="w-5 h-5 text-rose-600" /> Item Currently In Repair Workshop
                            </div>
                            
                            {scItem.repairHistory && scItem.repairHistory.length > 0 && (
                              <div className="bg-white p-3 rounded-lg text-xs space-y-1 border border-rose-100 shadow-sm text-slate-700">
                                <p><span className="text-slate-500">Issue Reported:</span> <strong>{scItem.repairHistory[0].reason}</strong></p>
                                <p><span className="text-slate-500">Severity:</span> <span className="text-rose-700 font-bold">{scItem.repairHistory[0].severity}</span></p>
                                <p><span className="text-slate-500">Sent By Staff:</span> {scItem.repairHistory[0].sentByStaff} ({scItem.repairHistory[0].dateSent})</p>
                              </div>
                            )}

                            <button
                              onClick={() => handleConfirmRepairFixed(scItem.id)}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Confirm Repair Completed & Return to Stock
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
                        <QrCode className="w-12 h-12 mb-3 text-slate-300" />
                        <h3 className="text-base font-bold text-slate-700 mb-1">No QR Code Scanned Yet</h3>
                        <p className="text-xs max-w-sm text-slate-500">Use the camera or select a demo QR code on the left to trigger the automated inventory matrix.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: BATCH QR */}
              {activeTab === 'batches' && (
                <div className="space-y-6">
                  {!isMasterAdmin ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-2xl mx-auto space-y-4">
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 mx-auto">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Master Admin Access Required</h3>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                        Batch QR Code Generation & Printing is restricted exclusively to Allan (Master Admin).
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Printer className="w-5 h-5 text-amber-600" /> Batch QR Code Generator & Iron-On Printing
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Generate batches of 1 to 100 QR codes for Kilts, Jackets, Sporrans or Accessories. Print directly on iron-on fabric sheets.
                          </p>
                        </div>

                        <button
                          onClick={() => setShowBatchModal(true)}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition"
                        >
                          <PlusCircle className="w-4 h-4" /> Generate New QR Batch (Up to 100)
                        </button>
                      </div>

                      <div className="no-print grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {batches.map(batch => (
                          <div key={batch.id} className={`bg-white border rounded-2xl p-5 shadow-sm transition ${
                            batch.isPrinted ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200 hover:border-amber-400'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
                                    {batch.category}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${batch.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                    {batch.sizeGroup}s
                                  </span>
                                  {batch.isPrinted ? (
                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full flex items-center gap-1">
                                      <Lock className="w-3 h-3 text-emerald-700" /> PRINTED - LOCKED
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                                      UNPRINTED SHEET
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mt-1">{batch.title}</h3>
                                <span className="text-xs text-slate-500 font-mono">{batch.id}</span>
                              </div>
                              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                                {batch.count} Codes
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 space-y-0.5 mb-4">
                              <p>Created by <strong>{batch.createdByName}</strong> on {batch.createdAt}</p>
                              {batch.isPrinted && (
                                <p className="text-emerald-800 font-bold">
                                  🖨️ Initial Sheet Printed by {batch.printedBy} ({batch.printedAt})
                                </p>
                              )}
                              {batch.reprintHistory && batch.reprintHistory.length > 0 && (
                                <p className="text-amber-800 font-semibold text-[11px]">
                                  🔑 {batch.reprintHistory.length} Replacement Tag Reprint(s) Authorized
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2 border-t border-slate-100 pt-3">
                              <button
                                onClick={() => {
                                  setSelectedBatchForPrint(batch);
                                  setSelectedCodesForReprint([]);
                                  setReprintPrintMode(false);
                                }}
                                className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 transition"
                              >
                                <Printer className="w-3.5 h-3.5 text-amber-600" /> Manage Batch & Print/Reprint Tags
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* BATCH PRINT PREVIEW & REPRINT MANAGER MODAL */}
                      {selectedBatchForPrint && (
                        <div className="print-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                          <div className="print-modal-content bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 space-y-5 my-6 shadow-2xl">
                            
                            {/* NON-PRINTABLE MODAL CONTROLS & BANNERS */}
                            <div className="no-print space-y-5">
                              {/* MODAL HEADER */}
                              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-amber-100 text-amber-900 font-mono font-extrabold text-xs rounded-lg border border-amber-300">
                                      {selectedBatchForPrint.id}
                                    </span>
                                    {selectedBatchForPrint.isPrinted ? (
                                      <span className="px-2.5 py-0.5 text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full flex items-center gap-1">
                                        <Lock className="w-3.5 h-3.5 text-emerald-700" /> Sheet Printed on {selectedBatchForPrint.printedAt}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                                        Unprinted Initial Sheet
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                                    {selectedBatchForPrint.title} ({selectedBatchForPrint.count} {selectedBatchForPrint.sizeGroup} {selectedBatchForPrint.category} Tags)
                                  </h3>
                                </div>

                                <div className="flex items-center gap-2">
                                  {reprintPrintMode && (
                                    <button
                                      onClick={() => setReprintPrintMode(false)}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
                                    >
                                      View Full Sheet
                                    </button>
                                  )}

                                  <button 
                                    onClick={() => {
                                      setSelectedBatchForPrint(null);
                                      setSelectedCodesForReprint([]);
                                      setReprintPrintMode(false);
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                                  >
                                    <X className="w-6 h-6" />
                                  </button>
                                </div>
                              </div>

                              {/* SAFEGUARD BANNERS */}
                              {!selectedBatchForPrint.isPrinted ? (
                                <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-amber-950">
                                  <div className="space-y-0.5 max-w-xl">
                                    <span className="font-extrabold text-xs flex items-center gap-1.5 text-amber-900">
                                      <ShieldCheck className="w-4 h-4 text-amber-600" /> Initial One-Time Sheet Printing Safeguard
                                    </span>
                                    <p className="text-xs text-amber-900">
                                      Clicking print will authorize the 1st printing of this entire batch sheet. After printing, the full sheet will be <strong>LOCKED</strong> against duplicate full-prints.
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleInitialBatchPrint(selectedBatchForPrint)}
                                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                                  >
                                    <Printer className="w-4 h-4" /> Authorize & Print Initial Sheet
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-emerald-950">
                                  <div className="space-y-0.5">
                                    <span className="font-extrabold text-xs flex items-center gap-1.5 text-emerald-900">
                                      <Lock className="w-4 h-4 text-emerald-600" /> One-Time Print Safeguard Active: Full Sheet Locked
                                    </span>
                                    <p className="text-xs text-emerald-800">
                                      Initial sheet printed on {selectedBatchForPrint.printedAt} by {selectedBatchForPrint.printedBy}. Full sheet duplicate printing is locked. Select specific replacement tag numbers below for Admin PIN authorized reprints.
                                    </p>
                                  </div>

                                  <span className="px-3 py-1.5 bg-slate-200 text-slate-600 font-extrabold text-xs rounded-xl flex items-center gap-1 border border-slate-300 cursor-not-allowed">
                                    <Lock className="w-3.5 h-3.5" /> Full Sheet Locked
                                  </span>
                                </div>
                              )}

                              {/* REPLACEMENT TAG REPRINT SELECTOR SECTION (ADMIN PIN PROTECTED) */}
                              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                  <div>
                                    <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                      <Key className="w-4 h-4 text-amber-600" /> Request Replacement Tag Reprint (Master Admin PIN Required)
                                    </span>
                                    <p className="text-[11px] text-slate-500">
                                      If a tag on a garment is damaged or torn (e.g. KILT-1005), select 1 or more specific tag numbers below to reprint replacements.
                                    </p>
                                  </div>

                                  {selectedCodesForReprint.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCodesForReprint([])}
                                      className="text-[11px] text-rose-600 hover:underline font-bold"
                                    >
                                      Clear Selection ({selectedCodesForReprint.length})
                                    </button>
                                  )}
                                </div>

                                {/* TAG SELECTOR GRID */}
                                <div className="space-y-2">
                                  <span className="text-[11px] font-extrabold text-slate-700 block">Select Code(s) for Reprint:</span>
                                  <div className="max-h-36 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                    {selectedBatchForPrint.qrCodes.map(code => {
                                      const isChecked = selectedCodesForReprint.includes(code);
                                      return (
                                        <label
                                          key={code}
                                          className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition text-xs font-mono font-bold ${
                                            isChecked ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'hover:bg-slate-50 text-slate-800'
                                          }`}
                                        >
                                          <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={e => {
                                              if (e.target.checked) {
                                                setSelectedCodesForReprint(prev => [...prev, code]);
                                              } else {
                                                setSelectedCodesForReprint(prev => prev.filter(c => c !== code));
                                              }
                                            }}
                                          />
                                          <span>{code}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* REPRINT ACTION BAR */}
                                {selectedCodesForReprint.length > 0 && (
                                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 bg-amber-100/70 p-3 rounded-xl border border-amber-300">
                                    <div>
                                      <span className="font-extrabold text-xs text-amber-950 block">
                                        Selected {selectedCodesForReprint.length} Replacement Tag(s): [{selectedCodesForReprint.join(', ')}]
                                      </span>
                                      <span className="text-[10px] text-amber-900">Requires Master Admin PIN verification before printing.</span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setShowReprintPinModal(true)}
                                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                                    >
                                      <Key className="w-4 h-4" /> Authorize & Reprint Selected Tags ({selectedCodesForReprint.length})
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* REPRINT HISTORY AUDIT LOG */}
                              {selectedBatchForPrint.reprintHistory && selectedBatchForPrint.reprintHistory.length > 0 && (
                                <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-2xl text-xs space-y-1">
                                  <span className="font-extrabold text-amber-900 block">📜 Audit Log of Authorized Tag Reprints:</span>
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {selectedBatchForPrint.reprintHistory.map(log => (
                                      <div key={log.id} className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-amber-200">
                                        <strong>{log.reprintedByStaff}</strong> authorized reprint of <strong>{log.reprintedCodes.length} tag(s)</strong> [{log.reprintedCodes.join(', ')}] on {log.reprintedAt}. Reason: <em>{log.reason}</em>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* PRINTABLE QR SHEET PREVIEW (EXACT A4 PAGE FORMAT: 4 ACROSS x 7 DOWN = 28 PER PAGE) */}
                            <div className="print-qr-container bg-slate-50 text-slate-950 p-6 rounded-2xl border border-slate-200 shadow-inner max-h-[50vh] overflow-y-auto print:max-h-none print:overflow-visible">
                              <div className="text-center mb-4 pb-2 border-b border-slate-300 no-print">
                                <h4 className="font-extrabold text-sm uppercase tracking-wide">
                                  Highland Kilt & Outfit Hire - {reprintPrintMode ? 'REPLACEMENT QR LABELS REPRINT' : 'QR Iron-On Fabric Labels (A4 Sheet)'}
                                </h4>
                                <p className="text-[10px] text-slate-600">
                                  Batch: {selectedBatchForPrint.id} • Category: {selectedBatchForPrint.category} ({selectedBatchForPrint.sizeGroup}) • Layout: 4 Across × 7 Down (28 Labels per A4 Sheet)
                                  {reprintPrintMode && <strong className="text-amber-900 block mt-0.5">⚠️ AUTHORIZED REPLACEMENT REPRINT FOR SPECIFIC TAGS: [{selectedCodesForReprint.join(', ')}]</strong>}
                                </p>
                              </div>

                              <div className="qr-label-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-4">
                                {(reprintPrintMode ? selectedBatchForPrint.qrCodes.filter(c => selectedCodesForReprint.includes(c)) : selectedBatchForPrint.qrCodes).map((code, index) => {
                                  const matrix = generateQrMatrix(code);
                                  const isReg = items.some(i => i.id === code && i.status !== 'RETIRED');
                                  const isReprinted = reprintPrintMode || selectedCodesForReprint.includes(code);
                                  const isPageBreak = (index + 1) % 28 === 0;

                                  return (
                                    <div 
                                      key={code} 
                                      className={`qr-label-card border-2 border-dashed p-2.5 rounded flex flex-col items-center justify-between text-center bg-white min-h-[140px] shadow-sm ${
                                        isReprinted ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300'
                                      } ${isPageBreak ? 'page-break-after-28' : ''}`}
                                    >
                                      <span className="text-[9px] font-bold text-slate-800 uppercase tracking-tight line-clamp-1">
                                        {selectedBatchForPrint.category} ({selectedBatchForPrint.sizeGroup})
                                      </span>
                                      
                                      <svg viewBox="0 0 21 21" className="w-14 h-14 my-0.5">
                                        <path d={renderQrSvgPath(matrix)} fill="#000000" />
                                      </svg>

                                      <span className="font-mono font-extrabold text-xs text-black">
                                        {code}
                                      </span>
                                      <span className="text-[8px] font-semibold text-slate-500">
                                        {isReg ? 'REGISTERED' : 'UNREGISTERED'} {isReprinted && '• REPRINT'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* MASTER ADMIN PIN VERIFICATION MODAL FOR TAG REPRINTS */}
                      {showReprintPinModal && selectedBatchForPrint && (
                        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                                <Key className="w-5 h-5 text-amber-600" /> Master Admin Password / PIN Required
                              </div>
                              <button onClick={() => setShowReprintPinModal(false)} className="text-slate-400 hover:text-slate-700">
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <form onSubmit={handleConfirmAdminReprintSubmit} className="space-y-4 text-xs">
                              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900">
                                <strong>Security Check:</strong> Authorizing reprint of <strong>{selectedCodesForReprint.length} replacement tag(s)</strong>: [{selectedCodesForReprint.join(', ')}]. Enter Master Admin Allan's PIN to proceed.
                              </div>

                              <div>
                                <label className="block text-slate-700 font-extrabold mb-1">Enter Master Admin PIN Password:</label>
                                <input 
                                  type="password"
                                  autoFocus
                                  required
                                  placeholder="Enter Master Admin PIN (e.g. 1234)..."
                                  value={reprintPinInput}
                                  onChange={e => setReprintPinInput(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold text-center text-lg outline-none focus:border-amber-500 shadow-sm"
                                />
                                <span className="text-[10px] text-slate-400 text-center block mt-1">Default Demo Admin PIN: <strong>1234</strong></span>
                              </div>

                              <div>
                                <label className="block text-slate-700 font-bold mb-1">Reason for Tag Replacement Reprint:</label>
                                <input 
                                  type="text"
                                  placeholder="e.g. Tag damaged during dry cleaning on KILT-1005"
                                  value={reprintReason}
                                  onChange={e => setReprintReason(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                                />
                              </div>

                              <div className="flex gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setShowReprintPinModal(false)}
                                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1"
                                >
                                  <Key className="w-4 h-4" /> Verify PIN & Print Tags
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: INVENTORY WITH DEDICATED MASTER ADMIN RETIRED STOCK ARCHIVE */}
              {activeTab === 'inventory' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-amber-600" /> Stock Inventory Database
                      </h2>

                      {/* SUB TAB: ACTIVE vs ARCHIVE (ADMIN RESTRICTED ARCHIVE) */}
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                        <button
                          onClick={() => setInventorySubTab('ACTIVE')}
                          className={`px-3 py-1 rounded-lg transition ${inventorySubTab === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                          Active Stock ({items.filter(i=>i.status!=='RETIRED').length})
                        </button>
                        <button
                          onClick={() => setInventorySubTab('ARCHIVE')}
                          className={`px-3 py-1 rounded-lg flex items-center gap-1 transition ${inventorySubTab === 'ARCHIVE' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          <Archive className="w-3.5 h-3.5 text-amber-950" /> Retired Stock Archive ({retiredItems.length})
                          <Lock className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>

                    {inventorySubTab === 'ACTIVE' && (
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                        <button
                          onClick={() => setInventorySizeFilter('ALL')}
                          className={`px-3 py-1.5 rounded-lg transition ${inventorySizeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                          All Sizes ({items.filter(i=>i.status!=='RETIRED').length})
                        </button>
                        <button
                          onClick={() => setInventorySizeFilter('Adult')}
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${inventorySizeFilter === 'Adult' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'}`}
                        >
                          <User className="w-3.5 h-3.5" /> Adults ({items.filter(i=>i.sizeGroup==='Adult' && i.status!=='RETIRED').length})
                        </button>
                        <button
                          onClick={() => setInventorySizeFilter('Kid')}
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${inventorySizeFilter === 'Kid' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600'}`}
                        >
                          <Baby className="w-3.5 h-3.5" /> Kids ({items.filter(i=>i.sizeGroup==='Kid' && i.status!=='RETIRED').length})
                        </button>
                      </div>
                    )}
                  </div>

                  {inventorySubTab === 'ACTIVE' ? (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="py-3.5 px-4">QR Code</th>
                              <th className="py-3.5 px-4">Item Name</th>
                              <th className="py-3.5 px-4">Category</th>
                              <th className="py-3.5 px-4">Demographic</th>
                              <th className="py-3.5 px-4">Tartan / Colour</th>
                              <th className="py-3.5 px-4">Size</th>
                              <th className="py-3.5 px-4">Rate / Deposit</th>
                              <th className="py-3.5 px-4">Status</th>
                              <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items
                              .filter(item => item.status !== 'RETIRED' && (inventorySizeFilter === 'ALL' || item.sizeGroup === inventorySizeFilter))
                              .map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 transition">
                                <td className="py-3 px-4 font-mono font-bold text-amber-700">{item.id}</td>
                                <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                                <td className="py-3 px-4">{item.category}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 w-fit ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                                    {item.sizeGroup === 'Kid' ? <Baby className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                    {item.sizeGroup}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600">{item.tartanOrColour}</td>
                                <td className="py-3 px-4 text-slate-600">{item.size}</td>
                                <td className="py-3 px-4">
                                  <span className="text-amber-800 font-bold">£{item.hireRate}</span> / <span className="text-emerald-700 font-semibold">£{item.depositAmount} dep</span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                                    item.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                    item.status === 'ON_HIRE' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                    'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setShowEditItemModal(item)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 transition"
                                      title="Edit Specs"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                    </button>
                                    <button
                                      onClick={() => setShowRemoveRotationModal(item)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition"
                                      title="Remove from Rotation"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* DEDICATED MASTER ADMIN RETIRED STOCK ARCHIVE */
                    <div className="space-y-4">
                      {!isMasterAdmin ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-2xl mx-auto space-y-4">
                          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 mx-auto">
                            <Lock className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-900">Master Admin Access Required</h3>
                          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                            The Retired & Removed Stock Archive is restricted exclusively to Allan (Master Admin).
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <Archive className="w-5 h-5 text-amber-600" /> Master Admin Retired & Removed Stock Archive ({retiredItems.length} Archived)
                              </h3>
                              <p className="text-xs text-slate-500">
                                Vault for garments completely removed from stock rotation (sold off, stolen, destroyed, or written off).
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-lg">
                              🔒 Master Admin Vault Only
                            </span>
                          </div>

                          {retiredItems.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs">
                              No items currently in retired archive.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {retiredItems.map(item => (
                                <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-extrabold text-slate-800 text-xs bg-white px-2 py-0.5 rounded border border-slate-300">
                                        {item.id}
                                      </span>
                                      <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                                      <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 rounded">
                                        RETIRED FROM STOCK
                                      </span>
                                    </div>

                                    <p className="text-xs text-slate-600">
                                      <strong>Category:</strong> {item.category} ({item.sizeGroup} • {item.size}) | <strong>Tartan:</strong> {item.tartanOrColour}
                                    </p>

                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 mt-2 space-y-0.5">
                                      <p><span className="text-slate-500">Removal Reason & Audit Notes:</span> <strong className="text-rose-900">{item.retiredReason}</strong></p>
                                      <p><span className="text-slate-500">Removed By:</span> {item.retiredByStaff} on {item.retiredAt}</p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleRestoreRetiredItem(item)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                                  >
                                    <RestoreIcon className="w-3.5 h-3.5" /> Restore Back to Active Stock
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: POs & PAYPAL WITH FULL RIGOUT PRICE CAP BREAKDOWN */}
              {activeTab === 'pos' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-600" /> Hire Purchase Orders & PayPal Deposit Ledger
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Track active customer hires, PayPal deposits held, returned clean items, and Full Rigout price caps.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowCreatePoModal(true)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition"
                    >
                      <PlusCircle className="w-4 h-4" /> Create New Hire PO
                    </button>
                  </div>

                  <div className="space-y-4">
                    {pos.map(po => {
                      const returnedCount = po.items.filter(i => i.returned).length;
                      const totalCount = po.items.length;
                      const isComplete = returnedCount === totalCount;

                      return (
                        <div key={po.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-amber-700 text-base">{po.id}</span>
                                <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full">
                                  {po.paymentStatus}
                                </span>
                                {po.fullRigoutCapApplied && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                                    ✨ Full Rigout Price Cap Applied (-£{po.fullRigoutDiscount})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 mt-1">
                                <strong>Customer:</strong> {po.customerName} ({po.customerPhone} • {po.customerEmail})
                              </p>
                            </div>

                            <div className="text-right text-xs flex items-center gap-3">
                              <button
                                onClick={() => openPoReturnChecklist(po)}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Process PO Batch Return
                              </button>

                              <button
                                onClick={() => {
                                  setShowEditPoModal(po);
                                  setEditPoNotes(po.notes || '');
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit PO Notes
                              </button>

                              <div>
                                <span className="text-slate-500 block">Hire Period: {po.hireStartDate} to {po.hireEndDate}</span>
                                <span className="text-slate-900 font-mono font-bold text-sm">
                                  {po.fullRigoutCapApplied && <span className="line-through text-slate-400 mr-1.5">£{po.itemizedSubtotal}</span>}
                                  Final Hire: <span className="text-amber-700">£{po.totalHireFee}</span> | Deposit: <span className="text-emerald-700">£{po.totalDepositHeld}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* AUTOMATED RETURN PROGRESS BAR */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600">
                              <span>Automated Return Progress:</span>
                              <span>{returnedCount} of {totalCount} Garments Returned</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                style={{ width: `${(returnedCount / totalCount) * 100}%` }}
                              />
                            </div>
                          </div>

                          {po.notes && (
                            <div className="text-xs bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                              <strong>Staff Notes:</strong> {po.notes}
                            </div>
                          )}

                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Hired Garments & Real-Time Scan Status:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {po.items.map(item => (
                                <div key={item.qrCodeId} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs shadow-sm ${
                                  item.returned ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-slate-200'
                                }`}>
                                  <div>
                                    <span className="font-mono font-bold text-amber-800 mr-2">{item.qrCodeId}</span>
                                    <span className="text-slate-900 font-semibold">{item.itemName}</span>
                                    <span className={`ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                      {item.sizeGroup}
                                    </span>
                                  </div>
                                  <div>
                                    {item.returned ? (
                                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                        item.returnCondition === 'GOOD_CLEAN' 
                                          ? 'bg-emerald-100 text-emerald-800' 
                                          : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {item.returnCondition === 'GOOD_CLEAN' ? 'Returned (Deposit Refunded)' : 'Damaged (Deposit Held)'}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => openPoReturnChecklist(po, item.qrCodeId)}
                                        className="px-2 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded text-[11px] font-bold border border-blue-300 transition"
                                      >
                                        Scan Return
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: REPAIRS */}
              {activeTab === 'repairs' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-rose-800 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-rose-600" /> Repair & Maintenance Workshop Queue
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Items currently removed from stock awaiting repair, seamstress work, or dry cleaning.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.filter(i => i.status === 'IN_REPAIR').map(item => {
                      const latestRep = item.repairHistory?.[0];
                      return (
                        <div key={item.id} className="bg-white border border-rose-200 rounded-2xl p-5 shadow-sm space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-extrabold text-amber-800 text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {item.id}
                                </span>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                  {item.sizeGroup}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900 mt-1">{item.name}</h3>
                              <p className="text-xs text-slate-500">{item.tartanOrColour} ({item.size})</p>
                            </div>
                            <span className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-300">
                              {latestRep?.severity || 'Medium'} Severity
                            </span>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                            <p><span className="text-slate-500">Defect Reason:</span> <strong>{latestRep?.reason || 'Requires repair'}</strong></p>
                            <p><span className="text-slate-500">Sent Date:</span> {latestRep?.dateSent}</p>
                            <p><span className="text-slate-500">Logged By:</span> {latestRep?.sentByStaff}</p>
                          </div>

                          <button
                            onClick={() => handleConfirmRepairFixed(item.id)}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Confirm Repair Complete & Return to Stock
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 6: MASTER ADMIN, INVITES & RIGOUT CAP CONFIG */}
              {activeTab === 'admin' && (
                <div className="space-y-6">
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block">Total Active Stock</span>
                      <span className="text-2xl font-extrabold text-amber-700">{items.filter(i=>i.status!=='RETIRED').length} Garments</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block">Currently On Hire</span>
                      <span className="text-2xl font-extrabold text-blue-700">{items.filter(i=>i.status==='ON_HIRE').length} Garments</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block">Active Staff Accounts</span>
                      <span className="text-2xl font-extrabold text-slate-900">{staffList.length} Users</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block">Pending Staff Invites</span>
                      <span className="text-2xl font-extrabold text-amber-700">{invites.filter(i=>i.status==='PENDING').length} Invites</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-amber-600" /> Staff Invitations & Access Control
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Send invitation codes from your Admin Back Office to email links so authorized staff can register.
                        </p>
                      </div>

                      {isMasterAdmin && (
                        <button
                          onClick={() => setShowInviteModal(true)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition"
                        >
                          <Send className="w-3.5 h-3.5" /> Send Staff Email Invite
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Invite Code</th>
                            <th className="py-3 px-4">Recipient Email</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Created By</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invites.map(inv => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-4 font-mono font-bold text-amber-800">{inv.code}</td>
                              <td className="py-3 px-4 font-semibold text-slate-900">{inv.email}</td>
                              <td className="py-3 px-4 text-slate-600">{inv.role}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                  inv.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                  inv.status === 'REGISTERED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500">{inv.createdByName}</td>
                              <td className="py-3 px-4 text-right">
                                {inv.status === 'PENDING' && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(inv.code);
                                      setCopiedInviteCode(inv.code);
                                      setTimeout(() => setCopiedInviteCode(null), 2000);
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] border border-slate-200 flex items-center gap-1 ml-auto transition"
                                  >
                                    {copiedInviteCode === inv.code ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
                                    {copiedInviteCode === inv.code ? 'Copied Code' : 'Copy Code'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-amber-600" /> Active Staff Accounts ({staffList.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {staffList.map(st => (
                        <div key={st.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{st.name}</span>
                            <span className="text-slate-500">{st.email}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            st.role === 'Master Admin' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {st.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-600" /> Staff Action Audit Log
                    </h3>

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {logs.map(log => (
                        <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-amber-800">{log.staffName}</span>
                            <span className="text-slate-400 mx-2">•</span>
                            <span className="font-bold text-slate-900">{log.action}</span>
                            <p className="text-slate-600 mt-0.5">{log.details}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* EDIT ITEM DETAILS MODAL */}
      {showEditItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" /> Edit Item Specs ({showEditItemModal.id})
              </h3>
              <button onClick={() => setShowEditItemModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditItemSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Item Title / Name</label>
                <input 
                  type="text" 
                  required
                  value={showEditItemModal.name}
                  onChange={e => setShowEditItemModal({...showEditItemModal, name: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category</label>
                  <select 
                    value={showEditItemModal.category}
                    onChange={e => setShowEditItemModal({...showEditItemModal, category: e.target.value as ItemCategory})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Demographic Sizing</label>
                  <select 
                    value={showEditItemModal.sizeGroup}
                    onChange={e => setShowEditItemModal({...showEditItemModal, sizeGroup: e.target.value as SizeGroup})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold text-amber-900 outline-none focus:border-amber-500 shadow-sm"
                  >
                    <option value="Adult">Adult Sizing</option>
                    <option value="Kid">Kids Sizing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tartan / Colour</label>
                  <input 
                    type="text" 
                    required
                    value={showEditItemModal.tartanOrColour}
                    onChange={e => setShowEditItemModal({...showEditItemModal, tartanOrColour: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Size Specs</label>
                  <input 
                    type="text" 
                    required
                    value={showEditItemModal.size}
                    onChange={e => setShowEditItemModal({...showEditItemModal, size: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Rental Rate (£)</label>
                  <input 
                    type="number" 
                    required
                    value={showEditItemModal.hireRate}
                    onChange={e => setShowEditItemModal({...showEditItemModal, hireRate: Number(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Deposit Amount (£)</label>
                  <input 
                    type="number" 
                    required
                    value={showEditItemModal.depositAmount}
                    onChange={e => setShowEditItemModal({...showEditItemModal, depositAmount: Number(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold text-emerald-800 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Condition Notes</label>
                <textarea 
                  rows={2}
                  value={showEditItemModal.conditionNotes || ''}
                  onChange={e => setShowEditItemModal({...showEditItemModal, conditionNotes: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition"
              >
                Save Updated Item Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE FROM ROTATION (DESTROYED / STOLEN / SOLD) MODAL */}
      {showRemoveRotationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-rose-800 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" /> Remove Item From Rotation ({showRemoveRotationModal.id})
              </h3>
              <button onClick={() => setShowRemoveRotationModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRemoveFromRotation} className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 font-semibold space-y-1">
                <p>Removing <strong>{showRemoveRotationModal.name} ({showRemoveRotationModal.id})</strong> completely from active hire stock rotation.</p>
                <p className="text-[11px] text-rose-700 font-bold">🔒 This item will be moved to the Master Admin Retired Archive vault.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason for Removal</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRetireReasonCategory('SOLD')}
                    className={`p-2.5 rounded-xl border font-bold text-left transition ${
                      retireReasonCategory === 'SOLD'
                        ? 'bg-amber-100 border-amber-400 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    🏷️ Sold Off (Ex-Hire)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRetireReasonCategory('STOLEN')}
                    className={`p-2.5 rounded-xl border font-bold text-left transition ${
                      retireReasonCategory === 'STOLEN'
                        ? 'bg-rose-100 border-rose-400 text-rose-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    🔒 Stolen / Missing
                  </button>

                  <button
                    type="button"
                    onClick={() => setRetireReasonCategory('DESTROYED')}
                    className={`p-2.5 rounded-xl border font-bold text-left transition ${
                      retireReasonCategory === 'DESTROYED'
                        ? 'bg-rose-100 border-rose-400 text-rose-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    💥 Destroyed / Damaged
                  </button>

                  <button
                    type="button"
                    onClick={() => setRetireReasonCategory('WRITTEN_OFF')}
                    className={`p-2.5 rounded-xl border font-bold text-left transition ${
                      retireReasonCategory === 'WRITTEN_OFF'
                        ? 'bg-slate-200 border-slate-400 text-slate-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    🗑️ Written Off
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Staff Explanation & Audit Notes</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="e.g. Sold to customer Gordon MacLeod after hire, or destroyed in workshop fire..."
                  value={retireNotes}
                  onChange={e => setRetireNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 outline-none focus:border-rose-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Confirm Move to Admin Retired Archive
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PO DETAILS MODAL */}
      {showEditPoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" /> Edit Purchase Order ({showEditPoModal.id})
              </h3>
              <button onClick={() => setShowEditPoModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditPoSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p><span className="text-slate-500">Customer:</span> <strong>{showEditPoModal.customerName}</strong></p>
                <p><span className="text-slate-500">Event Date:</span> {showEditPoModal.eventDate}</p>
                <p><span className="text-slate-500">Garment Items:</span> {showEditPoModal.items.map(i => i.qrCodeId).join(', ')}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Staff PO Notes & Special Instructions</label>
                <textarea 
                  rows={4}
                  placeholder="e.g. Customer requested extra fitting check, customer collected in store..."
                  value={editPoNotes}
                  onChange={e => setEditPoNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition"
              >
                Save Purchase Order Notes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FULL MULTI-ITEM PO RETURN CHECKLIST MODAL WITH MISSING ITEM HANDLING */}
      {/* ========================================================================= */}
      {activeReturnPo && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 space-y-6 my-6 shadow-2xl">
            
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-900 font-mono font-extrabold text-sm rounded-lg border border-blue-300">
                    {activeReturnPo.id}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                    Customer PO Batch Return Checklist
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                  Customer: {activeReturnPo.customerName} ({activeReturnPo.customerPhone})
                </h3>
                <p className="text-xs text-slate-500">
                  Hire Start: {activeReturnPo.hireStartDate} | Event: {activeReturnPo.eventDate} | Return Deadline: {activeReturnPo.hireEndDate}
                </p>
              </div>

              <button 
                onClick={() => setActiveReturnPo(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleConfirmMultiItemReturnSubmit} className="space-y-6 text-xs">
              
              <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-sm text-amber-900">
                  <ShieldCheck className="w-5 h-5 text-amber-600" /> Mandatory Security Rule: Physical QR Scan Verification Required
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  To prevent counterfeit swaps or gear replacement, <strong>staff MUST physically scan each item's iron-on QR label</strong> with the scanner reader. Manual verification without scanning is disabled.
                </p>

                {/* MODAL QR SCANNER INPUT BAR */}
                <div className="pt-2">
                  <span className="text-xs font-extrabold text-slate-800 block mb-1">📷 Scan Next Garment QR in Returned Bag:</span>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Scan or type item QR code to verify (e.g. JKT-1002, SPO-1003)..."
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleScanCode((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                    />
                    <span className="text-[11px] font-bold text-slate-500 self-center">Press Enter or Aim Scanner</span>
                  </div>

                  {/* QUICK DEMO SCANNER BUTTONS */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] font-bold text-slate-500 self-center">Quick Demo QR Scans:</span>
                    {activeReturnPo.items.map(li => {
                      const isScanned = returnChecklist[li.qrCodeId]?.scanned;
                      return (
                        <button
                          key={li.qrCodeId}
                          type="button"
                          onClick={() => handleScanCode(li.qrCodeId)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-bold border transition ${
                            isScanned 
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isScanned ? '✓ ' : '🔍 Scan '}{li.qrCodeId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ITEM CHECKLIST TABLE */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-slate-100 font-bold text-slate-800 flex justify-between items-center text-xs uppercase tracking-wider">
                  <span>Hired Garment Line Items ({activeReturnPo.items.length} Total)</span>
                  <span className="text-slate-500">QR Scan Verification Status</span>
                </div>

                <div className="divide-y divide-slate-200">
                  {activeReturnPo.items.map(li => {
                    const currentSetting = returnChecklist[li.qrCodeId] || { condition: 'MISSING', scanned: false, notes: '' };
                    const isScanned = currentSetting.scanned;
                    const isMissing = currentSetting.condition === 'MISSING' || !isScanned;
                    const isRepair = currentSetting.condition === 'NEEDS_REPAIR';

                    return (
                      <div key={li.qrCodeId} className={`p-4 transition ${
                        !isScanned ? 'bg-amber-50/60 border-l-4 border-amber-400' :
                        isRepair ? 'bg-rose-50/80 border-l-4 border-rose-500' :
                        'bg-white border-l-4 border-emerald-500'
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-slate-900 text-sm">{li.qrCodeId}</span>
                              <span className="font-bold text-slate-900">{li.itemName}</span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${li.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                {li.sizeGroup} ({li.size})
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Rental: £{li.hireRate} | Security Deposit Held: <strong className="text-emerald-700">£{li.depositAmount}</strong>
                            </span>
                          </div>

                          {/* SCAN VERIFICATION BADGE & CONTROLS */}
                          <div>
                            {!isScanned ? (
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-amber-100 text-amber-900 font-extrabold text-xs rounded-xl border border-amber-300 flex items-center gap-1">
                                  <Search className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Awaiting QR Scan (Deposit Held £{li.depositAmount})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleScanCode(li.qrCodeId)}
                                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
                                >
                                  Simulate Scan {li.qrCodeId}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-xs rounded-xl border border-emerald-300 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Authentic QR Scanned & Verified
                                </span>

                                {/* OPTIONAL CONDITION SWITCHER FOR SCANNED ITEM */}
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => setReturnChecklist(prev => ({
                                      ...prev,
                                      [li.qrCodeId]: { ...currentSetting, condition: 'GOOD_CLEAN' }
                                    }))}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                      currentSetting.condition === 'GOOD_CLEAN' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                  >
                                    Clean
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setReturnChecklist(prev => ({
                                      ...prev,
                                      [li.qrCodeId]: { ...currentSetting, condition: 'NEEDS_REPAIR' }
                                    }))}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                      currentSetting.condition === 'NEEDS_REPAIR' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                  >
                                    Damaged
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* EXPLANATION BADGE IF NOT SCANNED OR DAMAGED */}
                        {!isScanned && (
                          <div className="mt-2 text-[11px] font-semibold text-amber-900 bg-amber-100/70 p-2 rounded-lg border border-amber-200">
                            🔒 Un-scanned Garment: Deposit of <strong>£{li.depositAmount}</strong> will be retained until this item's iron-on QR label is physically scanned in store.
                          </div>
                        )}
                        {isScanned && isRepair && (
                          <div className="mt-2 text-[11px] font-bold text-rose-900 bg-rose-100/80 p-2 rounded-lg border border-rose-300">
                            🔧 Damaged Garment: Scanned & verified, item sent to repair workshop & deposit of <strong>£{li.depositAmount}</strong> held.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LIVE DEPOSIT CALCULATION BREAKDOWN */}
              {(() => {
                let cleanRefundSum = 0;
                let heldRepairSum = 0;
                let heldMissingSum = 0;

                activeReturnPo.items.forEach(li => {
                  const cond = returnChecklist[li.qrCodeId]?.condition || 'GOOD_CLEAN';
                  if (cond === 'GOOD_CLEAN') cleanRefundSum += li.depositAmount;
                  else if (cond === 'NEEDS_REPAIR') heldRepairSum += li.depositAmount;
                  else heldMissingSum += li.depositAmount;
                });

                const totalHeld = activeReturnPo.totalDepositHeld;
                const totalRetained = heldRepairSum + heldMissingSum;

                return (
                  <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-lg">
                    <h4 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Live PayPal Deposit Refund Ledger Breakdown
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-t border-slate-800 pt-3">
                      <div>
                        <span className="text-slate-400 block">Total Deposit Held</span>
                        <span className="font-mono font-extrabold text-white text-base">£{totalHeld}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">Instant PayPal Refund</span>
                        <span className="font-mono font-extrabold text-emerald-400 text-base">£{cleanRefundSum}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">Retained (Missing / Damaged)</span>
                        <span className="font-mono font-extrabold text-amber-400 text-base">£{totalRetained}</span>
                      </div>
                    </div>

                    {totalRetained > 0 && (
                      <p className="text-[11px] text-amber-200 bg-amber-950/60 p-2.5 rounded-xl border border-amber-800">
                        <strong>Partial Return Action:</strong> £{cleanRefundSum} deposit will be refunded to {activeReturnPo.customerName} via PayPal today. £{totalRetained} will be held for missing/damaged items until resolved.
                      </p>
                    )}
                  </div>
                );
              })()}

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Confirm PO Batch Return & Process PayPal Deposit Refund
              </button>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-600" /> Send Staff Back Office Invitation
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold">
                {inviteSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSendInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Staff Member Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. bruce@kilt-hire.co.uk"
                  value={newInviteEmail}
                  onChange={e => setNewInviteEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assigned Staff Role</label>
                <select 
                  value={newInviteRole}
                  onChange={e => setNewInviteRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                >
                  <option value="Senior Hire Specialist">Senior Hire Specialist</option>
                  <option value="Inventory & Workshop Staff">Inventory & Workshop Staff</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Email Invitation Code
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER GARMENT MODAL WITH PROMINENT ADULTS VS KIDS SIZING TOGGLE & DYNAMIC PRICE PREFILL */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">✨ Automated Registration Triggered</span>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-600" /> Save Description for ({scannedCode})
                </h3>
              </div>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterItem} className="space-y-4 text-xs">
              
              {/* ADULT VS KIDS SIZING DEMOGRAPHIC SELECTOR TOGGLE */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Garment Demographic / Sizing Group</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      const prices = getDefaultPriceForCategory(regForm.category, false);
                      setRegForm({
                        ...regForm,
                        sizeGroup: 'Adult',
                        hireRate: prices.hireRate,
                        depositAmount: prices.deposit
                      });
                    }}
                    className={`py-2.5 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                      regForm.sizeGroup === 'Adult'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/50'
                    }`}
                  >
                    <User className="w-4 h-4" /> Adult Sizing (Rate £{getDefaultPriceForCategory(regForm.category, false).hireRate})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const prices = getDefaultPriceForCategory(regForm.category, true);
                      setRegForm({
                        ...regForm,
                        sizeGroup: 'Kid',
                        hireRate: prices.hireRate,
                        depositAmount: prices.deposit
                      });
                    }}
                    className={`py-2.5 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                      regForm.sizeGroup === 'Kid'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white/50'
                    }`}
                  >
                    <Baby className="w-4 h-4" /> Kids Sizing (Rate £{getDefaultPriceForCategory(regForm.category, true).hireRate})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Item Title / Description</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  placeholder="e.g. Royal Stewart Heavyweight 8-Yard Kilt"
                  value={regForm.name}
                  onChange={e => setRegForm({...regForm, name: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category</label>
                  <select 
                    value={regForm.category}
                    onChange={e => {
                      const newCat = e.target.value as ItemCategory;
                      const prices = getDefaultPriceForCategory(newCat, regForm.sizeGroup === 'Kid');
                      setRegForm({
                        ...regForm, 
                        category: newCat,
                        hireRate: prices.hireRate,
                        depositAmount: prices.deposit
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold outline-none focus:border-amber-500 shadow-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tartan Pattern / Colour</label>
                  <input 
                    type="text" 
                    required
                    value={regForm.tartanOrColour}
                    onChange={e => setRegForm({...regForm, tartanOrColour: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Garment Size Specs</label>
                  <input 
                    type="text" 
                    required
                    placeholder={regForm.sizeGroup === 'Kid' ? 'e.g. Kids Size 8Y / Waist 22' : 'e.g. Waist 34 / Length 24'}
                    value={regForm.size}
                    onChange={e => setRegForm({...regForm, size: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Brand / Tailor Make</label>
                  <input 
                    type="text" 
                    value={regForm.brandMake}
                    onChange={e => setRegForm({...regForm, brandMake: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Rental Rate (£) <span className="text-[10px] text-amber-800 font-mono">(Auto Prefilled)</span>
                  </label>
                  <input 
                    type="number" 
                    required
                    value={regForm.hireRate}
                    onChange={e => setRegForm({...regForm, hireRate: Number(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Deposit Amount (£) <span className="text-[10px] text-emerald-800 font-mono">(Auto Prefilled)</span>
                  </label>
                  <input 
                    type="number" 
                    required
                    value={regForm.depositAmount}
                    onChange={e => setRegForm({...regForm, depositAmount: Number(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-emerald-800 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition"
              >
                ✓ Save {regForm.sizeGroup} Garment into Stock Database
              </button>
            </form>
          </div>
        </div>
      )}

      {showSendRepairModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-rose-800 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-600" /> Send Item to Repair Workshop
              </h3>
              <button onClick={() => setShowSendRepairModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSendToRepair} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Damage / Issue Reason</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="e.g. Stained apron, loose buckle, torn hem..."
                  value={repairReason}
                  onChange={e => setRepairReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-rose-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Severity Level</label>
                <select 
                  value={repairSeverity}
                  onChange={e => setRepairSeverity(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-rose-500 shadow-sm"
                >
                  <option value="Minor">Minor (Quick Dry Cleaning / Ironing)</option>
                  <option value="Medium">Medium (Seamstress Stitching / Strap Replace)</option>
                  <option value="Severe">Severe (Major Pleat Restoration)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Confirm Move to Repair List
              </button>
            </form>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-600" /> Generate QR Code Batch (1 to 100)
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Batch Title</label>
                <input 
                  type="text" 
                  required
                  value={batchForm.title}
                  onChange={e => setBatchForm({...batchForm, title: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category</label>
                  <select 
                    value={batchForm.category}
                    onChange={e => setBatchForm({...batchForm, category: e.target.value as ItemCategory})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Sizing Group</label>
                  <select 
                    value={batchForm.sizeGroup}
                    onChange={e => setBatchForm({...batchForm, sizeGroup: e.target.value as SizeGroup})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold text-purple-900 outline-none focus:border-purple-500 shadow-sm"
                  >
                    <option value="Adult">Adult Sizing</option>
                    <option value="Kid">Kids Sizing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Batch Size (1 to 100 QRs)</label>
                <input 
                  type="number" 
                  min={1}
                  max={100}
                  required
                  value={batchForm.count}
                  onChange={e => setBatchForm({...batchForm, count: Number(e.target.value)})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold text-amber-800 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition"
              >
                Generate & Create Batch Labels
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PO MODAL WITH DYNAMIC FULL RIGOUT PRICE CAP BREAKDOWN & MULTI-OUTFIT WEDDING PARTY SCANNER */}
      {showCreatePoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 space-y-5 my-8 shadow-2xl">
            
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-amber-100 text-amber-900 font-extrabold text-xs rounded-full border border-amber-300">
                    Outgoing Hire Order Builder
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-900 rounded">
                    {newPoForm.selectedItemIds.length} Items Scanned
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-600" /> Create Customer PO (Single Outfit or Wedding Party)
                </h3>
              </div>

              <button onClick={() => setShowCreatePoModal(false)} className="p-2 text-slate-400 hover:text-slate-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* LIVE OUTGOING SCANNER BAR */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-2 text-blue-950">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs flex items-center gap-1 text-blue-900">
                  <Zap className="w-4 h-4 text-blue-600" /> Aim QR Scanner to Add Garments to this PO (e.g. Wedding Party Outfits):
                </span>
                <span className="text-[10px] font-bold text-blue-700">Keep scanning 10, 20+ items continuously!</span>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  autoFocus
                  placeholder="Scan item QR code to add to PO (e.g. KILT-1001, JKT-1002, SPO-1003)..."
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleScanCode((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
                <span className="text-[11px] font-bold text-slate-500 self-center">Press Enter / Aim Scanner</span>
              </div>

              {/* QUICK SCAN DEMO BUTTONS FOR AVAILABLE STOCK */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-blue-800 self-center">Quick Demo Available Stock Scans:</span>
                {items.filter(i => i.status === 'AVAILABLE').slice(0, 8).map(item => {
                  const isSelected = newPoForm.selectedItemIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleScanCode(item.id)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-bold border transition ${
                        isSelected 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '➕ Add '}{item.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleCreatePoSubmit} className="space-y-4 text-xs">
              
              {/* CUSTOMER DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Customer / Groom Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Gordon MacLeod (Wedding Party)"
                    value={newPoForm.customerName}
                    onChange={e => setNewPoForm({...newPoForm, customerName: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="gordon@example.co.uk"
                    value={newPoForm.customerEmail}
                    onChange={e => setNewPoForm({...newPoForm, customerEmail: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Contact Phone</label>
                  <input 
                    type="text" 
                    required
                    placeholder="07700 900123"
                    value={newPoForm.customerPhone}
                    onChange={e => setNewPoForm({...newPoForm, customerPhone: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              {/* DATES */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Hire Start Date</label>
                  <input 
                    type="date" 
                    required
                    value={newPoForm.hireStartDate}
                    onChange={e => setNewPoForm({...newPoForm, hireStartDate: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Wedding / Event Date</label>
                  <input 
                    type="date" 
                    required
                    value={newPoForm.eventDate}
                    onChange={e => setNewPoForm({...newPoForm, eventDate: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Return End Date</label>
                  <input 
                    type="date" 
                    required
                    value={newPoForm.hireEndDate}
                    onChange={e => setNewPoForm({...newPoForm, hireEndDate: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              {/* SCANNED ITEMS LIST */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-700 font-extrabold">Scanned Garment Line Items ({newPoForm.selectedItemIds.length} Total):</label>
                  {newPoForm.selectedItemIds.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setNewPoForm({...newPoForm, selectedItemIds: []})}
                      className="text-[11px] text-rose-600 hover:underline font-bold"
                    >
                      Clear List
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-300 rounded-2xl p-2 space-y-1">
                  {items.filter(i => i.status === 'AVAILABLE').map(item => {
                    const isSelected = newPoForm.selectedItemIds.includes(item.id);
                    return (
                      <label key={item.id} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                        isSelected ? 'bg-amber-100/90 border border-amber-300 font-bold' : 'hover:bg-white border border-transparent'
                      }`}>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewPoForm({...newPoForm, selectedItemIds: [...newPoForm.selectedItemIds, item.id]});
                              } else {
                                setNewPoForm({...newPoForm, selectedItemIds: newPoForm.selectedItemIds.filter(id => id !== item.id)});
                              }
                            }}
                          />
                          <span className="font-mono font-extrabold text-amber-900">{item.id}</span>
                          <span className="text-slate-900">{item.name}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                            {item.sizeGroup} ({item.size})
                          </span>
                        </div>
                        <span className="text-slate-700 font-semibold">£{item.hireRate} hire + £{item.depositAmount} dep</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* DYNAMIC PRICE BREAKDOWN WITH FULL RIGOUT PRICE CAP */}
              {newPoForm.selectedItemIds.length > 0 && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 space-y-2 text-xs">
                  {(() => {
                    const selectedList = items.filter(i => newPoForm.selectedItemIds.includes(i.id));
                    const subtotal = selectedList.reduce((acc, curr) => acc + curr.hireRate, 0);
                    const depTotal = selectedList.reduce((acc, curr) => acc + curr.depositAmount, 0);
                    const adultCount = selectedList.filter(i => i.sizeGroup === 'Adult').length;
                    const kidCount = selectedList.filter(i => i.sizeGroup === 'Kid').length;
                    const hasKids = kidCount > 0;
                    const cap = hasKids ? kidMaxRigoutCapPrice : maxRigoutCapPrice;
                    const isCapApplied = subtotal > cap;
                    const discount = isCapApplied ? subtotal - cap : 0;
                    const finalFee = isCapApplied ? cap : subtotal;

                    return (
                      <>
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Scanned ({selectedList.length} items - {adultCount} Adults, {kidCount} Kids) Subtotal:</span>
                          <span className={`font-mono font-bold ${isCapApplied ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            £{subtotal}
                          </span>
                        </div>

                        {isCapApplied && (
                          <div className="flex justify-between items-center text-emerald-800 font-bold bg-emerald-100/70 p-2 rounded-lg border border-emerald-300">
                            <span>✨ Full Rigout Price Cap Applied ({hasKids ? 'Kids £' + kidMaxRigoutCapPrice : 'Adult £' + maxRigoutCapPrice} Limit):</span>
                            <span className="font-mono text-emerald-900">-£{discount} Discount</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-amber-200 text-sm font-extrabold">
                          <span className="text-slate-900">Total Rental Hire Fee:</span>
                          <span className="text-amber-900 font-mono">£{finalFee}</span>
                        </div>

                        <div className="flex justify-between items-center text-slate-600 pt-1">
                          <span>PayPal Security Deposit (Refundable on return):</span>
                          <span className="text-emerald-700 font-mono font-bold">£{depTotal}</span>
                        </div>

                        <div className="pt-2 border-t border-amber-200 text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Meticulous Return Policy: When these {selectedList.length} garments are returned, staff must scan each QR label individually before deposit refunding.</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
              >
                <DollarSign className="w-4 h-4" /> Process PayPal Payment & Issue Purchase Order ({newPoForm.selectedItemIds.length} Items)
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
