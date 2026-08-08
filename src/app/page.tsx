'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getStaffProfiles,
  getStaffProfileById,
  upsertStaffProfile,
  deleteStaffProfile,
  getInvites,
  upsertInvite,
  deleteInvite,
  getItems,
  upsertItem,
  getBatches,
  upsertBatch,
  getPurchaseOrders,
  upsertPurchaseOrder,
  getAuditLogs,
  addAuditLogFS,
  clearAuditLogsFS,
  getPricing,
  savePricing,
  seedCollectionIfEmpty,
} from '../lib/firestore';
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
  CategoryPriceSetting,
  LaundryRecord,
  StaffRole,
  CustomerMeasurements,
  POOrderStatus
} from './types';
import {
  sendBrevoEmail,
  generateCollectionReadyEmailHtml,
  generatePaymentReminderEmailHtml
} from '../lib/brevo';
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
  Crown,
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
  EyeOff,
  RefreshCw as RestoreIcon,
  CheckCircle,
  HelpCircle,
  BookOpen,
  BarChart3,
  TrendingUp,
  Download,
  Smartphone,
  Share2,
  PlusSquare,
  UserMinus,
  UserCog,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Maximize2
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

const DEFAULT_TARTANS = [
  'Royal Stewart',
  'Spirit of Scotland',
  'Black Watch',
  'Highland Heritage',
  'Midnight Black',
  'Modern Douglas',
  'Grey Granite',
  'Lovat Blue'
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

  // Pricing vs Products Sub-Tab & Custom Tartan Catalog State
  const [pricingSubTab, setPricingSubTab] = useState<'PRICING' | 'PRODUCTS'>('PRICING');
  const [tartanList, setTartanList] = useState<string[]>(DEFAULT_TARTANS);
  const [newTartanInput, setNewTartanInput] = useState<string>('');

  // Interface Mode: 'admin_portal' (Full Office) vs 'shop_assistant' (Automated Floor Terminal)
  const [interfaceMode, setInterfaceMode] = useState<'admin_portal' | 'shop_assistant'>('shop_assistant');

  // Shop Assistant Floor Tabs: 'scanner' | 'in_stock' | 'on_hire' | 'needs_cleaning' | 'in_repair' | 'calendar' | 'pos' | 'start_fitting'
  const [assistantTab, setAssistantTab] = useState<'scanner' | 'in_stock' | 'on_hire' | 'needs_cleaning' | 'in_repair' | 'calendar' | 'pos' | 'start_fitting'>('scanner');
  const [assistantSearch, setAssistantSearch] = useState('');
  const [assistantSizeFilter, setAssistantSizeFilter] = useState<'ALL' | 'Adult' | 'Kid'>('ALL');
  const [assistantCategoryFilter, setAssistantCategoryFilter] = useState<string>('ALL');
  const [assistantTartanFilter, setAssistantTartanFilter] = useState<string>('ALL');

  // Inventory tab demographic filter & Sub-Tabs in Admin
  const [inventorySizeFilter, setInventorySizeFilter] = useState<'ALL' | 'Adult' | 'Kid'>('ALL');
  const [inventorySubTab, setInventorySubTab] = useState<'ACTIVE' | 'LAUNDRY' | 'REPAIR' | 'ARCHIVE'>('ACTIVE');

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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form
  const [regInviteCode, setRegInviteCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regError, setRegError] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Tab State for Admin: 'scanner' | 'batches' | 'inventory' | 'pos' | 'laundry' | 'repairs' | 'analytics' | 'pricing' | 'admin' | 'start_fitting'
  const [activeTab, setActiveTab] = useState<'scanner' | 'batches' | 'inventory' | 'pos' | 'laundry' | 'repairs' | 'analytics' | 'pricing' | 'admin' | 'start_fitting'>('scanner');
  const [isLoaded, setIsLoaded] = useState(false);

  // Scanner & Selected QR State
  const [scannedCode, setScannedCode] = useState<string>('');
  const [simulatedInput, setSimulatedInput] = useState<string>('');
  const [activeCamera, setActiveCamera] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSendRepairModal, setShowSendRepairModal] = useState(false);
  
  // PWA Installability State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState<boolean>(false);
  const [installDismissed, setInstallDismissed] = useState<boolean>(false);
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [showEditPoModal, setShowEditPoModal] = useState<PurchaseOrder | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // MULTI-ITEM PO RETURN CHECKLIST MODAL STATE
  const [activeReturnPo, setActiveReturnPo] = useState<PurchaseOrder | null>(null);
  const [returnChecklist, setReturnChecklist] = useState<Record<string, {
    condition: 'GOOD_CLEAN' | 'NEEDS_CLEANING' | 'NEEDS_REPAIR' | 'MISSING';
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
  const [reprintSearchQuery, setReprintSearchQuery] = useState<string>('');
  const [reprintPinInput, setReprintPinInput] = useState<string>('');
  const [reprintReason, setReprintReason] = useState<string>('');
  const [showReprintPinModal, setShowReprintPinModal] = useState<boolean>(false);
  const [reprintPrintMode, setReprintPrintMode] = useState<boolean>(false);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState<string>('');

  // Availability & Booking Calendar state (Shop Assistant Mode)
  const [calSelectedDate, setCalSelectedDate] = useState<string>('2026-08-05');
  const [calTartanFilter, setCalTartanFilter] = useState<string>('ALL');
  const [calCategoryFilter, setCalCategoryFilter] = useState<string>('ALL');

  // Invite & Staff Management Form State
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<StaffRole>('Shop Assistant');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);

  // Direct Staff Addition Modal & Form State
  const [showDirectAddStaffModal, setShowDirectAddStaffModal] = useState<boolean>(false);
  const [directStaffForm, setDirectStaffForm] = useState({
    name: '',
    email: '',
    role: 'Shop Assistant' as StaffRole,
    password: '',
    pin: '1234'
  });
  const [directStaffError, setDirectStaffError] = useState('');

  // Edit Staff Member Modal State
  const [showEditStaffModal, setShowEditStaffModal] = useState<StaffUser | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: '',
    email: '',
    role: 'Shop Assistant' as StaffRole,
    pin: ''
  });

  // Camera Zoom & Multi-Lens State
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(1.25); // Default 1.25x (25% zoom)

  // My Account Modal State
  const [showMyAccountModal, setShowMyAccountModal] = useState<boolean>(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    pin: ''
  });
  const [showAccPassword, setShowAccPassword] = useState<boolean>(false);
  const [showAccPin, setShowAccPin] = useState<boolean>(false);
  const [accountMsg, setAccountMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Customer Fitting Modal State
  const [showStartFittingModal, setShowStartFittingModal] = useState<boolean>(false);
  const [fittingForm, setFittingForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    eventDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    collectionDate: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
    returnDate: new Date(Date.now() + 16 * 86400000).toISOString().slice(0, 10),
    waistInches: 34,
    chestInches: 42,
    sleeveLengthInches: 25,
    kiltLengthInches: 24,
    shoeSize: '10',
    heightFtInches: "5'11",
    jacketStyle: 'Prince Charlie',
    tartanPref: 'Royal Stewart',
    selectedItemIds: [] as string[],
    depositMethod: 'PAYPAL_ONLINE' as 'PAYPAL_ONLINE' | 'IN_STORE_CASH' | 'IN_STORE_CARD',
    notes: ''
  });

  // Brevo Email Modal State
  const [showBrevoEmailModal, setShowBrevoEmailModal] = useState<boolean>(false);
  const [brevoEmailData, setBrevoEmailData] = useState<{
    poId: string;
    toEmail: string;
    toName: string;
    subject: string;
    htmlContent: string;
    isSending?: boolean;
    statusMsg?: string;
  } | null>(null);

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

  // Express Bag Assembly Mode State (Scan -> Details)
  const [isAssemblyMode, setIsAssemblyMode] = useState<boolean>(false);

  // Staff User Guide & Operations Manual Modal State
  const [showUserGuideModal, setShowUserGuideModal] = useState<boolean>(false);
  const [guideTopic, setGuideTopic] = useState<'SCANNER' | 'CALENDAR' | 'QR_PRINTING' | 'BULK_BINS' | 'LAUNDRY' | 'ANALYTICS'>('SCANNER');

  // ─── LOAD DATA & PWA SETUP ───────────────────────────────────────────────────
  useEffect(() => {
    // Check if running in standalone mode (already installed)
    if (typeof window !== 'undefined') {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      const dismissed = localStorage.getItem('kilt_pwa_dismissed');
      if (dismissed === 'true') setInstallDismissed(true);

      // Register Service Worker for PWA installation & caching
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('PWA Service Worker registration skipped or failed:', err);
        });
      }

      // Capture beforeinstallprompt event for Android / Chrome / Edge
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Instantly hide all install buttons when the user completes app installation
      const handleAppInstalled = () => {
        setIsStandalone(true);
        setDeferredPrompt(null);
        showToast('🎉 App installed to Home Screen! You can now launch it directly as a native app.', 'success');
      };
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('🎉 Highland Kilt Hire app installed successfully!', 'success');
        setDeferredPrompt(null);
      }
    } else {
      const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIos) {
        setShowIosInstallModal(true);
      } else {
        showToast('📲 To install: Open browser menu (⋮ or Share) and select "Add to Home Screen" or "Install App".', 'info');
      }
    }
  };

  const handleDismissBanner = () => {
    setInstallDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kilt_pwa_dismissed', 'true');
    }
  };

  useEffect(() => {
    const savedMode = localStorage.getItem('kilt_interface_mode');
    if (savedMode === 'shop_assistant' || savedMode === 'admin_portal') setInterfaceMode(savedMode);
    const savedCap = localStorage.getItem('kilt_max_rigout_cap');
    const savedKidCap = localStorage.getItem('kilt_kid_max_rigout_cap');
    if (savedCap) setMaxRigoutCapPrice(Number(savedCap));
    if (savedKidCap) setKidMaxRigoutCapPrice(Number(savedKidCap));
    const savedTartans = localStorage.getItem('kilt_tartans');
    if (savedTartans) setTartanList(JSON.parse(savedTartans));

    async function loadFromFirestore() {
      try {
        // Seed Firestore if empty (first run only)
        await seedCollectionIfEmpty('items', INITIAL_ITEMS, upsertItem);
        await seedCollectionIfEmpty('batches', INITIAL_BATCHES, upsertBatch);
        await seedCollectionIfEmpty('purchase_orders', INITIAL_POS, upsertPurchaseOrder);
        await seedCollectionIfEmpty('invites', INITIAL_INVITES, upsertInvite);

        // Load all collections in parallel
        const [fsItems, fsBatches, fsPOs, fsLogs, fsStaff, fsInvites, fsPricing] = await Promise.all([
          getItems(),
          getBatches(),
          getPurchaseOrders(),
          getAuditLogs(),
          getStaffProfiles(),
          getInvites(),
          getPricing(),
        ]);

        if (fsItems.length > 0) setItems(fsItems);
        else setItems(INITIAL_ITEMS);

        if (fsBatches.length > 0) setBatches(fsBatches);
        else setBatches(INITIAL_BATCHES);

        if (fsPOs.length > 0) setPos(fsPOs);
        else setPos(INITIAL_POS);

        if (fsLogs.length > 0) setLogs(fsLogs);
        else setLogs(INITIAL_LOGS);

        if (fsStaff.length > 0) setStaffList(fsStaff);
        else setStaffList(INITIAL_STAFF);

        if (fsInvites.length > 0) setInvites(fsInvites);
        else setInvites(INITIAL_INVITES);

        if (fsPricing) setPricingMatrix(fsPricing);
        else setPricingMatrix(DEFAULT_PRICING_MATRIX);

      } catch (err) {
        console.warn('Firestore load failed, using localStorage cache:', err);
        // Fall back to localStorage
        try {
          const savedItems = localStorage.getItem('kilt_items');
          const savedBatches = localStorage.getItem('kilt_batches');
          const savedPos = localStorage.getItem('kilt_pos');
          const savedLogs = localStorage.getItem('kilt_logs');
          const savedStaff = localStorage.getItem('kilt_staff');
          const savedInvites = localStorage.getItem('kilt_invites');
          const savedPricing = localStorage.getItem('kilt_pricing_matrix');
          setItems(savedItems ? JSON.parse(savedItems) : INITIAL_ITEMS);
          setBatches(savedBatches ? JSON.parse(savedBatches) : INITIAL_BATCHES);
          setPos(savedPos ? JSON.parse(savedPos) : INITIAL_POS);
          setLogs(savedLogs ? JSON.parse(savedLogs) : INITIAL_LOGS);
          setStaffList(savedStaff ? JSON.parse(savedStaff) : INITIAL_STAFF);
          setInvites(savedInvites ? JSON.parse(savedInvites) : INITIAL_INVITES);
          if (savedPricing) setPricingMatrix(JSON.parse(savedPricing));
        } catch {
          setItems(INITIAL_ITEMS);
          setBatches(INITIAL_BATCHES);
          setPos(INITIAL_POS);
          setLogs(INITIAL_LOGS);
          setStaffList(INITIAL_STAFF);
          setInvites(INITIAL_INVITES);
          setPricingMatrix(DEFAULT_PRICING_MATRIX);
          setTartanList(DEFAULT_TARTANS);
        }
      } finally {
        setIsLoaded(true);
      }
    }

    loadFromFirestore();
  }, []);

  // ─── AUTH STATE LISTENER ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth) return; // not on server
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && isLoaded) {
        try {
          // Fetch live user document directly from Firestore /users/{uid}
          const liveProfile = await getStaffProfileById(firebaseUser.uid);
          if (liveProfile) {
            setCurrentUser(liveProfile);
            localStorage.setItem('kilt_current_user', JSON.stringify(liveProfile));
          } else {
            const profiles = await getStaffProfiles();
            const match = profiles.find(p => p.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            if (match) {
              setCurrentUser(match);
              localStorage.setItem('kilt_current_user', JSON.stringify(match));
            }
          }
        } catch {
          const savedUser = localStorage.getItem('kilt_current_user');
          if (savedUser) setCurrentUser(JSON.parse(savedUser));
        }
      } else if (!firebaseUser) {
        setCurrentUser(null);
        localStorage.removeItem('kilt_current_user');
      }
    });
    return () => unsubscribe();
  }, [isLoaded]);

  // ─── SAVE: localStorage cache + Firestore mirror ──────────────────────────────
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
    localStorage.setItem('kilt_tartans', JSON.stringify(tartanList));
    localStorage.setItem('kilt_current_user', JSON.stringify(currentUser));
  }, [items, batches, pos, logs, staffList, invites, maxRigoutCapPrice, kidMaxRigoutCapPrice, pricingMatrix, interfaceMode, tartanList, currentUser, isLoaded]);

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
      id: `LOG-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      staffName: currentUser ? currentUser.name : 'System',
      action,
      details,
      ...(relatedQrCode ? { relatedQrCode } : {})
    };
    setLogs(prev => [newLog, ...prev]);
    // Persist log directly to Firestore audit_logs collection
    try {
      addAuditLogFS(newLog);
    } catch (err) {
      console.warn('Firestore audit log write note:', err);
    }
  };

  // LOGIN Handler — Firebase Auth + PIN secondary check
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      if (!auth) throw new Error('auth/not-available');
      // Firebase Auth: email + PIN as password
      const credential = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPin.trim());
      // Load staff profile from Firestore
      const profiles = await getStaffProfiles();
      const profile = profiles.find(p => p.email.toLowerCase() === loginEmail.toLowerCase().trim());
      if (profile) {
        setCurrentUser(profile);
        localStorage.setItem('kilt_current_user', JSON.stringify(profile));
        addAuditLog('STAFF_LOGIN', `${profile.name} (${profile.role}) logged into back office.`);
      } else {
        // Auth succeeded but no Firestore profile — use local staffList lookup
        const found = staffList.find(s =>
          s.email.toLowerCase() === loginEmail.toLowerCase().trim()
        );
        if (found) {
          setCurrentUser(found);
          localStorage.setItem('kilt_current_user', JSON.stringify(found));
          addAuditLog('STAFF_LOGIN', `${found.name} (${found.role}) logged into back office.`);
        }
      }
    } catch {
      // Firebase Auth failed — fall back to local PIN check (for offline/demo use)
      const found = staffList.find(s =>
        s.email.toLowerCase() === loginEmail.toLowerCase().trim() && s.pin === loginPin.trim()
      );
      if (found) {
        setCurrentUser(found);
        addAuditLog('STAFF_LOGIN', `${found.name} (${found.role}) logged in (offline mode).`);
      } else {
        setLoginError('Invalid Email or PIN. If this is your first login, use the PIN you set during account creation.');
      }
    }
  };

  // REGISTER WITH INVITE CODE Handler — Firebase Auth + Firestore
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    const cleanCode = regInviteCode.trim().toUpperCase();
    const inviteMatch = invites.find(inv => inv.code === cleanCode && inv.status === 'PENDING');

    if (!inviteMatch) {
      setRegError('Invalid or expired Invite Code. Please request a new invite from Allan (Master Admin).');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setRegError('Please set a password of at least 6 characters for your account login.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (staffList.some(s => s.email.toLowerCase() === cleanEmail)) {
      setRegError('A staff member with this email is already registered.');
      return;
    }

    try {
      if (!auth) {
        setRegError('Authentication service unavailable. Please try again in a moment.');
        return;
      }
      // Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, regPassword);
      const uid = credential.user.uid;

      const newStaffUser: StaffUser = {
        id: uid,
        name: regName.trim(),
        role: inviteMatch.role,
        email: cleanEmail,
        pin: regPin.trim() || '1234',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      };

      // Save to Firestore
      await upsertStaffProfile(uid, newStaffUser);

      const updatedInvite = {
        ...inviteMatch,
        status: 'REGISTERED' as const,
        usedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      };
      await upsertInvite(updatedInvite);

      setInvites(prev => prev.map(inv => inv.code === cleanCode ? updatedInvite : inv));
      setStaffList(prev => [...prev, newStaffUser]);
      setCurrentUser(newStaffUser);
      localStorage.setItem('kilt_current_user', JSON.stringify(newStaffUser));

      addAuditLog('STAFF_REGISTERED_INVITE', `Staff member ${newStaffUser.name} registered using invite code ${cleanCode}. Firebase UID: ${uid}`);
    } catch (err: unknown) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === 'auth/email-already-in-use') {
        setRegError('This email is already registered. Please log in instead.');
      } else if (errorCode === 'auth/weak-password') {
        setRegError('Password is too weak. Please use at least 6 characters.');
      } else {
        setRegError('Registration failed. Please check your details and try again.');
      }
    }
  };

  // MASTER ADMIN: Send Staff Invite
  const handleSendInviteSubmit = async (e: React.FormEvent) => {
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
    await upsertInvite(newInvite);
    addAuditLog('CREATED_STAFF_INVITE', `Created staff registration invite for ${newInvite.email} (${newInvite.role}) with code ${code}`);
    
    setInviteSuccessMsg(`Invite Code [ ${code} ] generated & saved!`);
    setNewInviteEmail('');
  };

  // DELETE / REVOKE PENDING INVITE
  const handleDeleteInvite = async (inviteId: string) => {
    const target = invites.find(i => i.id === inviteId);
    if (!target) return;
    if (confirm(`Revoke pending invite for ${target.email} (${target.code})?`)) {
      const updated = invites.filter(i => i.id !== inviteId);
      setInvites(updated);
      await deleteInvite(inviteId);
      addAuditLog('REVOKED_STAFF_INVITE', `Revoked staff invite code ${target.code} for ${target.email}`);
      showToast(`🗑️ Revoked invite for ${target.email}`, 'info');
    }
  };

  // DIRECT ADD STAFF MEMBER HANDLER
  const handleDirectAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectStaffError('');
    const cleanEmail = directStaffForm.email.trim().toLowerCase();
    const cleanName = directStaffForm.name.trim();
    const cleanPin = directStaffForm.pin.trim() || '1234';
    const cleanPassword = directStaffForm.password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setDirectStaffError('Please fill out all required fields.');
      return;
    }

    try {
      let uid = `STAFF-${Date.now()}`;
      if (auth) {
        try {
          const credential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          uid = credential.user.uid;
        } catch (authErr: any) {
          console.warn('Firebase auth direct creation note:', authErr);
        }
      }

      const newStaffUser: StaffUser = {
        id: uid,
        name: cleanName,
        role: directStaffForm.role,
        email: cleanEmail,
        pin: cleanPin,
        registeredAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      };

      await upsertStaffProfile(uid, newStaffUser);
      const updatedList = [newStaffUser, ...staffList.filter(s => s.id !== uid && s.email.toLowerCase() !== cleanEmail)];
      setStaffList(updatedList);
      localStorage.setItem('kilt_staff', JSON.stringify(updatedList));

      addAuditLog('DIRECT_ADD_STAFF', `Added new staff member ${cleanName} (${cleanEmail}) as ${directStaffForm.role}`);
      setShowDirectAddStaffModal(false);
      setDirectStaffForm({ name: '', email: '', role: 'Shop Assistant', password: '', pin: '1234' });
      showToast(`🎉 Staff member ${cleanName} added successfully as ${directStaffForm.role}!`, 'success');
    } catch (err: any) {
      setDirectStaffError(err.message || 'Failed to add staff member.');
    }
  };

  // EDIT STAFF DETAILS HANDLER
  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditStaffModal) return;

    const updatedUser: StaffUser = {
      ...showEditStaffModal,
      name: editStaffForm.name.trim(),
      email: editStaffForm.email.trim().toLowerCase(),
      role: editStaffForm.role,
      pin: editStaffForm.pin.trim() || '1234'
    };

    await upsertStaffProfile(updatedUser.id, updatedUser);
    const updatedList = staffList.map(s => s.id === updatedUser.id ? updatedUser : s);
    setStaffList(updatedList);
    localStorage.setItem('kilt_staff', JSON.stringify(updatedList));

    addAuditLog('EDITED_STAFF_MEMBER', `Updated staff member ${updatedUser.name} (${updatedUser.role})`);
    setShowEditStaffModal(null);
    showToast(`✏️ Updated profile for ${updatedUser.name}`, 'success');
  };

  // DELETE STAFF MEMBER HANDLER
  const handleDeleteStaff = async (staffUser: StaffUser) => {
    if (staffUser.id === currentUser?.id) {
      alert("You cannot delete your own logged-in account!");
      return;
    }
    if (confirm(`Remove staff member ${staffUser.name} (${staffUser.email}) from the system?`)) {
      const updatedList = staffList.filter(s => s.id !== staffUser.id);
      setStaffList(updatedList);
      await deleteStaffProfile(staffUser.id);
      localStorage.setItem('kilt_staff', JSON.stringify(updatedList));
      addAuditLog('REMOVED_STAFF_MEMBER', `Removed staff member ${staffUser.name} (${staffUser.email})`);
      showToast(`🗑️ Staff member ${staffUser.name} removed from system.`, 'info');
    }
  };

  // PURGE ALL PENDING INVITES
  const handleClearAllInvites = async () => {
    if (invites.length === 0) {
      showToast('No pending invites to clear.', 'info');
      return;
    }
    if (confirm("Are you sure you want to delete all pending staff invites?")) {
      try {
        await Promise.all(invites.map(inv => deleteInvite(inv.id)));
      } catch (err) {
        console.warn('Firestore purge invites note:', err);
      }
      setInvites([]);
      localStorage.setItem('kilt_invites', '[]');
      addAuditLog('PURGED_ALL_INVITES', 'Purged all pending staff invites from system.');
      showToast('🧹 All pending invites purged successfully!', 'success');
    }
  };

  // PURGE DEMO AUDIT LOGS
  const handleClearAuditLogs = async () => {
    if (confirm("Reset audit activity trail to clean state?")) {
      const cleanLog: AuditLog = {
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        staffName: currentUser?.name || 'Allan',
        action: 'CLEARED_AUDIT_TRAIL',
        details: 'Master Admin cleared demo audit history.'
      };
      try {
        await clearAuditLogsFS();
        await addAuditLogFS(cleanLog);
      } catch (err) {
        console.warn('Firestore clear audit logs note:', err);
      }
      setLogs([cleanLog]);
      localStorage.setItem('kilt_logs', JSON.stringify([cleanLog]));
      showToast('🧹 Audit logs reset to clean state in database!', 'success');
    }
  };

  // MY ACCOUNT HANDLERS
  const handleOpenMyAccount = async () => {
    if (!currentUser) return;
    setAccountMsg(null);
    setShowAccPassword(false);
    setShowAccPin(false);

    // Initial prefill from local state
    setAccountForm({
      name: currentUser.name,
      email: currentUser.email,
      password: '',
      pin: currentUser.pin || '1234'
    });
    setShowMyAccountModal(true);

    // Fetch live user document directly from Firestore /users/{uid} to guarantee real-time PIN
    try {
      const liveDoc = await getStaffProfileById(currentUser.id);
      if (liveDoc) {
        setCurrentUser(liveDoc);
        localStorage.setItem('kilt_current_user', JSON.stringify(liveDoc));
        setAccountForm({
          name: liveDoc.name,
          email: liveDoc.email,
          password: '',
          pin: liveDoc.pin || '1234'
        });
      }
    } catch (err) {
      console.warn('Live profile fetch note:', err);
    }
  };

  const handleSaveAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAccountMsg(null);

    const cleanName = accountForm.name.trim();
    const cleanEmail = accountForm.email.trim().toLowerCase();
    const cleanPin = accountForm.pin.trim() || '1234';
    const newPass = accountForm.password.trim();

    if (!cleanName || !cleanEmail) {
      setAccountMsg({ text: 'Name and Email are required.', type: 'error' });
      return;
    }

    try {
      if (newPass && auth?.currentUser) {
        if (newPass.length < 6) {
          setAccountMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
          return;
        }
        await updatePassword(auth.currentUser, newPass);
      }

      const updatedUser: StaffUser = {
        ...currentUser,
        name: cleanName,
        email: cleanEmail,
        pin: cleanPin
      };

      await upsertStaffProfile(updatedUser.id, updatedUser);
      setCurrentUser(updatedUser);
      setStaffList(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s));
      localStorage.setItem('kilt_current_user', JSON.stringify(updatedUser));

      addAuditLog('UPDATED_MY_ACCOUNT', `${cleanName} updated their profile info and security credentials.`);
      setAccountMsg({ text: '🎉 Profile & Security Credentials updated successfully!', type: 'success' });
      setAccountForm(prev => ({ ...prev, password: '' }));
    } catch (err: any) {
      setAccountMsg({ text: err.message || 'Failed to update account.', type: 'error' });
    }
  };

  const handleCloseMyAccount = async () => {
    if (!currentUser) return;
    if (confirm(`Are you sure you want to CLOSE and DEACTIVATE your account (${currentUser.email})?\n\nThis will remove your access and log you out immediately.`)) {
      try {
        const uid = currentUser.id;
        await deleteStaffProfile(uid);
        if (auth?.currentUser) {
          try { await deleteUser(auth.currentUser); } catch { /* silent */ }
        }
        setStaffList(prev => prev.filter(s => s.id !== uid));
        addAuditLog('CLOSED_STAFF_ACCOUNT', `Staff account for ${currentUser.name} (${currentUser.email}) was closed by user.`);
        setCurrentUser(null);
        localStorage.removeItem('kilt_current_user');
        setShowMyAccountModal(false);
        showToast('👋 Your staff account has been closed. You are now logged out.', 'info');
      } catch (err: any) {
        setAccountMsg({ text: err.message || 'Failed to close account.', type: 'error' });
      }
    }
  };

  // ─── FITTING & BREVO EMAIL HANDLERS ──────────────────────────────────────────
  const handleOpenStartFitting = () => {
    setFittingForm({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      eventDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      collectionDate: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
      returnDate: new Date(Date.now() + 16 * 86400000).toISOString().slice(0, 10),
      waistInches: 34,
      chestInches: 42,
      sleeveLengthInches: 25,
      kiltLengthInches: 24,
      shoeSize: '10',
      heightFtInches: "5'11",
      jacketStyle: 'Prince Charlie',
      tartanPref: 'Royal Stewart',
      selectedItemIds: [],
      depositMethod: 'PAYPAL_ONLINE',
      notes: ''
    });
    setAssistantTab('start_fitting');
    setActiveTab('start_fitting');
  };

  const handleSaveFittingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fittingForm.customerName || !fittingForm.customerEmail) {
      showToast('Customer Name and Email are required for fitting orders.', 'warning');
      return;
    }

    const selectedItems = items.filter(i => fittingForm.selectedItemIds.includes(i.id));
    if (selectedItems.length === 0) {
      showToast('Please select at least 1 garment item for the customer fitting outfit.', 'warning');
      return;
    }

    const poId = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const lineItems: POLineItem[] = selectedItems.map(item => ({
      qrCodeId: item.id,
      itemName: item.name,
      category: item.category,
      sizeGroup: item.sizeGroup,
      size: item.size,
      hireRate: item.hireRate,
      depositAmount: item.depositAmount,
      returned: false
    }));

    const rawSubtotal = lineItems.reduce((acc, i) => acc + i.hireRate, 0);
    const hasKilt = lineItems.some(i => i.category === 'Kilts');
    const hasJacket = lineItems.some(i => i.category === 'Jackets');
    const fullRigoutCapApplied = hasKilt && hasJacket && rawSubtotal > 120;
    const totalHireFee = fullRigoutCapApplied ? 120 : rawSubtotal;
    const fullRigoutDiscount = fullRigoutCapApplied ? rawSubtotal - 120 : 0;
    const totalDepositHeld = 60; // Standard rigout deposit

    const isPaypal = fittingForm.depositMethod === 'PAYPAL_ONLINE';

    const newPo: PurchaseOrder = {
      id: poId,
      customerName: fittingForm.customerName.trim(),
      customerEmail: fittingForm.customerEmail.trim().toLowerCase(),
      customerPhone: fittingForm.customerPhone.trim(),
      eventDate: fittingForm.eventDate,
      hireStartDate: fittingForm.collectionDate,
      hireEndDate: fittingForm.returnDate,
      items: lineItems,
      itemizedSubtotal: rawSubtotal,
      fullRigoutCapApplied,
      fullRigoutDiscount,
      totalHireFee,
      totalDepositHeld,
      paymentStatus: isPaypal ? 'UNPAID' : 'PAID_WITH_DEPOSIT',
      orderStatus: isPaypal ? 'RESERVED_PENDING_PAYMENT' : 'DEPOSIT_PAID_CONFIRMED',
      depositPaymentMethod: fittingForm.depositMethod,
      depositPaidAt: isPaypal ? undefined : new Date().toISOString().replace('T', ' ').slice(0, 16),
      measurements: {
        waistInches: fittingForm.waistInches,
        chestInches: fittingForm.chestInches,
        sleeveLengthInches: fittingForm.sleeveLengthInches,
        kiltLengthInches: fittingForm.kiltLengthInches,
        shoeSize: fittingForm.shoeSize,
        heightFtInches: fittingForm.heightFtInches,
        jacketStylePreference: fittingForm.jacketStyle,
        tartanPreference: fittingForm.tartanPref,
        notes: fittingForm.notes
      },
      issuedByStaff: currentUser?.name || 'Allan',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      notes: `Fitting Order (${fittingForm.depositMethod === 'PAYPAL_ONLINE' ? 'PayPal Invoice Sent' : 'In-Store Deposit Paid'})`
    };

    try {
      await upsertPurchaseOrder(newPo);
      setPos(prev => [newPo, ...prev]);
      addAuditLog('CREATED_FITTING_ORDER', `Created fitting order ${poId} for ${newPo.customerName} (${newPo.items.length} items, Waist ${fittingForm.waistInches}", Chest ${fittingForm.chestInches}")`, poId);
      
      setAssistantTab('calendar');
      setActiveTab('pos');

      if (isPaypal) {
        showToast(`🎉 Fitting Order ${poId} reserved! PayPal invoice link generated.`, 'success');
      } else {
        showToast(`🎉 Fitting Order ${poId} saved & £${totalDepositHeld} deposit recorded in store!`, 'success');
      }
    } catch (err: any) {
      showToast(`Failed to save fitting order: ${err.message}`, 'warning');
    }
  };

  const handleMarkOrderReadyForCollection = async (po: PurchaseOrder) => {
    try {
      const updatedPo: PurchaseOrder = {
        ...po,
        orderStatus: 'READY_FOR_COLLECTION',
        assembledAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        assembledByStaff: currentUser?.name || 'Allan'
      };

      // Mark stock items as ON_HIRE
      const itemIdsToOccupy = new Set(po.items.map(li => li.qrCodeId));
      const updatedItems = items.map(item => {
        if (itemIdsToOccupy.has(item.id)) {
          const newItem = { ...item, status: 'ON_HIRE' as ItemStatus, currentPoId: po.id };
          upsertItem(newItem).catch(() => {});
          return newItem;
        }
        return item;
      });

      await upsertPurchaseOrder(updatedPo);
      setPos(prev => prev.map(p => p.id === po.id ? updatedPo : p));
      setItems(updatedItems);

      addAuditLog('ORDER_READY_FOR_COLLECTION', `Order ${po.id} assembled and marked ready for collection by ${currentUser?.name || 'Allan'}. Items allocated ON_HIRE.`, po.id);
      showToast(`📦 Order ${po.id} marked ready for collection! Items allocated ON_HIRE.`, 'success');

      // Generate Brevo Collection Email Preview
      const isFullyPaid = po.paymentStatus === 'FULL_BALANCE_PAID' || po.paymentStatus === 'PAID_WITH_DEPOSIT';
      const emailHtml = generateCollectionReadyEmailHtml({
        customerName: po.customerName,
        poId: po.id,
        eventDate: po.eventDate,
        collectionDate: po.hireStartDate,
        isFullyPaid,
        totalHireFee: po.totalHireFee,
        totalDepositHeld: po.totalDepositHeld,
        itemsCount: po.items.length
      });

      setBrevoEmailData({
        poId: po.id,
        toEmail: po.customerEmail,
        toName: po.customerName,
        subject: `Your Highland Rigout (${po.id}) is Ready for Collection!`,
        htmlContent: emailHtml,
        statusMsg: isFullyPaid ? 'Order fully paid. Ready for customer collection.' : 'Outstanding balance due upon collection.'
      });
      setShowBrevoEmailModal(true);
    } catch (err: any) {
      showToast(`Failed to update order status: ${err.message}`, 'warning');
    }
  };

  const handleDispatchBrevoEmail = async () => {
    if (!brevoEmailData) return;
    setBrevoEmailData(prev => prev ? { ...prev, isSending: true } : null);

    const result = await sendBrevoEmail({
      toEmail: brevoEmailData.toEmail,
      toName: brevoEmailData.toName,
      subject: brevoEmailData.subject,
      htmlContent: brevoEmailData.htmlContent
    });

    if (result.success) {
      const targetPo = pos.find(p => p.id === brevoEmailData.poId);
      if (targetPo) {
        const updatedPo = { ...targetPo, readyNotificationSentAt: new Date().toISOString().replace('T', ' ').slice(0, 16) };
        await upsertPurchaseOrder(updatedPo);
        setPos(prev => prev.map(p => p.id === targetPo.id ? updatedPo : p));
      }
      addAuditLog('SENT_BREVO_CUSTOMER_EMAIL', `Dispatched Brevo customer notification to ${brevoEmailData.toEmail} for ${brevoEmailData.poId}`, brevoEmailData.poId);
      showToast(`✉️ Customer notification email dispatched via Brevo! (${result.messageId || 'sent'})`, 'success');
      setShowBrevoEmailModal(false);
    } else {
      showToast(`Brevo Email Note: ${result.error}`, 'warning');
      setBrevoEmailData(prev => prev ? { ...prev, isSending: false } : null);
    }
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

  // Camera scanner handler & ZXing BrowserMultiFormatReader decode loop
  // IScannerControls is returned by decodeFromVideoDevice and has a .stop() method
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const toggleCamera = () => {
    if (activeCamera) {
      // Stop ZXing decode loop and release camera
      if (scanControlsRef.current) {
        scanControlsRef.current.stop();
        scanControlsRef.current = null;
      }
      setActiveCamera(false);
      return;
    }
    setActiveCamera(true);
  };

  // ZXing REAL-TIME QR DECODER WITH HARDWARE + CSS ZOOM & DUAL ENGINE
  useEffect(() => {
    if (!activeCamera) return;
    if (!videoRef.current) return;

    let stopped = false;
    let fallbackInterval: NodeJS.Timeout | null = null;
    const videoEl = videoRef.current;

    // Hints: QR-only for speed, TRY_HARDER for small printed iron-on labels
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
    });

    // Helper: apply hardware zoom & autofocus constraints if stream active
    const applyTrackConstraints = (stream: MediaStream) => {
      try {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = (track.getCapabilities && track.getCapabilities()) as any;
          if (caps) {
            const constraints: any = { advanced: [] };
            if (caps.zoom) {
              const minZ = caps.zoom.min || 1;
              const maxZ = caps.zoom.max || 5;
              const targetZ = Math.min(maxZ, Math.max(minZ, zoomLevel));
              constraints.advanced.push({ zoom: targetZ });
            }
            if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              constraints.advanced.push({ focusMode: 'continuous' });
            }
            if (constraints.advanced.length > 0) {
              track.applyConstraints(constraints).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('Track constraint note:', err);
      }
    };

    // List available video devices for selector dropdown
    BrowserMultiFormatReader.listVideoInputDevices()
      .then(devices => {
        if (!stopped && devices.length > 0) {
          setCameraDevices(devices);
          // If no selected device yet, prefer back/environment camera
          if (!selectedDeviceId) {
            const backCam = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('0')
            );
            if (backCam) setSelectedDeviceId(backCam.deviceId);
          }
        }
      })
      .catch(() => {});

    // Target device ID or undefined for default back camera
    const deviceToUse = selectedDeviceId || undefined;

    reader.decodeFromVideoDevice(
      deviceToUse,
      videoEl,
      (result, _error, controls) => {
        if (controls && !scanControlsRef.current) {
          scanControlsRef.current = controls;
        }

        // Apply hardware track zoom
        if (videoEl.srcObject instanceof MediaStream) {
          applyTrackConstraints(videoEl.srcObject);
        }

        if (result && !stopped) {
          const cleanQr = result.getText().trim();
          const now = Date.now();
          if (cleanQr && now - lastScanTimeRef.current > 2000) {
            lastScanTimeRef.current = now;
            handleScanCode(cleanQr);
          }
        }
      }
    ).catch(err => {
      console.warn('decodeFromVideoDevice note:', err);
    });

    // Offscreen Canvas Fallback Frame Processor (runs every 150ms)
    const offscreenCanvas = document.createElement('canvas');
    const canvasCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    fallbackInterval = setInterval(() => {
      if (stopped || !videoEl || videoEl.readyState < 2) return;
      try {
        const vw = videoEl.videoWidth || 640;
        const vh = videoEl.videoHeight || 480;
        offscreenCanvas.width = vw;
        offscreenCanvas.height = vh;
        if (canvasCtx) {
          canvasCtx.drawImage(videoEl, 0, 0, vw, vh);
          const result = reader.decodeFromCanvas(offscreenCanvas);
          if (result && !stopped) {
            const cleanQr = result.getText().trim();
            const now = Date.now();
            if (cleanQr && now - lastScanTimeRef.current > 2000) {
              lastScanTimeRef.current = now;
              handleScanCode(cleanQr);
            }
          }
        }
      } catch {
        /* no QR code found in canvas frame — normal */
      }
    }, 150);

    return () => {
      stopped = true;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (scanControlsRef.current) {
        scanControlsRef.current.stop();
        scanControlsRef.current = null;
      }
    };
  }, [activeCamera, selectedDeviceId, zoomLevel]);

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
    setScanError('');
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
    } else {
      // Not found in inventory at all — show unrecognised error
      setScanError(cleanCode);
      showToast(`⚠️ QR code "${cleanCode}" not recognised — not in your inventory.`, 'warning');
    }
  };

  // OPEN MULTI-ITEM PO RETURN CHECKLIST WITH STRICT QR SCAN VERIFICATION
  const openPoReturnChecklist = (po: PurchaseOrder, triggerQrCode?: string) => {
    setActiveReturnPo(po);
    const initialChecklist: Record<string, { condition: 'GOOD_CLEAN' | 'NEEDS_CLEANING' | 'NEEDS_REPAIR' | 'MISSING'; scanned: boolean; notes: string }> = {};

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

  // Step 5: Confirm Dry Cleaning / Laundry Completed
  const handleConfirmLaundryCleaned = (codeId: string) => {
    if (!currentUser) return;
    const item = items.find(i => i.id === codeId);
    if (!item) return;

    setItems(prev => prev.map(i => {
      if (i.id === codeId) {
        const history = i.laundryHistory || [];
        const updatedHistory = history.map((h, idx) => {
          if (idx === 0) {
            return {
              ...h,
              dateReturned: new Date().toISOString().replace('T', ' ').slice(0, 16),
              returnedByStaff: currentUser.name,
              notes: 'Dry cleaned & ready for rotation.'
            };
          }
          return h;
        });
        return {
          ...i,
          status: 'AVAILABLE',
          laundryHistory: updatedHistory
        };
      }
      return i;
    }));

    addAuditLog('LAUNDRY_COMPLETED', `Confirmed dry cleaning completed for ${item.name} (${item.id}). Returned to stock.`, item.id);
    showToast(`✨ Laundry/Dry cleaning completed for ${item.id}. Returned to Available Stock!`, 'success');
  };

  // Manual Send Item to Dry Cleaners (Shop Floor Assistant Action)
  const handleManualSendToLaundry = (codeId: string) => {
    if (!currentUser) return;
    const item = items.find(i => i.id === codeId);
    if (!item) return;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newRecord: LaundryRecord = {
      id: `LAUN-${Date.now()}`,
      dateSent: now,
      sentByStaff: currentUser.name,
      notes: 'Manually sent to dry cleaners from store floor'
    };

    setItems(prev => prev.map(i => {
      if (i.id === codeId) {
        return {
          ...i,
          status: 'NEEDS_CLEANING',
          laundryHistory: [newRecord, ...(i.laundryHistory || [])]
        };
      }
      return i;
    }));

    addAuditLog('SENT_TO_LAUNDRY', `Manually sent ${item.name} (${item.id}) to dry cleaners.`, item.id);
    showToast(`🧼 Sent ${item.name} (${item.id}) to Dry Cleaners. Tracked in Laundry tab!`, 'info');
  };

  // Add new Tartan / Colour to Master Catalog
  const handleAddCustomTartan = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newTartanInput.trim();
    if (!cleanName) return;
    if (tartanList.some(t => t.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`⚠️ "${cleanName}" already exists in the Tartan Catalog.`, 'warning');
      return;
    }
    setTartanList(prev => [...prev, cleanName]);
    setNewTartanInput('');
    addAuditLog('ADDED_TARTAN', `Added new custom Tartan/Colour "${cleanName}" to product catalog.`);
    showToast(`✨ Added "${cleanName}" to Tartan & Colour Catalog!`, 'success');
  };

  // Delete custom Tartan from catalog
  const handleDeleteCustomTartan = (tartanName: string) => {
    if (tartanList.length <= 1) {
      showToast(`⚠️ At least one Tartan/Colour must remain in the catalog.`, 'warning');
      return;
    }
    setTartanList(prev => prev.filter(t => t !== tartanName));
    addAuditLog('DELETED_TARTAN', `Removed Tartan/Colour "${tartanName}" from product catalog.`);
    showToast(`Deleted "${tartanName}" from catalog.`, 'info');
  };

  // Update Bulk Bin Pool Quantity
  const handleUpdateBulkBinQuantity = (binId: string, newTotal: number, newAvailable: number) => {
    setItems(prev => prev.map(i => {
      if (i.id === binId) {
        return {
          ...i,
          bulkTotal: Math.max(0, newTotal),
          bulkQuantity: Math.max(0, newAvailable)
        };
      }
      return i;
    }));
    addAuditLog('UPDATED_BULK_BIN', `Updated bulk storage bin (${binId}): ${newAvailable} available / ${newTotal} total.`, binId);
    showToast(`📦 Adjusted ${binId} bin pool count to ${newAvailable} available.`, 'success');
  };

  // Bulk Confirm All Items at Dry Cleaners Cleaned & Available
  const handleBulkConfirmLaundryCleaned = () => {
    if (!currentUser) return;
    const cleaningItems = items.filter(i => i.status === 'NEEDS_CLEANING');
    if (cleaningItems.length === 0) return;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setItems(prev => prev.map(i => {
      if (i.status === 'NEEDS_CLEANING') {
        const history = i.laundryHistory || [];
        const updatedHistory = history.map((h, idx) => {
          if (idx === 0) {
            return {
              ...h,
              dateReturned: now,
              returnedByStaff: currentUser.name,
              notes: 'Bulk confirmed dry cleaned & ready for rotation.'
            };
          }
          return h;
        });
        return {
          ...i,
          status: 'AVAILABLE',
          laundryHistory: updatedHistory
        };
      }
      return i;
    }));

    addAuditLog('BULK_LAUNDRY_COMPLETED', `Confirmed dry cleaning completed for ${cleaningItems.length} garment(s). Returned to stock.`);
    showToast(`✨ Bulk confirmed ${cleaningItems.length} garment(s) clean and back in Available Stock!`, 'success');
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
      } else if (cond === 'NEEDS_CLEANING') {
        totalRefundedDeposit += li.depositAmount;
        // Update item in stock to NEEDS_CLEANING
        const laundryEntry = {
          id: `LAUN-${Date.now().toString().slice(-4)}`,
          dateSent: now,
          sentByStaff: currentUser.name,
          notes: `Sent to dry cleaning after return from PO ${activeReturnPo.id}`
        };
        setItems(prev => prev.map(i => i.id === li.qrCodeId ? { 
          ...i, 
          status: 'NEEDS_CLEANING', 
          currentPoId: undefined,
          laundryHistory: [laundryEntry, ...(i.laundryHistory || [])]
        } : i));
        return {
          ...li,
          returned: true,
          returnedAt: now,
          returnCondition: 'NEEDS_CLEANING',
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
      orderStatus: 'OUT_ON_HIRE',
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
  const assemblyDuePos = pos.filter(p => p.orderStatus === 'ASSEMBLY_DUE' || p.orderStatus === 'DEPOSIT_PAID_CONFIRMED' || p.orderStatus === 'RESERVED_PENDING_PAYMENT');

  // Filtered items helper for shop assistant tabs (with Demographic Adults vs Kids filter, Category filter & Tartan filter)
  const getFilteredItems = (
    targetList: KiltItem[], 
    sizeFilter: 'ALL' | 'Adult' | 'Kid' = 'ALL',
    categoryFilter: string = 'ALL',
    tartanFilter: string = 'ALL'
  ) => {
    let result = targetList.filter(i => i.status !== 'RETIRED');

    if (sizeFilter !== 'ALL') {
      result = result.filter(i => i.sizeGroup === sizeFilter);
    }

    if (categoryFilter !== 'ALL') {
      result = result.filter(i => i.category === categoryFilter);
    }

    if (tartanFilter !== 'ALL') {
      result = result.filter(i => i.tartanOrColour === tartanFilter);
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
    { id: 'start_fitting', label: 'Start New Fitting & Order', icon: User, badge: 'New Order', restricted: false },
    { id: 'scanner', label: 'QR Scanner & Actions', icon: QrCode, badge: scItem ? '1 Active' : null, restricted: false },
    { id: 'pricing', label: 'Pricing Settings Matrix', icon: PriceTag, badge: 'Adult & Kids', restricted: !isMasterAdmin },
    { id: 'batches', label: 'QR Batch Printing', icon: Printer, badge: `${batches.length} Batches`, restricted: !isMasterAdmin },
    { id: 'inventory', label: 'Stock Inventory', icon: Layers, badge: `${items.filter(i=>i.status!=='RETIRED').length}`, restricted: false },
    { id: 'pos', label: 'Hire POs & PayPal', icon: CreditCard, badge: `${pos.length}`, restricted: false },
    { id: 'laundry', label: 'Dry Cleaning Laundry', icon: Sparkles, badge: `${items.filter(i=>i.status==='NEEDS_CLEANING').length}`, restricted: false },
    { id: 'repairs', label: 'In Repair / Workshop', icon: Wrench, badge: `${items.filter(i=>i.status==='IN_REPAIR').length}`, restricted: false },
    { id: 'analytics', label: 'Master Admin Analytics', icon: BarChart3, badge: 'ROI & Revenue', restricted: !isMasterAdmin },
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
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl overflow-hidden shadow-lg border-2 border-amber-500/40">
              <img src="/logo.png" alt="Highland Kilt Hire" className="w-full h-full object-cover" />
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
                <label className="block text-slate-700 font-extrabold mb-1">Staff Password / PIN</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input 
                    type={showLoginPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password or PIN code"
                    value={loginPin}
                    onChange={e => setLoginPin(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-700 transition"
                    title={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">Stay connected on this device</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition"
              >
                Sign In to Back Office
              </button>


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
                <label className="block text-slate-700 font-extrabold mb-1">Account Password <span className="text-slate-500 font-normal">(min 6 characters)</span></label>
                <div className="relative">
                  <input 
                    type={showRegPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Set a secure login password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-700 transition"
                    title={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Override PIN Code <span className="text-slate-500 font-normal">(4 digits — for in-app actions)</span></label>
                <input 
                  type="password"
                  required
                  placeholder="Set 4-digit PIN"
                  value={regPin}
                  onChange={e => setRegPin(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl shadow-md transition"
              >
                Validate Invite & Create Account
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
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md border border-amber-500/40 shrink-0">
                <img src="/logo.png" alt="Highland Kilt Hire Logo" className="w-full h-full object-cover" />
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
                  <span>In Repair / Cleaners</span>
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

              <button
                onClick={() => setAssistantTab('calendar')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  assistantTab === 'calendar' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Availability Calendar</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-amber-100 text-amber-900">
                  {pos.filter(p => !p.items.every(i => i.returned)).length} Active Hires
                </span>
              </button>
            </nav>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div 
              onClick={handleOpenMyAccount}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition group"
              title="Click to open My Account Settings"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-sm flex items-center justify-center shadow-sm relative shrink-0">
                {currentUser.name.charAt(0)}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate max-w-[120px] group-hover:text-amber-700 transition">{currentUser.name}</span>
                <span className="text-[10px] text-amber-700 font-semibold block">{currentUser.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleOpenMyAccount}
                title="My Account Settings"
                className="p-2 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition"
              >
                <UserCog className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentUser(null)}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>



          {!isStandalone && (
            <button 
              onClick={handleInstallApp}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition mb-2"
            >
              <Smartphone className="w-4 h-4 text-indigo-200" /> Install App to Device
            </button>
          )}

          <button 
            onClick={() => setShowUserGuideModal(true)}
            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition mb-2"
          >
            <BookOpen className="w-4 h-4 text-slate-950" /> Staff Operations Guide
          </button>

{currentUser?.role === 'Master Admin' && (
          <button 
            onClick={handleResetData}
            className="w-full py-2 bg-white hover:bg-slate-100 text-slate-500 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Mock Data
          </button>
          )}
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* MAIN WORKSPACE */}
      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
        
        {/* PWA INSTALL TOP BANNER */}
        {!isStandalone && !installDismissed && (
          <div className="no-print bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 border-b border-indigo-900 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 sm:p-2 bg-indigo-600/60 rounded-xl text-indigo-200 border border-indigo-500/40 shrink-0">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-xs sm:text-sm tracking-tight truncate">Install Highland Kilt Hire</span>
                  <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-amber-500 text-slate-950 rounded-full">PWA App</span>
                </div>
                <p className="text-[11px] sm:text-xs text-indigo-200/80 hidden sm:block">Install to your phone home screen for 1-tap launch, camera scanner & offline access.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              <button
                onClick={handleInstallApp}
                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1 border border-indigo-400/30 shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-indigo-100" />
                <span>Install</span>
              </button>
              <button
                onClick={handleDismissBanner}
                className="p-1 text-indigo-300 hover:text-white hover:bg-white/10 rounded-lg transition text-xs shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 shadow-sm max-w-full overflow-x-hidden">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 rounded-xl shrink-0 border border-slate-200"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-semibold text-slate-500 truncate">
                <span className="hidden sm:inline">Highland Kilt Hire</span>
                <ChevronRight className="w-3 h-3 text-slate-400 hidden sm:inline" />
                <span className="text-amber-700 font-bold truncate">
                  {interfaceMode === 'shop_assistant' 
                    ? `Shop (${assistantTab.toUpperCase().replace('_', ' ')})` 
                    : NAV_ITEMS.find(n => n.id === activeTab)?.label}
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 truncate leading-tight">
                {interfaceMode === 'shop_assistant' 
                  ? assistantTab === 'scanner' ? 'QR Scanner'
                    : assistantTab === 'in_stock' ? 'In Stock'
                    : assistantTab === 'on_hire' ? 'On Hire'
                    : assistantTab === 'in_repair' ? 'In Repair'
                    : 'Customer POs'
                  : NAV_ITEMS.find(n => n.id === activeTab)?.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {!isStandalone && (
              <button
                onClick={handleInstallApp}
                className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-full shadow-sm transition flex items-center gap-1 shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
                <span className="hidden sm:inline">Install App</span>
                <span className="sm:hidden text-[11px]">Install</span>
              </button>
            )}

            <button
              onClick={() => setInterfaceMode(interfaceMode === 'admin_portal' ? 'shop_assistant' : 'admin_portal')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1 shrink-0 border shadow-sm transition ${
                interfaceMode === 'shop_assistant'
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : 'bg-amber-100 border-amber-300 text-amber-900'
              }`}
            >
              {interfaceMode === 'shop_assistant' ? <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
              <span className="hidden sm:inline">{interfaceMode === 'shop_assistant' ? 'Switch to Full Admin' : 'Switch to Shop Assistant'}</span>
              <span className="sm:hidden text-[11px]">{interfaceMode === 'shop_assistant' ? 'Admin' : 'Shop Mode'}</span>
            </button>

            <button
              onClick={handleOpenMyAccount}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white rounded-full font-extrabold text-xs shadow-sm transition shrink-0 border border-slate-800"
              title="My Account Settings"
            >
              <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <span className="hidden lg:inline">{currentUser.name}</span>
              <UserCog className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </button>
          </div>
        </header>

        <main className="p-3 sm:p-6 max-w-7xl mx-auto w-full flex-1 min-w-0 overflow-x-hidden">

          {/* ========================================================= */}
          {/* SHOP ASSISTANT AUTOMATED FLOOR TERMINAL MODE */}
          {/* ========================================================= */}
          {interfaceMode === 'shop_assistant' && (
            <div className="space-y-6">
              
              {/* SHOP ASSISTANT QUICK STATUS FILTER TABS */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleOpenStartFitting}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'start_fitting' 
                        ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400' 
                        : 'bg-amber-100/90 text-amber-950 hover:bg-amber-200 border border-amber-300'
                    }`}
                  >
                    <User className="w-4 h-4 text-amber-900" /> Start New Fitting & Order
                  </button>

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
                    <Wrench className="w-4 h-4" /> In Repair / Cleaners
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'in_repair' ? 'bg-white text-rose-900' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {inRepairItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAssistantTab('needs_cleaning')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'needs_cleaning' 
                        ? 'bg-cyan-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-cyan-300" /> At Dry Cleaners
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'needs_cleaning' ? 'bg-white text-cyan-900' : 'bg-cyan-100 text-cyan-800'
                    }`}>
                      {items.filter(i => i.status === 'NEEDS_CLEANING').length}
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

                  <button
                    onClick={() => setAssistantTab('calendar')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                      assistantTab === 'calendar' 
                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar className="w-4 h-4" /> Availability Calendar
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      assistantTab === 'calendar' ? 'bg-slate-950 text-amber-400' : 'bg-amber-100 text-amber-900'
                    }`}>
                      📅 Live
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
                  {/* DUAL-MODE SMART SCANNER BANNER */}
                  <div className="bg-gradient-to-r from-emerald-700 via-slate-900 to-amber-900 text-white rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-[11px] font-extrabold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> Zero-Friction Multi-Mode Smart Scanner
                        </span>
                        <h2 className="text-xl font-extrabold tracking-tight">Zero-Friction Smart QR Scanner — Outgoing Hires & Returns</h2>
                        <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
                          Handles <strong>BOTH Outgoing Customer Hires</strong> (Scan items to build bag, then enter customer details) and <strong>Customer Bag Returns</strong>!
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setIsAssemblyMode(true);
                            setNewPoForm({
                              customerName: '',
                              customerEmail: '',
                              customerPhone: '',
                              eventDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                              hireStartDate: new Date().toISOString().split('T')[0],
                              hireEndDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
                              notes: '',
                              selectedItemIds: []
                            });
                            if (!activeCamera) toggleCamera();
                            showToast(`⚡ Started New Order Bag Assembly! Aim camera & scan garments...`, 'info');
                          }}
                          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
                        >
                          <PlusCircle className="w-4 h-4" /> Start New Order (Scan ➔ Details)
                        </button>

                        <button
                          onClick={toggleCamera}
                          className="px-4 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5 transition"
                        >
                          <Camera className="w-4 h-4" />
                          {activeCamera ? 'Stop Camera' : 'Launch Camera'}
                        </button>
                      </div>
                    </div>

                    {/* LIVE EXPRESS BAG ASSEMBLY BAR */}
                    {(isAssemblyMode || newPoForm.selectedItemIds.length > 0) && (
                      <div className="bg-white/10 backdrop-blur border border-white/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mt-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-400 rounded-xl flex items-center justify-center text-slate-950 font-extrabold text-lg shadow-sm">
                            {newPoForm.selectedItemIds.length}
                          </div>
                          <div>
                            <span className="font-extrabold text-amber-300 text-xs block">⚡ Express Bag Assembly Active</span>
                            <span className="text-[11px] text-emerald-100 font-semibold block">
                              {newPoForm.selectedItemIds.length === 0 ? 'Aim camera to scan first garment...' : `${newPoForm.selectedItemIds.length} Item(s) Scanned into Bag (${newPoForm.selectedItemIds.join(', ')})`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (newPoForm.selectedItemIds.length === 0) {
                                showToast(`⚠️ Please scan at least 1 item into the bag first.`, 'warning');
                                return;
                              }
                              setIsAssemblyMode(false);
                              if (activeCamera) toggleCamera();
                              setShowCreatePoModal(true);
                            }}
                            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-800" /> Finish Scanning & Enter Customer Details
                          </button>

                          <button
                            onClick={() => {
                              setIsAssemblyMode(false);
                              setNewPoForm(prev => ({ ...prev, selectedItemIds: [] }));
                              showToast(`Cancelled bag assembly.`, 'info');
                            }}
                            className="px-3 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
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
                          <div className="space-y-2">
                            {/* SQUARE CAMERA VIEWPORT — WITH 25% ZOOM TRANSFORMATION */}
                            <div className="relative w-full aspect-square max-w-xs mx-auto rounded-2xl overflow-hidden bg-black border-4 border-emerald-500 shadow-md">
                              <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }} 
                                className="w-full h-full object-cover transition-transform duration-200" 
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative w-52 h-52">
                                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                                </div>
                              </div>
                            </div>

                            {/* ZOOM & CAMERA CONTROLS TOOLBAR */}
                            <div className="bg-slate-900 text-white p-3 rounded-2xl space-y-2 border border-slate-800 shadow-md">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-amber-400 flex items-center gap-1">
                                  <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Camera Zoom:
                                </span>
                                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                                  {[1.0, 1.25, 1.5, 2.0].map(z => (
                                    <button
                                      key={z}
                                      type="button"
                                      onClick={() => setZoomLevel(z)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                                        zoomLevel === z 
                                          ? 'bg-amber-500 text-slate-950 shadow-sm' 
                                          : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                      }`}
                                    >
                                      {z === 1.25 ? '1.25x ★' : `${z}x`}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {cameraDevices.length > 1 && (
                                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                                  <span className="text-slate-400 font-semibold">Select Lens:</span>
                                  <select
                                    value={selectedDeviceId}
                                    onChange={e => setSelectedDeviceId(e.target.value)}
                                    className="bg-slate-800 text-amber-400 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold outline-none max-w-[170px] truncate"
                                  >
                                    {cameraDevices.map((d, idx) => (
                                      <option key={d.deviceId || idx} value={d.deviceId}>
                                        {d.label || `Camera ${idx + 1}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* STATUS + INSTRUCTION BELOW CAMERA */}
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[11px] font-semibold text-slate-600">Centre QR label inside amber frame</span>
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 animate-pulse">🟢 Scanning...</span>
                            </div>
                            {scanError && (
                              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                                <span className="text-rose-600 text-xs font-bold">⚠️ Unrecognised QR Code:</span>
                                <span className="text-rose-700 text-xs font-mono font-bold">{scanError}</span>
                                <button onClick={() => setScanError('')} className="ml-auto text-rose-400 hover:text-rose-600 text-sm leading-none">✕</button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                              <QrCode className="w-7 h-7" />
                            </div>
                            <p className="text-xs font-semibold text-slate-700 mb-1">Click below or aim camera to scan an iron-on QR label:</p>
                          </div>
                        )}

                        <div className="space-y-3 pt-2">
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="Manual QR entry — or use camera above"
                              value={simulatedInput}
                              onChange={e => setSimulatedInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { handleScanCode(simulatedInput); setSimulatedInput(''); }
                              }}
                              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                            />
                            <button
                              onClick={() => { handleScanCode(simulatedInput); setSimulatedInput(''); }}
                              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs shadow transition"
                            >
                              Scan
                            </button>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                            <p className="font-bold text-slate-800 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-amber-600" /> How to Scan</p>
                            <ul className="list-disc list-inside space-y-1 text-[11px]">
                              <li>Click <strong>Start Camera</strong> above and point at an iron-on QR label</li>
                              <li>Hold steady inside the amber square frame — it scans automatically</li>
                              <li>Or connect a USB barcode scanner gun and scan directly into the text field</li>
                              <li>Each scan triggers the correct action based on garment status</li>
                            </ul>
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

                              {/* OPTION C: SEND TO DRY CLEANERS */}
                              <button
                                onClick={() => handleManualSendToLaundry(scItem.id)}
                                className="w-full p-3 bg-cyan-50 border border-cyan-300 hover:bg-cyan-100 rounded-xl text-left transition shadow-sm group flex items-center gap-3"
                              >
                                <div className="p-2 bg-cyan-600 text-white rounded-lg group-hover:scale-105 transition">
                                  <Sparkles className="w-4 h-4 text-cyan-200" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-cyan-950 text-xs">Option C: Send Garment to Dry Cleaners</h4>
                                  <p className="text-[10px] text-cyan-800">Dispatch item for professional dry cleaning</p>
                                </div>
                              </button>

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

                          {scItem && scItem.status === 'NEEDS_CLEANING' && (
                            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5 space-y-4">
                              <div className="flex items-center gap-2 text-cyan-950 font-bold text-sm">
                                <Sparkles className="w-5 h-5 text-cyan-600" /> Item Currently Out at Dry Cleaners
                              </div>
                              
                              {scItem.laundryHistory && scItem.laundryHistory.length > 0 && (
                                <div className="bg-white p-3 rounded-lg text-xs space-y-1 border border-cyan-100 shadow-sm text-slate-700">
                                  <p><span className="text-slate-500">Sent to Laundry:</span> <strong>{scItem.laundryHistory[0].dateSent}</strong> by {scItem.laundryHistory[0].sentByStaff}</p>
                                  <p><span className="text-slate-500">Dispatch Notes:</span> {scItem.laundryHistory[0].notes || 'Regular laundry cycle'}</p>
                                </div>
                              )}

                              <button
                                onClick={() => handleConfirmLaundryCleaned(scItem.id)}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Confirm Returned Clean & Back in Available Stock
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

              {/* FULL PAGE: DEDICATED CUSTOMER FITTING & MEASUREMENT STATION */}
              {(assistantTab === 'start_fitting' || activeTab === 'start_fitting') && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in zoom-in-95">
                  
                  {/* STATION HEADER BANNER */}
                  <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 text-white rounded-2xl p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-[11px] font-extrabold uppercase tracking-wider text-amber-200 inline-flex items-center gap-1">
                        📏 In-Store Floor Station
                      </span>
                      <h2 className="text-2xl font-extrabold tracking-tight text-white">Customer Fitting & Measurement Station</h2>
                      <p className="text-xs text-amber-100 max-w-2xl leading-relaxed">
                        Record customer measurements, explore live fit-matched store inventory in real-time, and issue a PayPal invoice link or record in-store deposit.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenStartFitting}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Clear Form
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAssistantTab('scanner'); setActiveTab('scanner'); }}
                        className="px-4 py-2 bg-slate-950 hover:bg-black text-amber-400 font-extrabold text-xs rounded-xl border border-amber-500/30 transition flex items-center gap-1.5"
                      >
                        ✕ Exit Station
                      </button>
                    </div>
                  </div>

                  {/* FITTING FORM WORKSPACE */}
                  <form onSubmit={handleSaveFittingSubmit} className="space-y-6 text-xs">
                    
                    {/* SECTION 1: CUSTOMER & EVENT DETAILS */}
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm border-b border-slate-200 pb-2">
                        <User className="w-4 h-4 text-amber-600" /> Step 1: Customer & Event Information
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                        <div>
                          <label className="block text-slate-700 font-extrabold mb-1">Customer Full Name *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Fiona Sinclair"
                            value={fittingForm.customerName}
                            onChange={e => setFittingForm({ ...fittingForm, customerName: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-extrabold mb-1">Email Address *</label>
                          <input 
                            type="email" 
                            required
                            placeholder="e.g. fiona@example.com"
                            value={fittingForm.customerEmail}
                            onChange={e => setFittingForm({ ...fittingForm, customerEmail: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-extrabold mb-1">Mobile Phone *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. 07700 900123"
                            value={fittingForm.customerPhone}
                            onChange={e => setFittingForm({ ...fittingForm, customerPhone: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-extrabold mb-1">Collection Date *</label>
                          <input 
                            type="date" 
                            required
                            value={fittingForm.collectionDate}
                            onChange={e => setFittingForm({ ...fittingForm, collectionDate: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-extrabold mb-1">Event / Function Date *</label>
                          <input 
                            type="date" 
                            required
                            value={fittingForm.eventDate}
                            onChange={e => {
                              const newEv = e.target.value;
                              const autoRet = new Date(new Date(newEv).getTime() + 2 * 86400000).toISOString().slice(0, 10);
                              setFittingForm({ ...fittingForm, eventDate: newEv, returnDate: autoRet });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-extrabold mb-1">Return Date *</label>
                          <input 
                            type="date" 
                            required
                            value={fittingForm.returnDate}
                            onChange={e => setFittingForm({ ...fittingForm, returnDate: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm text-xs text-amber-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: 6 PRECISE FITTING MEASUREMENTS */}
                    <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-2xl space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                          📏 Step 2: Precise Customer Fitting Measurements
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 bg-white px-2.5 py-0.5 rounded-full border border-amber-300">
                          Real-Time Fit Filter Active
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm text-center">
                          <label className="block text-slate-700 font-extrabold text-xs mb-1">Waist (in)</label>
                          <input 
                            type="number" 
                            min={20}
                            max={60}
                            value={fittingForm.waistInches}
                            onChange={e => setFittingForm({ ...fittingForm, waistInches: parseInt(e.target.value) || 34 })}
                            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-2 font-mono font-extrabold text-center text-lg text-amber-900 outline-none focus:border-amber-600 shadow-inner"
                          />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm text-center">
                          <label className="block text-slate-700 font-extrabold text-xs mb-1">Chest (in)</label>
                          <input 
                            type="number" 
                            min={20}
                            max={60}
                            value={fittingForm.chestInches}
                            onChange={e => setFittingForm({ ...fittingForm, chestInches: parseInt(e.target.value) || 42 })}
                            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-2 font-mono font-extrabold text-center text-lg text-amber-900 outline-none focus:border-amber-600 shadow-inner"
                          />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm text-center">
                          <label className="block text-slate-700 font-extrabold text-xs mb-1">Sleeve (in)</label>
                          <input 
                            type="number" 
                            min={15}
                            max={40}
                            value={fittingForm.sleeveLengthInches}
                            onChange={e => setFittingForm({ ...fittingForm, sleeveLengthInches: parseInt(e.target.value) || 25 })}
                            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-2 font-mono font-extrabold text-center text-lg text-amber-900 outline-none focus:border-amber-600 shadow-inner"
                          />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm text-center">
                          <label className="block text-slate-700 font-extrabold text-xs mb-1">Length (in)</label>
                          <input 
                            type="number" 
                            min={15}
                            max={40}
                            value={fittingForm.kiltLengthInches}
                            onChange={e => setFittingForm({ ...fittingForm, kiltLengthInches: parseInt(e.target.value) || 24 })}
                            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-2 font-mono font-extrabold text-center text-lg text-amber-900 outline-none focus:border-amber-600 shadow-inner"
                          />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm text-center">
                          <label className="block text-slate-700 font-extrabold text-xs mb-1">Shoe Size</label>
                          <input 
                            type="text" 
                            value={fittingForm.shoeSize}
                            onChange={e => setFittingForm({ ...fittingForm, shoeSize: e.target.value })}
                            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-2 font-mono font-extrabold text-center text-lg text-amber-900 outline-none focus:border-amber-600 shadow-inner"
                          />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm text-center">
                          <label className="block text-slate-700 font-extrabold text-xs mb-1">Height</label>
                          <input 
                            type="text" 
                            value={fittingForm.heightFtInches}
                            onChange={e => setFittingForm({ ...fittingForm, heightFtInches: e.target.value })}
                            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-2 font-mono font-extrabold text-center text-lg text-amber-900 outline-none focus:border-amber-600 shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: FIT-MATCHED AVAILABLE INVENTORY EXPLORER */}
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                          <Package className="w-4 h-4 text-emerald-600" /> Step 3: Fit-Matched Store Inventory (Waist {fittingForm.waistInches}", Chest {fittingForm.chestInches}")
                        </div>
                        <span className="text-xs font-extrabold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                          {fittingForm.selectedItemIds.length} Garments Selected for Outfit
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                        {availableItems.map(item => {
                          const isSelected = fittingForm.selectedItemIds.includes(item.id);
                          return (
                            <div key={item.id} className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-2 transition ${isSelected ? 'bg-amber-50 border-amber-400 shadow-md ring-2 ring-amber-400/50' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono font-extrabold text-amber-900 text-xs bg-amber-100 px-2 py-0.5 rounded border border-amber-300">{item.id}</span>
                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">In Stock</span>
                                </div>
                                <h4 className="font-extrabold text-slate-900 text-xs leading-snug">{item.name}</h4>
                                <p className="text-[11px] text-slate-500 mt-1">{item.category} • {item.tartanOrColour}</p>
                                <p className="text-[11px] font-bold text-amber-900 mt-0.5">Size: {item.size}</p>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="font-extrabold text-slate-900 text-xs">£{item.hireRate} <span className="text-[10px] text-slate-500 font-normal">/ period</span></span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setFittingForm(prev => ({ ...prev, selectedItemIds: prev.selectedItemIds.filter(id => id !== item.id) }));
                                    } else {
                                      setFittingForm(prev => ({ ...prev, selectedItemIds: [...prev.selectedItemIds, item.id] }));
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition flex items-center gap-1 ${isSelected ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
                                >
                                  {isSelected ? '✓ In Outfit' : '+ Add to Rigout'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SECTION 4: DEPOSIT PAYMENT & INVOICING OPTIONS */}
                    <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-amber-400" /> Step 4: Deposit & Invoicing Option
                        </span>
                        <span className="text-xs font-bold text-emerald-400">Rigout Hire Cap £120 Auto-Applied</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setFittingForm({ ...fittingForm, depositMethod: 'PAYPAL_ONLINE' })}
                          className={`p-4 rounded-2xl border font-bold text-left transition flex items-center justify-between ${
                            fittingForm.depositMethod === 'PAYPAL_ONLINE' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg ring-2 ring-amber-400/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                          }`}
                        >
                          <div>
                            <span className="block font-extrabold text-sm">🌐 Send PayPal Online Invoice Link</span>
                            <span className="text-xs opacity-90 block mt-1">Generates instant invoice link for customer to pay £60 deposit online at home</span>
                          </div>
                          {fittingForm.depositMethod === 'PAYPAL_ONLINE' && <CheckCircle2 className="w-6 h-6 shrink-0 ml-2" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setFittingForm({ ...fittingForm, depositMethod: 'IN_STORE_CASH' })}
                          className={`p-4 rounded-2xl border font-bold text-left transition flex items-center justify-between ${
                            fittingForm.depositMethod !== 'PAYPAL_ONLINE' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg ring-2 ring-amber-400/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                          }`}
                        >
                          <div>
                            <span className="block font-extrabold text-sm">🏪 Mark Deposit Paid In Store (£60)</span>
                            <span className="text-xs opacity-90 block mt-1">Recorded via Cash or Card in shop today — order confirmed immediately</span>
                          </div>
                          {fittingForm.depositMethod !== 'PAYPAL_ONLINE' && <CheckCircle2 className="w-6 h-6 shrink-0 ml-2" />}
                        </button>
                      </div>
                    </div>

                    {/* SUBMIT ACTION BAR */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => { setAssistantTab('scanner'); setActiveTab('scanner'); }}
                        className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                      >
                        Cancel & Exit Station
                      </button>

                      <button
                        type="submit"
                        className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm rounded-2xl shadow-xl transition flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" /> Save Fitting & Create Order Now
                      </button>
                    </div>

                  </form>
                </div>
              )}


              {assistantTab === 'in_stock' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-emerald-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" /> Garments Available in Store Right Now ({getFilteredItems(availableItems, assistantSizeFilter, assistantCategoryFilter, assistantTartanFilter).length})
                      </h3>
                      <p className="text-xs text-slate-500">Stock physically in shop available to hire immediately. Filter by Master Pricing Category & Demographic.</p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text"
                        placeholder="Search size, tartan, name, ID..."
                        value={assistantSearch}
                        onChange={e => setAssistantSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* MASTER PRICING MATRIX CATEGORY & AGE DEMOGRAPHIC FILTERS TOOLBAR */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <PriceTag className="w-4 h-4 text-amber-600" /> Master Category Pricing Matrix Filters
                      </span>
                      {(assistantSizeFilter !== 'ALL' || assistantCategoryFilter !== 'ALL' || assistantTartanFilter !== 'ALL' || assistantSearch) && (
                        <button
                          onClick={() => {
                            setAssistantSizeFilter('ALL');
                            setAssistantCategoryFilter('ALL');
                            setAssistantTartanFilter('ALL');
                            setAssistantSearch('');
                          }}
                          className="text-[11px] font-extrabold text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition"
                        >
                          🧹 Reset All Filters
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      
                      {/* 1. MASTER PRICING CATEGORY FILTER */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                          Product Category ({pricingMatrix.length} Types)
                        </label>
                        <select
                          value={assistantCategoryFilter}
                          onChange={e => setAssistantCategoryFilter(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-800 outline-none focus:border-amber-500 shadow-sm"
                        >
                          <option value="ALL">All Product Categories ({availableItems.length})</option>
                          {pricingMatrix.map(pm => {
                            const catCount = availableItems.filter(i => i.category === pm.category).length;
                            return (
                              <option key={pm.category} value={pm.category}>
                                {pm.category} ({catCount} in stock)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* 2. AGE DEMOGRAPHIC FILTER (ADULTS VS KIDS) */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                          Age Demographic (Adults vs Kids Matrix)
                        </label>
                        <div className="flex bg-white p-1 rounded-xl border border-slate-300 font-bold">
                          <button
                            onClick={() => setAssistantSizeFilter('ALL')}
                            className={`flex-1 py-1 rounded-lg text-center transition ${assistantSizeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            All Ages
                          </button>
                          <button
                            onClick={() => setAssistantSizeFilter('Adult')}
                            className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition ${assistantSizeFilter === 'Adult' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <User className="w-3 h-3" /> Adults
                          </button>
                          <button
                            onClick={() => setAssistantSizeFilter('Kid')}
                            className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition ${assistantSizeFilter === 'Kid' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <Baby className="w-3 h-3" /> Kids
                          </button>
                        </div>
                      </div>

                      {/* 3. TARTAN / COLOUR FILTER */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                          Tartan / Garment Colour
                        </label>
                        <select
                          value={assistantTartanFilter}
                          onChange={e => setAssistantTartanFilter(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-800 outline-none focus:border-amber-500 shadow-sm"
                        >
                          <option value="ALL">All Tartans & Colours</option>
                          {Array.from(new Set([...tartanList, ...availableItems.map(i => i.tartanOrColour).filter(Boolean)])).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                    </div>

                    {/* MATRIX RATES SUMMARY BADGE */}
                    {assistantCategoryFilter !== 'ALL' && (() => {
                      const matrixSetting = pricingMatrix.find(p => p.category === assistantCategoryFilter);
                      if (!matrixSetting) return null;
                      return (
                        <div className="bg-amber-100/90 border border-amber-300 p-2.5 rounded-xl text-[11px] font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2 mt-2">
                          <span>
                            🏷️ <strong>{matrixSetting.category} Pricing Matrix Rates:</strong>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                              <User className="w-3 h-3" /> Adult: £{matrixSetting.adultHireRate} Hire / £{matrixSetting.adultDeposit} Dep
                            </span>
                            <span className="bg-purple-600 text-white px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                              <Baby className="w-3 h-3" /> Kid: £{matrixSetting.kidHireRate} Hire / £{matrixSetting.kidDeposit} Dep
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getFilteredItems(availableItems, assistantSizeFilter, assistantCategoryFilter, assistantTartanFilter).map(item => (
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
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                            <span className="text-[10px] font-extrabold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                              {item.category}
                            </span>
                          </div>
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
                            <button
                              onClick={() => handleManualSendToLaundry(item.id)}
                              className="py-1.5 px-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] rounded-lg shadow-sm transition text-center col-span-2 flex items-center justify-center gap-1"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-200" /> Send to Dry Cleaners
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
                        <PackageCheck className="w-5 h-5 text-blue-600" /> Garments Currently On Hire With Customers ({getFilteredItems(onHireItems, assistantSizeFilter, assistantCategoryFilter, assistantTartanFilter).length})
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
                    {getFilteredItems(onHireItems, assistantSizeFilter, assistantCategoryFilter, assistantTartanFilter).map(item => {
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
                        <Wrench className="w-5 h-5 text-rose-600" /> Garments in Repair Workshop ({getFilteredItems(inRepairItems, assistantSizeFilter, assistantCategoryFilter, assistantTartanFilter).length})
                      </h3>
                      <p className="text-xs text-slate-500">Items undergoing maintenance or tailoring repair.</p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text"
                        placeholder="Search repair items..."
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

              {/* AT DRY CLEANERS TAB */}
              {assistantTab === 'needs_cleaning' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-cyan-950 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-600" /> Garments Out at Dry Cleaners ({items.filter(i => i.status === 'NEEDS_CLEANING').length})
                      </h3>
                      <p className="text-xs text-slate-500">Track garments currently being cleaned. Click confirm when laundered clean and ready in store.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {items.filter(i => i.status === 'NEEDS_CLEANING').length > 0 && (
                        <button
                          onClick={handleBulkConfirmLaundryCleaned}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Bulk Confirm All Clean & Back in Stock
                        </button>
                      )}
                    </div>
                  </div>

                  {items.filter(i => i.status === 'NEEDS_CLEANING').length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
                      🎉 No garments currently at dry cleaners. All garments are clean & in available stock!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getFilteredItems(items.filter(i => i.status === 'NEEDS_CLEANING'), assistantSizeFilter).map(item => {
                        const laun = item.laundryHistory?.[0];
                        return (
                          <div key={item.id} className="p-4 bg-cyan-50/60 border border-cyan-200 rounded-2xl space-y-2 transition shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-extrabold text-cyan-900 text-xs bg-white px-2 py-0.5 rounded border border-cyan-200">
                                  {item.id}
                                </span>
                                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                  {item.sizeGroup}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-full">
                                🧼 At Dry Cleaners
                              </span>
                            </div>

                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                              <p className="text-xs text-slate-600">{item.tartanOrColour} ({item.size})</p>
                            </div>

                            <div className="bg-white p-2.5 rounded-xl text-xs space-y-0.5 border border-cyan-100">
                              <p><span className="text-slate-500">Dispatched:</span> <strong>{laun?.dateSent}</strong> by {laun?.sentByStaff}</p>
                              <p><span className="text-slate-500">Notes:</span> {laun?.notes || 'Laundry cycle'}</p>
                            </div>

                            <button
                              onClick={() => handleConfirmLaundryCleaned(item.id)}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Clean & Back in Stock
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

              {/* SHOP ASSISTANT AVAILABILITY & BOOKING CALENDAR */}
              {assistantTab === 'calendar' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                  {/* CALENDAR HEADER & FILTER CONTROLS */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-amber-600" /> Customer Fittings & Booking Schedule Hub
                      </h3>
                      <p className="text-xs text-slate-500">
                        View all customer fittings, collection/event/return dates, pick outfit garments, and check live availability.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleOpenStartFitting}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                      >
                        <User className="w-4 h-4 text-slate-950" /> Start New Fitting & Order
                      </button>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Date</label>
                        <input 
                          type="date"
                          value={calSelectedDate}
                          onChange={e => setCalSelectedDate(e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Filter Tartan</label>
                        <select
                          value={calTartanFilter}
                          onChange={e => setCalTartanFilter(e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                        >
                          <option value="ALL">All Tartans & Colours</option>
                          {tartanList.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label>
                        <select
                          value={calCategoryFilter}
                          onChange={e => setCalCategoryFilter(e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                        >
                          <option value="ALL">All Categories</option>
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 1: CUSTOMER FITTINGS & HIRE BOOKINGS SCHEDULE */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        📅 Scheduled Customer Fitting Orders & Hires ({pos.length})
                      </h4>
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        Sorted by Collection Date
                      </span>
                    </div>

                    {pos.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
                        <Calendar className="w-10 h-10 text-amber-500 mx-auto" />
                        <p className="text-xs text-slate-500">No fitting orders found in the booking schedule.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {pos.map(po => {
                          const is7DayOverdue = new Date(po.hireStartDate).getTime() - Date.now() <= 7 * 86400000 && (po.paymentStatus === 'UNPAID' || po.paymentStatus === 'DEPOSIT_PENDING');

                          return (
                            <div key={po.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:border-amber-400 transition">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center shadow">
                                    {po.customerName.charAt(0)}
                                  </div>
                                  <div>
                                    <h5 className="font-extrabold text-slate-900 text-sm">{po.customerName}</h5>
                                    <p className="text-[11px] text-slate-500">{po.customerEmail} • {po.customerPhone}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-extrabold text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-amber-900">
                                    {po.id}
                                  </span>
                                  <span className={`px-2.5 py-1 text-xs font-extrabold rounded-full border ${
                                    po.orderStatus === 'READY_FOR_COLLECTION' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                    po.orderStatus === 'DEPOSIT_PAID_CONFIRMED' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                                    po.orderStatus === 'OUT_ON_HIRE' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                                    po.orderStatus === 'RETURNED_COMPLETED' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                                    'bg-amber-100 text-amber-900 border-amber-300'
                                  }`}>
                                    {po.orderStatus === 'READY_FOR_COLLECTION' ? '✓ Ready for Collection' :
                                     po.orderStatus === 'DEPOSIT_PAID_CONFIRMED' ? '🔒 Deposit Paid In Store' :
                                     po.orderStatus === 'OUT_ON_HIRE' ? '📦 Currently Out on Hire' :
                                     po.orderStatus === 'RETURNED_COMPLETED' ? '✓ Returned & Completed' :
                                     '⏳ Reserved — Pending PayPal Deposit'}
                                  </span>
                                  {is7DayOverdue && (
                                    <span className="px-2.5 py-1 text-xs font-extrabold bg-rose-100 text-rose-900 border border-rose-300 rounded-full flex items-center gap-1 animate-pulse">
                                      ⚠️ 7-Day Payment Due
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* ALL 3 KEY DATES BANNER */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-center">
                                <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                                  <span className="text-[10px] text-slate-500 block uppercase">Collection Date</span>
                                  <span className="text-amber-900 font-extrabold">{po.hireStartDate}</span>
                                </div>
                                <div className="bg-blue-50/80 p-2 rounded-lg border border-blue-200">
                                  <span className="text-[10px] text-slate-500 block uppercase">Event / Function Date</span>
                                  <span className="text-blue-900 font-extrabold">{po.eventDate}</span>
                                </div>
                                <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                                  <span className="text-[10px] text-slate-500 block uppercase">Return Date</span>
                                  <span className="text-emerald-900 font-extrabold">{po.hireEndDate}</span>
                                </div>
                              </div>

                              {/* FITTING MEASUREMENTS CARD */}
                              {po.measurements && (
                                <div className="bg-white border border-slate-200 p-2.5 rounded-xl space-y-1 text-xs">
                                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Customer Fitted Measurements:</span>
                                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-bold">
                                    <div className="bg-slate-50 p-1.5 rounded border">Waist: <span className="text-amber-800">{po.measurements.waistInches}"</span></div>
                                    <div className="bg-slate-50 p-1.5 rounded border">Chest: <span className="text-amber-800">{po.measurements.chestInches}"</span></div>
                                    <div className="bg-slate-50 p-1.5 rounded border">Sleeve: <span className="text-amber-800">{po.measurements.sleeveLengthInches}"</span></div>
                                    <div className="bg-slate-50 p-1.5 rounded border">Length: <span className="text-amber-800">{po.measurements.kiltLengthInches}"</span></div>
                                    <div className="bg-slate-50 p-1.5 rounded border">Shoe: <span className="text-amber-800">{po.measurements.shoeSize}</span></div>
                                    <div className="bg-slate-50 p-1.5 rounded border">Height: <span className="text-amber-800">{po.measurements.heightFtInches}</span></div>
                                  </div>
                                </div>
                              )}

                              {/* GARMENTS LIST */}
                              <div className="space-y-1.5">
                                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">Rigout Garment Items ({po.items.length} items):</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {po.items.map(li => {
                                    const itemDoc = items.find(i => i.id === li.qrCodeId);
                                    return (
                                      <div key={li.qrCodeId} className="bg-white border border-slate-200 p-2 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                          <span className="font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mr-1.5">{li.qrCodeId}</span>
                                          <span className="font-bold text-slate-900">{li.itemName}</span>
                                          <p className="text-[10px] text-slate-500">{li.category} ({li.size})</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${itemDoc?.status === 'ON_HIRE' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-100 text-slate-700'}`}>
                                          {itemDoc?.status === 'ON_HIRE' ? '✓ Allocated ON_HIRE' : '📦 In Store Shelf'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* ACTION BAR */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                                <div className="text-xs font-bold text-slate-700">
                                  Total Fee: <span className="text-amber-800">£{po.totalHireFee}</span> • Deposit Held: <span className="text-emerald-700">£{po.totalDepositHeld}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {po.orderStatus !== 'READY_FOR_COLLECTION' && po.orderStatus !== 'OUT_ON_HIRE' && po.orderStatus !== 'RETURNED_COMPLETED' && (
                                    <button
                                      onClick={() => handleMarkOrderReadyForCollection(po)}
                                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                                    >
                                      <CheckCircle2 className="w-4 h-4" /> Mark Ready for Collection
                                    </button>
                                  )}
                                  {po.readyNotificationSentAt && (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                      ✉️ Brevo Email Sent ({po.readyNotificationSentAt})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* REAL-TIME AVAILABILITY SUMMARY BANNER */}
                  {(() => {
                    const selDate = new Date(calSelectedDate);
                    selDate.setHours(0, 0, 0, 0);

                    // Find all POs active on calSelectedDate
                    const activePosOnDate = pos.filter(p => {
                      const start = new Date(p.hireStartDate);
                      const end = new Date(p.hireEndDate);
                      start.setHours(0, 0, 0, 0);
                      end.setHours(0, 0, 0, 0);
                      return selDate >= start && selDate <= end;
                    });

                    // Collect item IDs hired on this date
                    const hiredItemIdsOnDate = new Set<string>();
                    activePosOnDate.forEach(p => p.items.forEach(li => hiredItemIdsOnDate.add(li.qrCodeId)));

                    const filteredItems = items.filter(i => {
                      if (i.status === 'RETIRED') return false;
                      if (assistantSizeFilter !== 'ALL' && i.sizeGroup !== assistantSizeFilter) return false;
                      if (calTartanFilter !== 'ALL' && i.tartanOrColour !== calTartanFilter) return false;
                      if (calCategoryFilter !== 'ALL' && i.category !== calCategoryFilter) return false;
                      return true;
                    });

                    const availableCountOnDate = filteredItems.filter(i => !hiredItemIdsOnDate.has(i.id) && i.status !== 'IN_REPAIR' && i.status !== 'NEEDS_CLEANING').length;
                    const hiredCountOnDate = filteredItems.filter(i => hiredItemIdsOnDate.has(i.id)).length;

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Available for {calSelectedDate}
                            </span>
                            <span className="text-2xl font-extrabold text-emerald-950 block">{availableCountOnDate} Garments</span>
                            <span className="text-[10px] text-emerald-700 font-semibold">Ready in shop for immediate hire</span>
                          </div>

                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
                            <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                              <PackageCheck className="w-4 h-4 text-blue-600" /> Booked / On Hire
                            </span>
                            <span className="text-2xl font-extrabold text-blue-950 block">{hiredCountOnDate} Garments</span>
                            <span className="text-[10px] text-blue-700 font-semibold">Across {activePosOnDate.length} Customer Hires</span>
                          </div>

                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-amber-600" /> Active Hires On Date
                            </span>
                            <span className="text-2xl font-extrabold text-amber-950 block">{activePosOnDate.length} Customer POs</span>
                            <span className="text-[10px] text-amber-800 font-semibold">Scheduled for pickup/return</span>
                          </div>
                        </div>

                        {/* GARMENT AVAILABILITY MATRIX GRID */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-amber-600" /> Live Garment Availability Matrix for {calSelectedDate} ({filteredItems.length} Items)
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredItems.map(item => {
                              const isHiredOnDate = hiredItemIdsOnDate.has(item.id);
                              const activePo = activePosOnDate.find(p => p.items.some(li => li.qrCodeId === item.id));

                              return (
                                <div key={item.id} className={`p-4 rounded-2xl border space-y-2.5 transition shadow-sm ${
                                  isHiredOnDate ? 'bg-blue-50/80 border-blue-300' :
                                  item.status === 'IN_REPAIR' ? 'bg-rose-50/80 border-rose-300' :
                                  item.status === 'NEEDS_CLEANING' ? 'bg-cyan-50/80 border-cyan-300' :
                                  'bg-emerald-50/60 border-emerald-300'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-extrabold text-slate-900 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {item.id}
                                      </span>
                                      <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                        {item.sizeGroup}
                                      </span>
                                    </div>

                                    <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
                                      isHiredOnDate ? 'bg-blue-600 text-white border-blue-700' :
                                      item.status === 'IN_REPAIR' ? 'bg-rose-600 text-white border-rose-700' :
                                      item.status === 'NEEDS_CLEANING' ? 'bg-cyan-600 text-white border-cyan-700' :
                                      'bg-emerald-600 text-white border-emerald-700'
                                    }`}>
                                      {isHiredOnDate ? '🔒 BOOKED ON DATE' :
                                       item.status === 'IN_REPAIR' ? '🔧 IN REPAIR' :
                                       item.status === 'NEEDS_CLEANING' ? '🧼 LAUNDRY' :
                                       '🟢 AVAILABLE'}
                                    </span>
                                  </div>

                                  <div>
                                    <h4 className="font-bold text-slate-900 text-xs">{item.name}</h4>
                                    <p className="text-[11px] text-slate-600">{item.tartanOrColour} ({item.size})</p>
                                  </div>

                                  {isHiredOnDate && activePo && (
                                    <div className="bg-white p-2 rounded-xl text-[11px] space-y-0.5 border border-blue-200 text-slate-700 shadow-sm">
                                      <p><span className="text-slate-500">Customer:</span> <strong>{activePo.customerName}</strong></p>
                                      <p><span className="text-slate-500">PO Ref:</span> <span className="font-mono font-bold text-blue-700">{activePo.id}</span></p>
                                      <p><span className="text-slate-500">Hire Period:</span> {activePo.hireStartDate} to {activePo.hireEndDate}</p>
                                    </div>
                                  )}

                                  {!isHiredOnDate && item.status === 'AVAILABLE' && (
                                    <button
                                      onClick={() => {
                                        setNewPoForm(prev => ({
                                          ...prev,
                                          hireStartDate: calSelectedDate,
                                          hireEndDate: calSelectedDate,
                                          selectedItemIds: [item.id]
                                        }));
                                        setShowCreatePoModal(true);
                                      }}
                                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                                    >
                                      <PlusCircle className="w-3.5 h-3.5" /> Book Hire for {item.id}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* UPCOMING HIRE SCHEDULE LEDGER */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600" /> Upcoming Active Hires Schedule
                          </h4>

                          <div className="space-y-3">
                            {pos.map(p => (
                              <div key={p.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-amber-800 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">{p.id}</span>
                                    <span className="font-extrabold text-slate-900 text-xs">{p.customerName}</span>
                                    <span className="text-xs text-slate-500">({p.customerPhone})</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">
                                    <strong>Hire Dates:</strong> {p.hireStartDate} ➔ {p.hireEndDate} ({p.items.length} Items)
                                  </p>
                                </div>

                                <button
                                  onClick={() => openPoReturnChecklist(p)}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> View Return Checklist
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* FULL ADMIN BACK OFFICE PORTAL MODE */}
          {/* ========================================================= */}
          {interfaceMode === 'admin_portal' && (
            <>
              {/* TAB: PRICING SETTINGS MATRIX & PRODUCT CATALOG (ADULTS VS KIDS) */}
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
                      {/* TOP SUB-TAB SWITCHER: PRICING vs PRODUCTS */}
                      <div className="flex bg-slate-200 p-1.5 rounded-2xl border border-slate-300 w-fit">
                        <button
                          onClick={() => setPricingSubTab('PRICING')}
                          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                            pricingSubTab === 'PRICING'
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                          }`}
                        >
                          <PriceTag className="w-4 h-4" /> Category Hire Rates & Deposit Matrix
                        </button>

                        <button
                          onClick={() => setPricingSubTab('PRODUCTS')}
                          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                            pricingSubTab === 'PRODUCTS'
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                          }`}
                        >
                          <Tag className="w-4 h-4" /> Tartan & Product Catalog ({tartanList.length})
                        </button>
                      </div>

                      {pricingSubTab === 'PRICING' ? (
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
                                      <td className="py-3 px-4 bg-amber-50/30 border-l border-amber-100">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400">£</span>
                                          <input 
                                            type="number"
                                            min={0}
                                            value={setting.adultHireRate}
                                            onChange={e => handleUpdatePriceSetting(setting.category, 'adultHireRate', Number(e.target.value))}
                                            className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-amber-800 outline-none focus:border-amber-500 shadow-sm"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 bg-amber-50/30">
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
                                      <td className="py-3 px-4 bg-purple-50/30 border-l border-purple-100">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400">£</span>
                                          <input 
                                            type="number"
                                            min={0}
                                            value={setting.kidHireRate}
                                            onChange={e => handleUpdatePriceSetting(setting.category, 'kidHireRate', Number(e.target.value))}
                                            className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-purple-800 outline-none focus:border-purple-500 shadow-sm"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 bg-purple-50/30">
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
                      ) : (
                        /* PRODUCTS SUB-TAB: MASTER TARTANS & CATEGORY CATALOG MANAGER */
                        <div className="space-y-6">
                          {/* ADD NEW TARTAN CARD */}
                          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                              <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                  <Tag className="w-5 h-5 text-amber-600" /> Master Tartan & Colour Catalog
                                </h3>
                                <p className="text-xs text-slate-500">
                                  Manually add tartans and colours here. All dropdown filters across the app (Calendar, Stock Filters, Registration) populate automatically from this list!
                                </p>
                              </div>
                            </div>

                            <form onSubmit={handleAddCustomTartan} className="flex flex-wrap items-center gap-3">
                              <input 
                                type="text"
                                required
                                placeholder="Enter Tartan Name (e.g. Hebridean Heather, MacKenzie, Grey Granite)..."
                                value={newTartanInput}
                                onChange={e => setNewTartanInput(e.target.value)}
                                className="flex-1 min-w-[260px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                              />

                              <button
                                type="submit"
                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                              >
                                <PlusCircle className="w-4 h-4" /> Add Tartan / Colour to Catalog
                              </button>
                            </form>
                          </div>

                          {/* TARTAN CATALOG GRID */}
                          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-amber-600" /> Registered Tartans & Active Stock Count ({tartanList.length} Tartans)
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {tartanList.map(tartan => {
                                const itemCount = items.filter(i => i.tartanOrColour === tartan && i.status !== 'RETIRED').length;
                                return (
                                  <div key={tartan} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm hover:border-amber-300 transition">
                                    <div>
                                      <span className="font-bold text-slate-900 text-xs block">{tartan}</span>
                                      <span className="text-[10px] text-amber-800 font-bold block">{itemCount} Stock Garment(s)</span>
                                    </div>

                                    <button
                                      onClick={() => handleDeleteCustomTartan(tartan)}
                                      title={`Delete ${tartan}`}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* ITEM CATEGORIES OVERVIEW */}
                          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                              <Package className="w-4 h-4 text-amber-600" /> Outfit Categories ({CATEGORIES.length} Categories)
                            </h4>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                              {CATEGORIES.map(cat => {
                                const count = items.filter(i => i.category === cat && i.status !== 'RETIRED').length;
                                return (
                                  <div key={cat} className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl text-xs space-y-1">
                                    <span className="font-extrabold text-amber-950 block">{cat}</span>
                                    <span className="text-[10px] text-amber-800 font-semibold block">{count} Registered Items</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* BULK ACCESSORY MASTER STORAGE BINS */}
                          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                              <div>
                                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                  <Package className="w-4 h-4 text-amber-600" /> Bulk Storage Bins & Accessory Pools ({items.filter(i => i.isBulkPool).length} Master Bins)
                                </h4>
                                <p className="text-xs text-slate-500">
                                  Master storage boxes for non-serialized accessories (Sgian-dubhs, Kilt Pins, Belts & Buckles, Garters). Update stock pools or print bin stickers!
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {items.filter(i => i.isBulkPool).map(bin => {
                                const onHireCount = (bin.bulkTotal || 0) - (bin.bulkQuantity || 0);
                                return (
                                  <div key={bin.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-sm hover:border-amber-300 transition">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-extrabold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded text-xs border border-amber-300">
                                            {bin.id}
                                          </span>
                                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                                            {bin.category}
                                          </span>
                                        </div>
                                        <h5 className="font-bold text-slate-900 text-sm mt-1">{bin.name}</h5>
                                        <p className="text-xs text-slate-500">{bin.tartanOrColour}</p>
                                      </div>

                                      <div className="text-right">
                                        <span className="text-xs font-mono font-extrabold text-emerald-800 block">
                                          {bin.bulkQuantity} In Store
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-semibold">
                                          of {bin.bulkTotal} Total Pool
                                        </span>
                                      </div>
                                    </div>

                                    {/* STOCK POOL PROGRESS BAR */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                                        <span>Available Bin Stock:</span>
                                        <span>{bin.bulkQuantity} In Store | {onHireCount} Out on Hire</span>
                                      </div>
                                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                          className="h-full bg-emerald-500 transition-all duration-500"
                                          style={{ width: `${Math.min(100, Math.max(0, ((bin.bulkQuantity || 0) / (bin.bulkTotal || 1)) * 100))}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* QUICK ACTION BUTTONS */}
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        onClick={() => {
                                          const addStr = prompt(`Add new stock count to ${bin.name} (${bin.id}) total pool:`, '10');
                                          if (addStr && !isNaN(Number(addStr))) {
                                            const added = Number(addStr);
                                            handleUpdateBulkBinQuantity(bin.id, (bin.bulkTotal || 0) + added, (bin.bulkQuantity || 0) + added);
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" /> Add Stock to Pool
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedBatchForPrint({
                                            id: `BIN-STICKER-${bin.id}`,
                                            title: bin.name,
                                            category: bin.category,
                                            sizeGroup: 'Adult',
                                            count: 1,
                                            createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
                                            createdByName: currentUser?.name || 'Allan',
                                            qrCodes: [bin.id],
                                            isPrinted: false
                                          });
                                          setTimeout(() => window.print(), 300);
                                        }}
                                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1"
                                      >
                                        <Printer className="w-3.5 h-3.5 text-amber-600" /> Print Box Sticker
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
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
                        <div className="space-y-2">
                          {/* SQUARE CAMERA VIEWPORT — WITH 25% ZOOM TRANSFORMATION */}
                          <div className="relative w-full aspect-square max-w-xs mx-auto rounded-xl overflow-hidden bg-black border-2 border-amber-500 shadow-md">
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              muted 
                              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }} 
                              className="w-full h-full object-cover transition-transform duration-200" 
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="relative w-44 h-44">
                                <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                              </div>
                            </div>
                          </div>

                          {/* ZOOM & CAMERA CONTROLS TOOLBAR */}
                          <div className="bg-slate-900 text-white p-3 rounded-2xl space-y-2 border border-slate-800 shadow-md">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-amber-400 flex items-center gap-1">
                                <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Camera Zoom:
                              </span>
                              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                                {[1.0, 1.25, 1.5, 2.0].map(z => (
                                  <button
                                    key={z}
                                    type="button"
                                    onClick={() => setZoomLevel(z)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                                      zoomLevel === z 
                                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                    }`}
                                  >
                                    {z === 1.25 ? '1.25x ★' : `${z}x`}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {cameraDevices.length > 1 && (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                                <span className="text-slate-400 font-semibold">Select Lens:</span>
                                <select
                                  value={selectedDeviceId}
                                  onChange={e => setSelectedDeviceId(e.target.value)}
                                  className="bg-slate-800 text-amber-400 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold outline-none max-w-[170px] truncate"
                                >
                                  {cameraDevices.map((d, idx) => (
                                    <option key={d.deviceId || idx} value={d.deviceId}>
                                      {d.label || `Camera ${idx + 1}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* STATUS + INSTRUCTION BELOW CAMERA */}
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-semibold text-slate-600">Centre QR label inside amber frame</span>
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">🟢 Scanning...</span>
                          </div>
                          {scanError && (
                            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                              <span className="text-rose-600 text-xs font-bold">⚠️ Unrecognised QR Code:</span>
                              <span className="text-rose-700 text-xs font-mono font-bold">{scanError}</span>
                              <button onClick={() => setScanError('')} className="ml-auto text-rose-400 hover:text-rose-600 text-sm leading-none">✕</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                            <QrCode className="w-6 h-6" />
                          </div>
                          <p className="text-xs text-slate-600 mb-1 font-semibold">Click <strong>Use Camera</strong> above and point at an iron-on QR label.</p>
                          <p className="text-[11px] text-slate-400">Or type a QR code manually in the field below.</p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                          Manual QR Entry
                        </label>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Type or paste QR code manually"
                            value={simulatedInput}
                            onChange={(e) => setSimulatedInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleScanCode(simulatedInput);
                                setSimulatedInput('');
                              }
                            }}
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                          />
                          <button
                            onClick={() => { handleScanCode(simulatedInput); setSimulatedInput(''); }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition"
                          >
                            Scan
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
                        <div className="print-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
                          <div className="print-modal-content bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
                            
                            {/* STICKY ALWAYS-VISIBLE HEADER WITH X CLOSE BUTTON */}
                            <div className="no-print sticky top-0 z-30 bg-white px-6 py-4 border-b border-slate-200 flex items-start justify-between shadow-sm">
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
                                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                                  {selectedBatchForPrint.title} ({selectedBatchForPrint.count} {selectedBatchForPrint.sizeGroup} {selectedBatchForPrint.category} Tags)
                                </h3>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                                >
                                  <Printer className="w-4 h-4" /> Send Sheet to Printer
                                </button>

                                {reprintPrintMode && (
                                  <button
                                    onClick={() => setReprintPrintMode(false)}
                                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
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
                                  className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl transition font-bold text-xs flex items-center gap-1 shadow-sm"
                                  title="Close Modal"
                                >
                                  <X className="w-5 h-5 text-rose-600" />
                                  <span className="hidden sm:inline">Close</span>
                                </button>
                              </div>
                            </div>

                            {/* SCROLLABLE INTERNAL MODAL BODY */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                              {/* NON-PRINTABLE MODAL CONTROLS & BANNERS */}
                              <div className="no-print space-y-5">
                                {/* SAFEGUARD BANNERS */}
                                {!selectedBatchForPrint.isPrinted ? (
                                  <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-amber-950">
                                    <div className="space-y-0.5 max-w-xl">
                                      <span className="font-extrabold text-xs flex items-center gap-1.5 text-amber-900">
                                        <ShieldCheck className="w-4 h-4 text-amber-600" /> Initial One-Time Sheet Printing Safeguard
                                      </span>
                                      <p className="text-xs text-amber-900">
                                        Clicking print will authorize the 1st printing of this entire batch sheet.
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
                                        <Lock className="w-4 h-4 text-emerald-600" /> Sheet Printed & Active
                                      </span>
                                      <p className="text-xs text-emerald-800">
                                        Initial sheet printed on {selectedBatchForPrint.printedAt} by {selectedBatchForPrint.printedBy}. Click below or use the top button to re-send to printer anytime.
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => window.print()}
                                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                                    >
                                      <Printer className="w-4 h-4" /> Send Sheet to Printer
                                    </button>
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
                                        If a tag on a garment is damaged or torn (e.g. VST-9696), select 1 or more specific tag numbers below to reprint replacements.
                                      </p>
                                    </div>

                                    {selectedCodesForReprint.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedCodesForReprint([]);
                                          setReprintPrintMode(false);
                                        }}
                                        className="text-[11px] bg-rose-100 text-rose-800 hover:bg-rose-200 px-2.5 py-1 rounded-lg border border-rose-300 font-bold transition"
                                      >
                                        Clear Selection ({selectedCodesForReprint.length})
                                      </button>
                                    )}
                                  </div>

                                  {/* TAG SEARCH FILTER INPUT FOR LARGE BATCHES (e.g. 100 CODES) */}
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                      <input 
                                        type="text"
                                        placeholder="🔍 Search tag code number (e.g. VST-9696, 9696)..."
                                        value={reprintSearchQuery}
                                        onChange={e => setReprintSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono font-semibold text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                                      />
                                    </div>

                                    {reprintSearchQuery && (
                                      <button 
                                        type="button"
                                        onClick={() => setReprintSearchQuery('')}
                                        className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                                      >
                                        Clear Search
                                      </button>
                                    )}
                                  </div>

                                  {/* TAG SELECTOR CHECKBOX GRID */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-extrabold text-slate-700">Select Replacement Code(s):</span>
                                      <span className="text-slate-500 font-mono">
                                        Showing {selectedBatchForPrint.qrCodes.filter(c => !reprintSearchQuery || c.toLowerCase().includes(reprintSearchQuery.toLowerCase())).length} of {selectedBatchForPrint.count} Codes
                                      </span>
                                    </div>

                                    <div className="max-h-36 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                      {selectedBatchForPrint.qrCodes
                                        .filter(code => !reprintSearchQuery || code.toLowerCase().includes(reprintSearchQuery.toLowerCase()))
                                        .map(code => {
                                          const isChecked = selectedCodesForReprint.includes(code);
                                          return (
                                            <label
                                              key={code}
                                              className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition text-xs font-mono font-bold ${
                                                isChecked ? 'bg-amber-500 text-slate-950 border border-amber-600 shadow-sm' : 'hover:bg-slate-50 text-slate-800 border border-transparent'
                                              }`}
                                            >
                                              <input 
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={e => {
                                                  if (e.target.checked) {
                                                    setSelectedCodesForReprint(prev => [...prev, code]);
                                                  } else {
                                                    const remaining = selectedCodesForReprint.filter(c => c !== code);
                                                    setSelectedCodesForReprint(remaining);
                                                    if (remaining.length === 0) {
                                                      setReprintPrintMode(false);
                                                    }
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
                                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                    <h4 className="font-extrabold text-sm uppercase tracking-wide">
                                      Highland Kilt & Outfit Hire - {selectedCodesForReprint.length > 0 ? `REPLACEMENT REPRINT (${selectedCodesForReprint.length} TAGS)` : 'FULL BATCH QR SHEET'}
                                    </h4>

                                    {selectedCodesForReprint.length > 0 && (
                                      <div className="flex bg-slate-200 p-1 rounded-lg text-xs font-bold">
                                        <button
                                          type="button"
                                          onClick={() => setReprintPrintMode(true)}
                                          className={`px-3 py-1 rounded transition ${reprintPrintMode ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-700'}`}
                                        >
                                          Only Selected Replacement Tags ({selectedCodesForReprint.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setReprintPrintMode(false)}
                                          className={`px-3 py-1 rounded transition ${!reprintPrintMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700'}`}
                                        >
                                          Full Batch Sheet ({selectedBatchForPrint.count})
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <p className="text-[10px] text-slate-600">
                                    Batch: {selectedBatchForPrint.id} • Category: {selectedBatchForPrint.category} ({selectedBatchForPrint.sizeGroup}) • Layout: 4 Across × 7 Down (28 Labels per A4 Sheet)
                                    {selectedCodesForReprint.length > 0 && (
                                      <strong className="text-amber-900 block mt-0.5">
                                        SELECTED REPLACEMENT CODES: [{selectedCodesForReprint.join(', ')}]
                                      </strong>
                                    )}
                                  </p>
                                </div>

                                <div className="qr-label-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-4">
                                  {( (reprintPrintMode && selectedCodesForReprint.length > 0) ? selectedBatchForPrint.qrCodes.filter(c => selectedCodesForReprint.includes(c)) : selectedBatchForPrint.qrCodes).map((code, index) => {
                                    const matrix = generateQrMatrix(code);
                                    const isReg = items.some(i => i.id === code && i.status !== 'RETIRED');
                                    const isSelectedForReprint = selectedCodesForReprint.includes(code);
                                    const isPageBreak = (index + 1) % 28 === 0;

                                    return (
                                      <div 
                                        key={code} 
                                        className={`qr-label-card border-2 border-dashed p-2.5 rounded flex flex-col items-center justify-between text-center bg-white min-h-[140px] shadow-sm ${
                                          isSelectedForReprint ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300'
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
                                          {isReg ? 'REGISTERED' : 'UNREGISTERED'} {isSelectedForReprint && '• REPRINT'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* STICKY FOOTER WITH QUICK CLOSE BUTTON */}
                            <div className="no-print sticky bottom-0 z-30 bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
                              <span className="text-slate-500">
                                Managing <strong>{selectedBatchForPrint.title}</strong> ({selectedBatchForPrint.count} Codes)
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBatchForPrint(null);
                                  setSelectedCodesForReprint([]);
                                  setReprintPrintMode(false);
                                }}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold rounded-xl shadow transition flex items-center gap-1.5"
                              >
                                <X className="w-4 h-4 text-slate-300" /> Close Window
                              </button>
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

              {/* TAB 5: DRY CLEANING LAUNDRY */}
              {activeTab === 'laundry' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div>
                      <h2 className="text-lg font-bold text-cyan-950 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-600" /> Dry Cleaning & Laundry Dispatch Manager
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Track garments currently dispatched to dry cleaners. Confirm return clean to restore to active stock rotation.
                      </p>
                    </div>

                    {items.filter(i => i.status === 'NEEDS_CLEANING').length > 0 && (
                      <button
                        onClick={handleBulkConfirmLaundryCleaned}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Bulk Confirm All Clean & Back in Stock
                      </button>
                    )}
                  </div>

                  {items.filter(i => i.status === 'NEEDS_CLEANING').length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 shadow-sm space-y-2">
                      <Sparkles className="w-12 h-12 text-cyan-500 mx-auto" />
                      <h3 className="text-base font-extrabold text-slate-800">All Garments Clean & Available</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">No garments are currently at the dry cleaners.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.filter(i => i.status === 'NEEDS_CLEANING').map(item => {
                        const latestLaun = item.laundryHistory?.[0];
                        return (
                          <div key={item.id} className="bg-white border border-cyan-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-extrabold text-cyan-900 text-sm bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                    {item.id}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                                    {item.sizeGroup}
                                  </span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mt-1">{item.name}</h3>
                                <p className="text-xs text-slate-500">{item.tartanOrColour} ({item.size})</p>
                              </div>
                              <span className="px-2.5 py-1 text-xs font-bold bg-cyan-100 text-cyan-900 rounded-full border border-cyan-300">
                                🧼 At Laundry
                              </span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                              <p><span className="text-slate-500">Dispatched:</span> <strong>{latestLaun?.dateSent}</strong></p>
                              <p><span className="text-slate-500">Sent By:</span> {latestLaun?.sentByStaff}</p>
                              <p><span className="text-slate-500">Notes:</span> {latestLaun?.notes || 'Laundry cycle'}</p>
                            </div>

                            <button
                              onClick={() => handleConfirmLaundryCleaned(item.id)}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Confirm Clean & Return to Available Stock
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: REPAIRS */}
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

              {/* TAB 7: MASTER ADMIN EXECUTIVE ANALYTICS & GARMENT ROI DASHBOARD */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {!isMasterAdmin ? (
                    <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm max-w-xl mx-auto space-y-4">
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 mx-auto">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Master Admin Analytics Access Restricted</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Financial revenue analytics and garment ROI performance ledgers are restricted exclusively to Allan (Master Admin).
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* DASHBOARD HEADER */}
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-amber-600" /> Master Admin Financial & Garment ROI Analytics
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Real-time profitability tracking, rental turnover rates, top tartan rankings, and garment asset ROI.
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs rounded-lg flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-amber-600" /> Executive Financial Ledger
                        </span>
                      </div>

                      {/* FINANCIAL METRIC SUMMARY CARDS */}
                      {(() => {
                        let grossRevenue = 0;
                        let totalDepositsRefunded = 0;
                        let totalDepositsRetained = 0;

                        pos.forEach(po => {
                          grossRevenue += po.totalHireFee;
                          po.items.forEach(li => {
                            if (li.depositAction === 'REFUNDED') {
                              totalDepositsRefunded += li.depositAmount;
                            } else if (li.depositAction === 'HELD_FOR_REPAIR' || li.depositAction === 'HELD_FOR_MISSING') {
                              totalDepositsRetained += li.depositAmount;
                            }
                          });
                        });

                        const fleetCost = items.reduce((sum, item) => sum + (item.purchaseCost || (item.sizeGroup === 'Kid' ? 120 : 250)), 0);
                        const fleetNetProfit = grossRevenue + totalDepositsRetained - fleetCost;
                        const fleetRoiPct = fleetCost > 0 ? Math.round(((grossRevenue + totalDepositsRetained) / fleetCost) * 100) : 0;

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
                              <span className="text-xs text-slate-500 font-bold block flex items-center gap-1">
                                <DollarSign className="w-4 h-4 text-amber-600" /> Gross Hire Revenue
                              </span>
                              <span className="text-2xl font-extrabold text-slate-900">£{grossRevenue.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 block">From {pos.length} Customer POs</span>
                            </div>

                            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
                              <span className="text-xs text-slate-500 font-bold block flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Deposits Refunded
                              </span>
                              <span className="text-2xl font-extrabold text-emerald-700">£{totalDepositsRefunded.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 block">Returned for clean items</span>
                            </div>

                            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
                              <span className="text-xs text-slate-500 font-bold block flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4 text-rose-600" /> Deposits Retained
                              </span>
                              <span className="text-2xl font-extrabold text-rose-700">£{totalDepositsRetained.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 block">Damaged/missing gear</span>
                            </div>

                            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
                              <span className="text-xs text-slate-500 font-bold block flex items-center gap-1">
                                <TrendingUp className="w-4 h-4 text-amber-600" /> Overall Fleet Portfolio ROI
                              </span>
                              <span className="text-2xl font-extrabold text-amber-700">+{fleetRoiPct}%</span>
                              <span className="text-[10px] text-slate-400 block">Fleet Cost: £{fleetCost.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* TOP TARTAN LEADERBOARD & DEMOGRAPHIC REVENUE BREAKDOWN */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* TARTAN POPULARITY RANKING */}
                        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Tag className="w-5 h-5 text-amber-600" /> Top Performing Tartans & Outfits Leaderboard
                          </h3>

                          {(() => {
                            const tartanMap: Record<string, { count: number; totalRevenue: number }> = {};
                            pos.forEach(po => {
                              po.items.forEach(li => {
                                const itemObj = items.find(i => i.id === li.qrCodeId);
                                const tartan = itemObj?.tartanOrColour || 'Royal Stewart';
                                if (!tartanMap[tartan]) {
                                  tartanMap[tartan] = { count: 0, totalRevenue: 0 };
                                }
                                tartanMap[tartan].count += 1;
                                tartanMap[tartan].totalRevenue += li.hireRate;
                              });
                            });

                            const sortedTartans = Object.entries(tartanMap).sort((a, b) => b[1].totalRevenue - a[1].totalRevenue);
                            const maxRev = sortedTartans[0]?.[1].totalRevenue || 1;

                            return (
                              <div className="space-y-3">
                                {sortedTartans.length === 0 ? (
                                  <p className="text-xs text-slate-500">No rental history logged yet.</p>
                                ) : (
                                  sortedTartans.map(([tartan, stats], idx) => {
                                    const pct = Math.round((stats.totalRevenue / maxRev) * 100);
                                    return (
                                      <div key={tartan} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span className="font-bold text-slate-900">
                                            #{idx + 1} {tartan}
                                          </span>
                                          <span className="font-mono text-slate-600">
                                            <strong>{stats.count} Hires</strong> • <span className="text-amber-800 font-bold">£{stats.totalRevenue}</span>
                                          </span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                          <div 
                                            className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* DEMOGRAPHIC REVENUE SPLIT (ADULTS VS KIDS) */}
                        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Users className="w-5 h-5 text-purple-600" /> Demographic Hire Breakdown (Adults vs Kids)
                          </h3>

                          {(() => {
                            let adultRevenue = 0;
                            let kidRevenue = 0;
                            let adultCount = 0;
                            let kidCount = 0;

                            pos.forEach(po => {
                              po.items.forEach(li => {
                                if (li.sizeGroup === 'Kid') {
                                  kidRevenue += li.hireRate;
                                  kidCount += 1;
                                } else {
                                  adultRevenue += li.hireRate;
                                  adultCount += 1;
                                }
                              });
                            });

                            const totalRev = adultRevenue + kidRevenue || 1;
                            const adultPct = Math.round((adultRevenue / totalRev) * 100);
                            const kidPct = 100 - adultPct;

                            return (
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs space-y-1">
                                    <span className="font-bold text-blue-900 flex items-center gap-1">
                                      <User className="w-4 h-4 text-blue-600" /> Adult Rigouts
                                    </span>
                                    <span className="text-xl font-extrabold text-blue-950 block">£{adultRevenue}</span>
                                    <span className="text-[11px] text-blue-700 font-semibold">{adultCount} Items Hired ({adultPct}%)</span>
                                  </div>

                                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-xs space-y-1">
                                    <span className="font-bold text-purple-900 flex items-center gap-1">
                                      <Baby className="w-4 h-4 text-purple-600" /> Kids Outfits
                                    </span>
                                    <span className="text-xl font-extrabold text-purple-950 block">£{kidRevenue}</span>
                                    <span className="text-[11px] text-purple-700 font-semibold">{kidCount} Items Hired ({kidPct}%)</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <span className="text-xs font-bold text-slate-700 block">Revenue Ratio Bar:</span>
                                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex shadow-inner">
                                    <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${adultPct}%` }} title={`Adults: ${adultPct}%`} />
                                    <div className="bg-purple-600 h-full transition-all duration-500" style={{ width: `${kidPct}%` }} title={`Kids: ${kidPct}%`} />
                                  </div>
                                  <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-blue-700">Adults ({adultPct}%)</span>
                                    <span className="text-purple-700">Kids ({kidPct}%)</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* INDIVIDUAL GARMENT ROI & LIFETIME RENTAL PERFORMANCE TABLE */}
                      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm space-y-4 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-amber-600" /> Individual Garment ROI & Financial Lifetime Ledger
                            </h3>
                            <p className="text-xs text-slate-500">
                              Track purchase cost vs lifetime rental revenue earned for every registered garment in stock.
                            </p>
                          </div>

                          <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input 
                              type="text"
                              placeholder="Search tag ID, tartan, or garment..."
                              value={analyticsSearchQuery}
                              onChange={e => setAnalyticsSearchQuery(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500 shadow-sm"
                            />
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                              <tr>
                                <th className="py-3.5 px-4">QR Code ID</th>
                                <th className="py-3.5 px-4">Garment Title</th>
                                <th className="py-3.5 px-4">Category</th>
                                <th className="py-3.5 px-4">Demographic</th>
                                <th className="py-3.5 px-4 text-center">Times Hired</th>
                                <th className="py-3.5 px-4">Est. Cost (£)</th>
                                <th className="py-3.5 px-4">Revenue (£)</th>
                                <th className="py-3.5 px-4">Net Return (£)</th>
                                <th className="py-3.5 px-4 text-right">ROI Performance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold">
                              {items
                                .filter(item => !analyticsSearchQuery || item.id.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || item.name.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || item.tartanOrColour.toLowerCase().includes(analyticsSearchQuery.toLowerCase()))
                                .map(item => {
                                  // Calculate lifetime rentals for this item
                                  let timesHired = 0;
                                  let lifetimeRev = 0;

                                  pos.forEach(po => {
                                    po.items.forEach(li => {
                                      if (li.qrCodeId === item.id) {
                                        timesHired += 1;
                                        lifetimeRev += li.hireRate;
                                      }
                                    });
                                  });

                                  const cost = item.purchaseCost || (item.sizeGroup === 'Kid' ? 120 : 250);
                                  const netProfit = lifetimeRev - cost;
                                  const roiPct = Math.round((lifetimeRev / cost) * 100);

                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition">
                                      <td className="py-3 px-4 font-mono font-bold text-amber-800">{item.id}</td>
                                      <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                                      <td className="py-3 px-4">{item.category}</td>
                                      <td className="py-3 px-4">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 w-fit ${item.sizeGroup === 'Kid' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                                          {item.sizeGroup === 'Kid' ? <Baby className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                          {item.sizeGroup}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4 text-center font-mono font-extrabold text-slate-900 bg-slate-50">{timesHired} Hires</td>
                                      <td className="py-3 px-4 text-slate-500">£{cost}</td>
                                      <td className="py-3 px-4 font-bold text-amber-800">£{lifetimeRev}</td>
                                      <td className={`py-3 px-4 font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                        {netProfit >= 0 ? `+£${netProfit}` : `-£${Math.abs(netProfit)}`}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full border ${
                                          roiPct >= 100 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                          roiPct >= 50 ? 'bg-blue-100 text-blue-900 border-blue-300' :
                                          'bg-amber-100 text-amber-900 border-amber-300'
                                        }`}>
                                          {roiPct >= 100 ? `+${roiPct}% Profit ROI` : `${roiPct}% Recovery`}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 8: MASTER ADMIN, STAFF ACCOUNTS & INVITES */}
              {activeTab === 'admin' && (
                <div className="space-y-6">
                  
                  {/* SUMMARY METRICS BAR */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block font-semibold">Active Inventory</span>
                      <span className="text-2xl font-extrabold text-amber-700">{items.filter(i=>i.status!=='RETIRED').length} Items</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block font-semibold">Currently On Hire</span>
                      <span className="text-2xl font-extrabold text-blue-700">{items.filter(i=>i.status==='ON_HIRE').length} Items</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block font-semibold">Active Staff Accounts</span>
                      <span className="text-2xl font-extrabold text-slate-900">{staffList.length} Accounts</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                      <span className="text-xs text-slate-500 block font-semibold">Pending Staff Invites</span>
                      <span className="text-2xl font-extrabold text-amber-700">{invites.filter(i=>i.status==='PENDING').length} Invites</span>
                    </div>
                  </div>

                  {/* ACTIVE STAFF TEAM & SYSTEM ACCOUNTS */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                          <UserCheck className="w-5 h-5 text-amber-600" /> Active Staff Team & Admin Users ({staffList.length})
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Add actual staff members directly to the system or send invitation email links.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setDirectStaffForm({ name: '', email: '', role: 'Shop Assistant', password: '', pin: '1234' });
                            setDirectStaffError('');
                            setShowDirectAddStaffModal(true);
                          }}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition border border-amber-400/40"
                        >
                          <UserPlus className="w-4 h-4" /> Direct Add Staff Member
                        </button>

                        <button
                          onClick={() => {
                            setInviteSuccessMsg('');
                            setShowInviteModal(true);
                          }}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-400" /> Generate Invite Link
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staffList.map(st => {
                        const isSelf = st.id === currentUser?.id;
                        return (
                          <div key={st.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3 relative group hover:border-slate-300 transition shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-base shadow-sm shrink-0 ${
                                  st.role === 'Master Admin' ? 'bg-amber-500 text-slate-950' :
                                  st.role === 'Admin' ? 'bg-blue-600 text-white' :
                                  'bg-emerald-600 text-white'
                                }`}>
                                  {st.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-sm text-slate-900 leading-tight flex items-center gap-1.5">
                                    {st.name}
                                    {isSelf && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-slate-900 text-amber-400 rounded">You</span>
                                    )}
                                  </h4>
                                  <span className="text-xs text-slate-500 block truncate max-w-[170px]">{st.email}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-semibold">System Role</span>
                                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full inline-block mt-0.5 ${
                                  st.role === 'Master Admin' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                  st.role === 'Admin' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                                  'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}>
                                  {st.role}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setShowEditStaffModal(st);
                                    setEditStaffForm({ name: st.name, email: st.email, role: st.role, pin: st.pin });
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg border border-slate-200 transition"
                                  title="Edit Staff Member"
                                >
                                  <UserCog className="w-4 h-4 text-slate-600" />
                                </button>
                                {!isSelf && (
                                  <button
                                    onClick={() => handleDeleteStaff(st)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition"
                                    title="Remove Staff Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STAFF INVITATIONS TABLE */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-amber-600" /> Pending Invitations ({invites.filter(i=>i.status==='PENDING').length})
                        </h3>
                        <span className="text-xs text-slate-500">Staff register using their assigned invite code</span>
                      </div>

                      {invites.length > 0 && (
                        <button
                          onClick={handleClearAllInvites}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] rounded-xl border border-rose-200 flex items-center gap-1 transition shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Purge All Invites
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-900 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Invite Code</th>
                            <th className="py-3 px-4">Recipient Email</th>
                            <th className="py-3 px-4">Assigned Role</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Created By</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invites.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 italic">No pending invitations. Click "Generate Invite Link" to create one.</td>
                            </tr>
                          ) : (
                            invites.map(inv => (
                              <tr key={inv.id} className="hover:bg-slate-50 transition">
                                <td className="py-3 px-4 font-mono font-extrabold text-amber-800">{inv.code}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{inv.email}</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-slate-100 text-slate-800 rounded border border-slate-200">
                                    {inv.role}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${
                                    inv.status === 'PENDING' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                    inv.status === 'REGISTERED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">{inv.createdByName}</td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {inv.status === 'PENDING' && (
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(inv.code);
                                          setCopiedInviteCode(inv.code);
                                          setTimeout(() => setCopiedInviteCode(null), 2000);
                                        }}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] border border-slate-200 flex items-center gap-1 transition"
                                      >
                                        {copiedInviteCode === inv.code ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
                                        {copiedInviteCode === inv.code ? 'Copied Code' : 'Copy Code'}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteInvite(inv.id)}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition"
                                      title="Revoke Invite"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* STAFF ACTION AUDIT LOG */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" /> Staff Activity Audit Trail
                      </h3>
                      <button
                        onClick={handleClearAuditLogs}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-xl border border-slate-200 flex items-center gap-1 transition shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-600" /> Clear Audit Logs
                      </button>
                    </div>

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

        {/* VERY BOTTOM APP FOOTER / USER GUIDE & MANUAL */}
        <footer className="no-print bg-slate-900 text-white border-t border-slate-800 py-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs mt-auto">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px] flex items-center justify-center shrink-0">
              H
            </div>
            <span className="font-bold text-slate-300 text-xs">Highland Kilt Hire Back Office</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUserGuideModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-md transition"
            >
              <BookOpen className="w-4 h-4 text-slate-950 shrink-0" />
              <span>User Guide & Operations Manual</span>
            </button>
          </div>
        </footer>
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

                  {/* QUICK SCAN BUTTONS — real codes from this PO */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] font-bold text-slate-500 self-center">Items on this PO:</span>
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
                          {isScanned ? '✓ ' : ''}{li.qrCodeId}
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
                                    Good & Clean
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setReturnChecklist(prev => ({
                                      ...prev,
                                      [li.qrCodeId]: { ...currentSetting, condition: 'NEEDS_CLEANING' }
                                    }))}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                      currentSetting.condition === 'NEEDS_CLEANING' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600'
                                    }`}
                                  >
                                    🧼 Needs Cleaning
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
                                    🔧 Damaged
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* EXPLANATION BADGE IF NOT SCANNED OR DAMAGED OR NEEDS CLEANING */}
                        {!isScanned && (
                          <div className="mt-2 text-[11px] font-semibold text-amber-900 bg-amber-100/70 p-2 rounded-lg border border-amber-200">
                            🔒 Un-scanned Garment: Deposit of <strong>£{li.depositAmount}</strong> will be retained until this item's iron-on QR label is physically scanned in store.
                          </div>
                        )}
                        {isScanned && currentSetting.condition === 'NEEDS_CLEANING' && (
                          <div className="mt-2 text-[11px] font-bold text-cyan-950 bg-cyan-100/80 p-2 rounded-lg border border-cyan-300 flex items-center justify-between">
                            <span>🧼 Needs Dry Cleaning: Sent to laundry dispatch. Customer deposit of <strong>£{li.depositAmount}</strong> is refunded.</span>
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

      {/* MY ACCOUNT & PROFILE SETTINGS MODAL */}
      {showMyAccountModal && currentUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-md shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    My Account Settings
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 rounded-full inline-block mt-0.5">
                    Role: {currentUser.role}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setShowMyAccountModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {accountMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold border ${
                accountMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {accountMsg.text}
              </div>
            )}

            {/* ACCOUNT STATUS & ACCESS LEVEL CARD */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Account Status</span>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Staff Member
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Assigned System Role</span>
                  <span className={`px-2.5 py-1 text-xs font-extrabold rounded-xl inline-block mt-0.5 ${
                    currentUser.role === 'Master Admin' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                    currentUser.role === 'Admin' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                    'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {currentUser.role === 'Master Admin' ? '👑 Master Admin' :
                     currentUser.role === 'Admin' ? '🛡️ System Admin' :
                     '🏪 Shop Assistant'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block">Access Scope</span>
                  <span className="text-xs font-bold text-slate-700">
                    {currentUser.role === 'Master Admin' ? 'Full System & User Control' :
                     currentUser.role === 'Admin' ? 'Inventory, POs & Batches' :
                     'Floor Terminal & Scanner'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveAccountSubmit} className="space-y-4 text-xs">
              
              {/* PERSONAL INFO */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Store Email Address</label>
                <input 
                  type="email" 
                  required
                  value={accountForm.email}
                  onChange={e => setAccountForm({ ...accountForm, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* CHANGE PASSWORD WITH SHOW EYE */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Change Account Password <span className="text-slate-500 font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input 
                    type={showAccPassword ? "text" : "password"}
                    minLength={6}
                    placeholder="Enter new password (min 6 chars)"
                    value={accountForm.password}
                    onChange={e => setAccountForm({ ...accountForm, password: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccPassword(!showAccPassword)}
                    className="absolute right-3 top-3 p-1 text-slate-400 hover:text-slate-700 transition"
                    title={showAccPassword ? "Hide password" : "Show password"}
                  >
                    {showAccPassword ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* CHANGE OVERRIDE PIN WITH SHOW PIN EYE */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Change Security PIN Code <span className="text-slate-500 font-normal">(4-8 digits)</span>
                </label>
                <div className="relative">
                  <input 
                    type={showAccPin ? "text" : "password"}
                    required
                    maxLength={8}
                    placeholder="Enter PIN code"
                    value={accountForm.pin}
                    onChange={e => setAccountForm({ ...accountForm, pin: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-3 text-slate-900 font-mono font-bold text-center tracking-widest text-base outline-none focus:border-amber-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccPin(!showAccPin)}
                    className="absolute right-3 top-3.5 p-1 text-slate-400 hover:text-slate-700 transition"
                    title={showAccPin ? "Hide PIN" : "Show PIN"}
                  >
                    {showAccPin ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowMyAccountModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-slate-950" /> Save Account Changes
                </button>
              </div>
            </form>

            {/* LEAVING COMPANY DANGER ZONE */}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-xs text-rose-900 flex items-center gap-1">
                    <UserMinus className="w-4 h-4 text-rose-600" /> Leaving the Company?
                  </h4>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    Deactivating your account will close your staff access and log you out immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseMyAccount}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow transition shrink-0"
                >
                  Close Account
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SEND STAFF EMAIL INVITATION MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-600" /> Generate Staff Invite Link & Code
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold">
                {inviteSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSendInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Staff Member Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. bruce@kilt-hire.co.uk"
                  value={newInviteEmail}
                  onChange={e => setNewInviteEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Assigned System Role</label>
                <select 
                  value={newInviteRole}
                  onChange={e => setNewInviteRole(e.target.value as StaffRole)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                >
                  <option value="Shop Assistant">Shop Assistant (Floor Terminal, Scanner & PO Returns)</option>
                  <option value="Admin">Admin (Inventory, Batches, POs, Laundry & Workshop)</option>
                  <option value="Master Admin">Master Admin (Full Access, Pricing & User Control)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-amber-400" /> Generate & Save Invitation Code
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DIRECT ADD STAFF MEMBER MODAL */}
      {showDirectAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-600" /> Direct Add Staff Member
                </h3>
                <span className="text-xs text-slate-500 font-semibold">Create account instantly without email invite code</span>
              </div>
              <button onClick={() => setShowDirectAddStaffModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {directStaffError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {directStaffError}
              </div>
            )}

            <form onSubmit={handleDirectAddStaffSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Bruce Campbell"
                  value={directStaffForm.name}
                  onChange={e => setDirectStaffForm({ ...directStaffForm, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. bruce@kilt-hire.co.uk"
                  value={directStaffForm.email}
                  onChange={e => setDirectStaffForm({ ...directStaffForm, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Assigned System Role</label>
                <select 
                  value={directStaffForm.role}
                  onChange={e => setDirectStaffForm({ ...directStaffForm, role: e.target.value as StaffRole })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                >
                  <option value="Shop Assistant">Shop Assistant (Floor Terminal, Scanner & Returns)</option>
                  <option value="Admin">Admin (Inventory, POs, Batches, Laundry & Workshop)</option>
                  <option value="Master Admin">Master Admin (Full System Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Account Login Password <span className="text-slate-500 font-normal">(min 6 chars)</span></label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  placeholder="Set initial login password"
                  value={directStaffForm.password}
                  onChange={e => setDirectStaffForm({ ...directStaffForm, password: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Override PIN Code <span className="text-slate-500 font-normal">(4 digits)</span></label>
                <input 
                  type="text" 
                  required
                  maxLength={8}
                  placeholder="e.g. 1234"
                  value={directStaffForm.pin}
                  onChange={e => setDirectStaffForm({ ...directStaffForm, pin: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-bold text-center outline-none focus:border-amber-500 shadow-sm tracking-widest text-base"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectAddStaffModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4 text-slate-950" /> Create & Save Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MEMBER DETAILS MODAL */}
      {showEditStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-amber-600" /> Edit Staff Member Profile
                </h3>
                <span className="text-xs text-slate-500 font-semibold">Update role and access credentials</span>
              </div>
              <button onClick={() => setShowEditStaffModal(null)} className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editStaffForm.name}
                  onChange={e => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={editStaffForm.email}
                  onChange={e => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Assigned System Role</label>
                <select 
                  value={editStaffForm.role}
                  onChange={e => setEditStaffForm({ ...editStaffForm, role: e.target.value as StaffRole })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-bold outline-none focus:border-amber-500 shadow-sm"
                >
                  <option value="Shop Assistant">Shop Assistant (Floor Terminal, Scanner & Returns)</option>
                  <option value="Admin">Admin (Inventory, POs, Batches, Laundry & Workshop)</option>
                  <option value="Master Admin">Master Admin (Full System Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Override Security PIN Code</label>
                <input 
                  type="text" 
                  required
                  maxLength={8}
                  value={editStaffForm.pin}
                  onChange={e => setEditStaffForm({ ...editStaffForm, pin: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-bold text-center outline-none focus:border-amber-500 shadow-sm tracking-widest text-base"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditStaffModal(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-slate-950" /> Save Profile Changes
                </button>
              </div>
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

              {/* AVAILABLE STOCK — scan or tap to add to PO */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-600 self-center">Available to add:</span>
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
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{item.id}
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

      {/* STAFF USER GUIDE & OPERATIONS MANUAL MODAL */}
      {showUserGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 space-y-5 my-8 shadow-2xl">
            
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-amber-100 text-amber-900 font-extrabold text-xs rounded-full border border-amber-300 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-600" /> Highland Kilt Hire Operations Manual
                  </span>
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-900 rounded-full">
                    Official Staff SOP
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                  Staff User Guide & System Standard Operating Procedure
                </h3>
                <p className="text-xs text-slate-500">
                  Welcome to Highland Kilt Hire! Select a topic below to view step-by-step instructions.
                </p>
              </div>

              <button
                onClick={() => setShowUserGuideModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* TOP NAVIGATION SUB-TABS */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
              <button
                onClick={() => setGuideTopic('SCANNER')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition ${
                  guideTopic === 'SCANNER' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Floor QR Scanner
              </button>

              <button
                onClick={() => setGuideTopic('CALENDAR')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition ${
                  guideTopic === 'CALENDAR' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Availability Calendar
              </button>

              <button
                onClick={() => setGuideTopic('QR_PRINTING')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition ${
                  guideTopic === 'QR_PRINTING' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <Printer className="w-3.5 h-3.5" /> QR Label Printing
              </button>

              <button
                onClick={() => setGuideTopic('BULK_BINS')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition ${
                  guideTopic === 'BULK_BINS' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Bulk Storage Bins
              </button>

              <button
                onClick={() => setGuideTopic('LAUNDRY')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition ${
                  guideTopic === 'LAUNDRY' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Dry Cleaning & Repairs
              </button>

              <button
                onClick={() => setGuideTopic('ANALYTICS')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition ${
                  guideTopic === 'ANALYTICS' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Master Admin & ROI
              </button>
            </div>

            {/* GUIDE CONTENT BODY */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">

              {guideTopic === 'SCANNER' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-600" /> Automated Floor Scanner Operations
                    </h4>
                    <p className="leading-relaxed">
                      The Shop Assistant terminal is equipped with a zero-friction QR camera scanner. Staff can scan any garment or storage box to trigger automated actions instantly.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">1. Outgoing Hire Bag Assembly</span>
                      <p className="text-slate-600 leading-relaxed">
                        Scan the first garment QR code (e.g. <code>KILT-1001</code>). The PO Builder will open automatically. Keep scanning additional garments (Jacket, Sporran, Shoes) to build the complete outfit bag.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">2. Customer Bag Returns</span>
                      <p className="text-slate-600 leading-relaxed">
                        Scanning any garment currently <strong>ON HIRE</strong> automatically opens that customer's PO Return Checklist. Scan each returned item to verify authentic QR labels before deposit refunding.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">3. Registering New Stock</span>
                      <p className="text-slate-600 leading-relaxed">
                        Scanning an unregistered QR code label immediately pops up the <strong>New Stock Registration Form</strong>. Select Adult vs Kids sizing group and default category pricing fills automatically.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">4. Quick Demo Pickers</span>
                      <p className="text-slate-600 leading-relaxed">
                        If testing without a camera, click any of the instant simulated scan buttons on the scanner panel (e.g. <code>KILT-1001</code>, <code>PO-9011</code>, <code>BIN-SGIAN-DUBH</code>).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideTopic === 'CALENDAR' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" /> Availability & Booking Calendar Guide
                    </h4>
                    <p className="leading-relaxed">
                      Store staff can look up future event dates (weddings, graduations) to check live stock availability before creating a customer booking.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">📅 Selecting Target Event Dates</span>
                      <p className="text-slate-600 leading-relaxed">
                        Use the date picker at the top of the Calendar view. The top summary cards automatically calculate how many garments are <strong>🟢 AVAILABLE</strong>, <strong>🔒 BOOKED ON DATE</strong>, or in <strong>🧼 LAUNDRY / REPAIR</strong> for that specific date.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🎯 Tartan & Category Filters</span>
                      <p className="text-slate-600 leading-relaxed">
                        Filter by specific tartans (e.g. *Royal Stewart*, *Spirit of Scotland*) or categories (*Kilts*, *Jackets*) to view specific outfit availability.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">⚡ 1-Click Hire Booking</span>
                      <p className="text-slate-600 leading-relaxed">
                        Clicking <strong>"Book Hire for [GARMENT-ID]"</strong> on any available garment pre-fills the PO Builder with that garment and sets the event date automatically!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideTopic === 'QR_PRINTING' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Printer className="w-4 h-4 text-purple-600" /> QR Batch Label Generation & Printing Safeguards
                    </h4>
                    <p className="leading-relaxed">
                      Highland Kilt Hire uses high-durability thermal transfer QR labels (iron-on labels for kilts/jackets, waterproof stickers for shoes/sporrans).
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🏷️ Creating New Label Batches</span>
                      <p className="text-slate-600 leading-relaxed">
                        Master Admin Allan can generate batches of up to 100 QR codes (e.g. <code>KILT-1001</code> to <code>KILT-1100</code>) specifying Adult vs Kids sizing groups.
                      </p>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🔒 1-Time Printing Safeguard</span>
                      <p className="text-amber-900 leading-relaxed">
                        Once a batch sheet is printed, the full sheet is automatically <strong>LOCKED</strong> to prevent accidental duplicate full prints.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🔑 Replacement Single Tag Reprints</span>
                      <p className="text-slate-600 leading-relaxed">
                        If a single tag becomes damaged or lost, click the tag number in the batch list and enter Master Admin PIN (<code>1234</code>) to authorize a single replacement reprint. Every reprint is recorded in the audit log.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideTopic === 'BULK_BINS' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-600" /> Serialized Garments vs Bulk Storage Bins
                    </h4>
                    <p className="leading-relaxed">
                      Our hybrid inventory system handles individual high-value garments and bulk accessory bins seamlessly.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">👕 Serialized Garments</span>
                      <p className="text-slate-600 leading-relaxed">
                        Kilts, Jackets, Waistcoats, Shirts, Shoes, Sporrans have individual QR codes. Tracked individually when going out and coming back.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">📦 Bulk Storage Box Bins</span>
                      <p className="text-slate-600 leading-relaxed">
                        Sgian-dubhs, Kilt Pins, Belts & Buckles, Garters are stored in master bins with 1 QR sticker on the box (e.g. <code>BIN-SGIAN-DUBH</code>).
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                    <span className="font-extrabold text-slate-900 block text-xs">⚡ Automatic Inventory Pool Adjustments</span>
                    <p className="text-slate-700 leading-relaxed">
                      Adding a Sgian-dubh to a PO automatically reduces the bin count (`150 ➔ 149`). On customer return, checking <code>[✓] Returned Clean</code> adds +1 back to the bin count.
                    </p>
                  </div>
                </div>
              )}

              {guideTopic === 'LAUNDRY' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-600" /> Dry Cleaning Laundry & Repair Workshop
                    </h4>
                    <p className="leading-relaxed">
                      Highland Kilt Hire maintains strict hygiene and garment repair standards.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🧼 Processing Dry Cleaning Returns</span>
                      <p className="text-slate-600 leading-relaxed">
                        In the PO Return Checklist, select <strong>🧼 Needs Cleaning</strong>. The customer's deposit is <strong>REFUNDED</strong> (normal wear-and-tear) and the item is dispatched to the Dry Cleaning tab.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🔧 Repair Workshop Dispatches</span>
                      <p className="text-slate-600 leading-relaxed">
                        If a garment has tears, broken buckles, or moth damage, select <strong>🔧 Needs Repair</strong> in the return checklist. The security deposit is <strong>HELD</strong> until seamstress repairs are completed.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">✨ Bulk Dry Cleaning Check-In</span>
                      <p className="text-slate-600 leading-relaxed">
                        When the dry cleaner returns a batch of garments, click <strong>"Bulk Confirm All Clean"</strong> in the Laundry tab to return all items to <code>AVAILABLE</code> stock in 1 click!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideTopic === 'ANALYTICS' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-amber-600" /> Master Admin Analytics & Garment ROI Dashboard
                    </h4>
                    <p className="leading-relaxed">
                      Restricted exclusively to Allan (Master Admin - PIN <code>1234</code>). Provides high-level business intelligence and garment financial tracking.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">📈 Gross Revenue & Deposits</span>
                      <p className="text-slate-600 leading-relaxed">
                        Tracks total hire fees earned, deposits refunded to customers, and deposits retained due to damages or missing items.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🏆 Tartan Popularity Leaderboard</span>
                      <p className="text-slate-600 leading-relaxed">
                        Visual progress bars showing revenue generated by each tartan (*Royal Stewart*, *Spirit of Scotland*, *Black Watch*, etc.).
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🏷️ Individual Garment ROI Ledger</span>
                      <p className="text-slate-600 leading-relaxed">
                        Lists purchase cost vs total rental earnings for every garment, showing lifetime profit and fleet ROI %.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <span className="font-extrabold text-slate-900 block text-xs">🛡️ Staff Security Invites</span>
                      <p className="text-slate-600 leading-relaxed">
                        Generate secure 1-time invite codes to onboard new store assistants with custom PIN credentials.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* MODAL FOOTER */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                Master Admin Allan • Highland Kilt Hire SOP v2.4
              </span>
              <button
                onClick={() => setShowUserGuideModal(false)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow transition"
              >
                Close Guide
              </button>
            </div>

          </div>
        </div>
      )}


      {/* IOS SAFARI PWA INSTALLATION GUIDE MODAL */}
      {showIosInstallModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Install on iPhone / iPad</h3>
                  <span className="text-xs font-semibold text-slate-500">Safari iOS Installation Steps</span>
                </div>
              </div>
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-medium text-slate-700">
              <p className="text-slate-600 font-semibold">
                Apple iOS does not show automatic install popups, but you can add this app to your Home Screen in 3 quick steps:
              </p>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0">1</div>
                  <p>Tap the <span className="font-extrabold text-slate-900">Share button</span> <Share2 className="inline w-4 h-4 text-indigo-600 mx-1" /> at the bottom or top of your Safari browser.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0">2</div>
                  <p>Scroll down the menu and tap <span className="font-extrabold text-slate-900">"Add to Home Screen"</span> <PlusSquare className="inline w-4 h-4 text-amber-600 mx-1" />.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0">3</div>
                  <p>Tap <span className="font-extrabold text-indigo-600">"Add"</span> in the top right corner. The Highland Kilt Hire app icon will appear on your Home Screen!</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}



      {/* BREVO EMAIL DISPATCH MODAL */}
      {showBrevoEmailModal && brevoEmailData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center shadow">
                  ✉️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Brevo Transactional Email Preview</h3>
                  <p className="text-xs text-slate-500">Order {brevoEmailData.poId} Customer Notification</p>
                </div>
              </div>

              <button onClick={() => setShowBrevoEmailModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">To Recipient:</span>
                <span className="font-extrabold text-slate-900">{brevoEmailData.toName} &lt;{brevoEmailData.toEmail}&gt;</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1">
                <span className="text-slate-500 font-bold">Subject Line:</span>
                <span className="font-extrabold text-amber-900">{brevoEmailData.subject}</span>
              </div>
            </div>

            {/* HTML PREVIEW CONTAINER */}
            <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white max-h-64 overflow-y-auto p-4 text-xs shadow-inner">
              <div dangerouslySetInnerHTML={{ __html: brevoEmailData.htmlContent }} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(brevoEmailData.htmlContent);
                  showToast('📋 Email HTML content copied to clipboard!', 'info');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                📋 Copy Email Text
              </button>

              <button
                type="button"
                onClick={handleDispatchBrevoEmail}
                disabled={brevoEmailData.isSending}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2"
              >
                {brevoEmailData.isSending ? 'Sending via Brevo...' : '📧 Send Customer Email via Brevo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

