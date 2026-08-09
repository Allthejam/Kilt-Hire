import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  KiltItem,
  QRBatch,
  PurchaseOrder,
  AuditLog,
  StaffUser,
  StaffInvite,
  CategoryPriceSetting,
} from '../app/types';

// Guard: throw a helpful error if called server-side
function requireDb() {
  if (!db) throw new Error('Firestore is only available on the client side.');
  return db;
}

// Helper to recursively remove undefined fields so Firestore setDoc never throws invalid data errors
function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean as T;
  }
  return data;
}

// --- STAFF PROFILES ----------------------------------------------------------

export async function getStaffProfiles(): Promise<StaffUser[]> {
  const snap = await getDocs(collection(requireDb(), 'users'));
  return snap.docs.map(d => d.data() as StaffUser);
}

export async function getStaffProfileById(uid: string): Promise<StaffUser | null> {
  const docRef = doc(requireDb(), 'users', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as StaffUser) : null;
}

export async function upsertStaffProfile(uid: string, data: StaffUser): Promise<void> {
  await setDoc(doc(requireDb(), 'users', uid), sanitizeForFirestore(data), { merge: true });
}

export async function deleteStaffProfile(uid: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'users', uid));
}

// --- INVITES -----------------------------------------------------------------

export async function getInvites(): Promise<StaffInvite[]> {
  const snap = await getDocs(collection(requireDb(), 'invites'));
  return snap.docs.map(d => d.data() as StaffInvite);
}

export async function upsertInvite(invite: StaffInvite): Promise<void> {
  await setDoc(doc(requireDb(), 'invites', invite.id), sanitizeForFirestore(invite), { merge: true });
}

export async function deleteInvite(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'invites', id));
}

// --- INVENTORY ITEMS ----------------------------------------------------------

export async function getItems(): Promise<KiltItem[]> {
  const snap = await getDocs(collection(requireDb(), 'items'));
  return snap.docs.map(d => d.data() as KiltItem);
}

export async function upsertItem(item: KiltItem): Promise<void> {
  await setDoc(doc(requireDb(), 'items', item.id), sanitizeForFirestore(item), { merge: true });
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'items', id));
}

// --- QR BATCHES ---------------------------------------------------------------

export async function getBatches(): Promise<QRBatch[]> {
  const snap = await getDocs(collection(requireDb(), 'batches'));
  return snap.docs.map(d => d.data() as QRBatch);
}

export async function upsertBatch(batch: QRBatch): Promise<void> {
  await setDoc(doc(requireDb(), 'batches', batch.id), sanitizeForFirestore(batch), { merge: true });
}

// --- PURCHASE ORDERS ----------------------------------------------------------

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const snap = await getDocs(collection(requireDb(), 'purchase_orders'));
  return snap.docs.map(d => d.data() as PurchaseOrder);
}

export async function upsertPurchaseOrder(po: PurchaseOrder): Promise<void> {
  await setDoc(doc(requireDb(), 'purchase_orders', po.id), sanitizeForFirestore(po), { merge: true });
}

// --- AUDIT LOGS ---------------------------------------------------------------

export async function getAuditLogs(): Promise<AuditLog[]> {
  const q = query(collection(requireDb(), 'audit_logs'), orderBy('timestamp', 'desc'), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as AuditLog);
}

export async function addAuditLogFS(log: AuditLog): Promise<void> {
  await setDoc(doc(requireDb(), 'audit_logs', log.id), sanitizeForFirestore(log));
}

export async function clearAuditLogsFS(): Promise<void> {
  const snap = await getDocs(collection(requireDb(), 'audit_logs'));
  await Promise.all(snap.docs.map(d => deleteDoc(doc(requireDb(), 'audit_logs', d.id))));
}

// --- PRICING ------------------------------------------------------------------

export interface PricingSettingsDoc {
  matrix: CategoryPriceSetting[];
  maxRigoutCapPrice?: number;
  kidMaxRigoutCapPrice?: number;
}

export async function getPricing(): Promise<PricingSettingsDoc | null> {
  const snap = await getDocs(collection(requireDb(), 'settings'));
  const pricingDoc = snap.docs.find(d => d.id === 'pricing');
  return pricingDoc ? (pricingDoc.data() as PricingSettingsDoc) : null;
}

export async function savePricing(matrix: CategoryPriceSetting[], maxRigoutCapPrice?: number, kidMaxRigoutCapPrice?: number): Promise<void> {
  await setDoc(
    doc(requireDb(), 'settings', 'pricing'), 
    sanitizeForFirestore({ matrix, maxRigoutCapPrice, kidMaxRigoutCapPrice }), 
    { merge: true }
  );
}

// --- SEED HELPER -------------------------------------------------------------

export async function seedCollectionIfEmpty<T extends { id: string }>(
  collectionName: string,
  items: T[],
  upsertFn: (item: T) => Promise<void>
): Promise<boolean> {
  const snap = await getDocs(collection(requireDb(), collectionName));
  if (snap.empty) {
    await Promise.all(items.map(item => upsertFn(item)));
    return true;
  }
  return false;
}
