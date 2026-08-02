# 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Highland Kilt & Clothing Hire Application

A complete, automated QR-code based management system for kilt and formal highland clothing rental shops. Designed for zero-friction iron-on QR label processing, single & multi-outfit wedding party hire orders, PayPal security deposit management, and strict physical QR return verification.

---

## 📁 File Structure

- `page.tsx`: Full interactive Next.js application page with Auto QR scanner terminal, Shop Assistant terminal mode, Master Admin Settings Matrix, Outgoing PO Builder, and Return Checklist.
- `types.ts`: TypeScript data models (`KiltItem`, `PurchaseOrder`, `POLineItem`, `QRBatch`, `CategoryPriceSetting`, `StaffUser`, `StaffInvite`, `AuditLog`).
- `mock-data.ts`: Initial dataset containing sample adult/kid garments, wedding party POs, staff accounts, and default pricing matrix.
- `qr-utils.ts`: Helper utilities for generating and rendering SVG/Canvas QR code labels.

---

## ⚡ Core Features

1. **Step 1: Master Admin QR Label Generator (Allan Only)**:
   - Prints 1-click sheets of unique iron-on fabric QR codes (e.g. `KILT-1001`, `JKT-1002`, `SPO-1003`).
   - Supports Adult vs Kid size groups across 10 categories.

2. **Step 2: Automated Outgoing Purchase Order Builder**:
   - Scanning 1st available garment automatically launches the PO Builder.
   - Continuous scanning accumulates 10, 20+ garments for full **Wedding Party Group Bookings** (Groom, Best Man, Groomsmen, Page Boys).
   - Automatically applies **Full Rigout Price Caps** (£120 Adult, £80 Kid cap per outfit) and sums PayPal security deposits.

3. **Step 3: Automated Return Inspection & Anti-Swap Security**:
   - Scanning ANY returned item immediately locates its Customer PO.
   - **Mandatory Physical QR Scan Verification**: Every returned item MUST be physically scanned with the QR reader before deposit refunding to prevent counterfeit swaps.
   - Calculates live PayPal deposit refund breakdown (e.g. £115 refunded, £15 retained for missing shoes).

4. **Master Admin Pricing Matrix**:
   - Master Admin controls prices & deposits for 10 categories duplicated for Adults and Kids.

5. **Master Admin Retired Archive Vault**:
   - Allows items to be removed from stock rotation (Sold Off, Stolen, Destroyed, Written Off) and archived in a secure vault.

6. **Shop Assistant Floor Mode**:
   - Simplified high-contrast floor terminal for shop workers with dedicated tabs for:
     - 📦 **In Stock** (with quick actions & edit options)
     - 🔄 **On Hire**
     - 🔧 **In Repair**

---

## 🔑 Demo Credentials

- **Master Admin (Allan)**: `admin@kilt-hire.co.uk` (PIN: `1234`)
- **Staff Member (Fiona MacLean)**: `fiona@kilt-hire.co.uk` (PIN: `1234`)
- **Sample Invite Code**: `HIGHLAND-STAFF-9901`

---

## 🚀 How to Run in any Next.js Project

Simply copy these 4 files into `src/app/kilt-hire/` (or any route directory) in your Next.js project. It uses standard React hooks and `localStorage` for complete offline persistence!
