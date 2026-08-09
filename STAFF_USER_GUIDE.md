# 🏴󠁧󠁢󠁳󠁣󠁴󠁮󠁧 HIGHLAND KILT HIRE — STAFF USER GUIDE & STANDARD OPERATING PROCEDURES (SOP)

Welcome to the **Highland Kilt Hire Back Office QR Portal**! This guide outlines the standard operating procedures for shop floor assistants, inventory managers, and master admins.

---

## 📱 1. Automated Floor Scanner & 2-Scan Garment Lifecycle

The terminal is equipped with a zero-friction QR camera scanner. Scanning any physical garment QR code triggers automated workflows based on the garment's current state:

### 🆕 Scan 1: Unregistered Tag Registration
- Scanning an unprinted or new QR tag opens the **New Item Registration Form**.
- **Admin Specification Locking**: The Category (*Kilts, Jackets, Sporrans, Brogues*) and Sizing Demographic (*Adult Sizing vs Kids Sizing*) are **automatically locked** to match the Master Admin's printed batch specification (`🔒 Locked by Admin Batch`). Staff cannot mislabel a Kids batch tag as an Adult garment or change category.
- **Master Pricing Derivation**: Hire rates and security deposits are automatically derived from the **Master Category Pricing Matrix**. Staff are no longer asked to manually type prices.

### 🏷️ Scan 2: Recognized Garment Action Modal
- Scanning any registered garment pops up the **Garment Scan Recognized 5-Option Action Modal**:
  1. 🛒 **Start New Order PO (Hire Out)**: Starts an outgoing hire order with this garment.
  2. 🟢 **Return to Available Stock**: Places the garment back into available store inventory.
  3. 🧼 **Place in Dry Cleaning**: Marks garment as out at the laundry.
  4. 🔧 **Place in Repair Workshop**: Marks garment as under maintenance.
  5. 📦 **Retire / Sold as Ex-Hire**: Retires the garment from active rental stock.
- **Duplicate Prevention**: Re-scanning an existing tag never duplicates the garment in the database.

---

## 🛒 2. Outgoing Order PO Builder & Embedded Camera Scanner

When creating customer hire orders (single outfits or multi-garment wedding party hires):

1. **Continuous Camera Scanning**: The live camera scanner stays open at the top of the **Outgoing Order PO Builder**. Staff can continuously scan 1, 2, 5, 10, 20+ garments directly into the order list without popups blocking the screen.
2. **Order Line Items**: Displays ONLY the garments scanned for **THIS specific hire order**, complete with QR Code ID, Category, Size, Tartan, Hire Fee, and a 1-tap `✕ Remove` button.
3. **✨ AI Outfit Match Recommendations Tab**: Expandable tab that analyzes scanned garments and suggests available matching accessories (*Jackets, Sporrans, Brogues, Shirts, Socks, Waistcoats*) in stock for 1-tap addition.
4. **Full Rigout Price Cap**: Multi-item outfit hires automatically apply price capping rules (e.g. Full Kilt Rigout cap).

---

## 🏷️ 3. Guaranteed Unique QR Code Batch Generation

1. **100% Collision-Free Sequential Codes**: When creating new label sheets (batches of 10, 50, 100 QRs), the system checks all past printed sheets and live stock to guarantee sequential numbering (e.g. `KILT-1001` → `KILT-1050`) with zero duplicate risk.
2. **1-Time Printing Lock**: Printed sheets are locked to prevent duplicate sheet printouts.
3. **Authorized Single Tag Reprints**: Master Admin PIN (`1234`) is required to reprint individual damaged or lost tags.

---

## 📊 4. Stock Inventory Search, Sorting & Pagination

- **Real-Time Search Bar**: Instantly filter stock across Item IDs, Titles, Categories, Tartans, Sizes, and Statuses.
- **Clickable Header Sorting**: Click any column header (*QR Code, Item Name, Category, Demographic, Tartan / Colour, Status*) to toggle ascending (`▲`) or descending (`▼`) sorting.
- **Interactive Pagination**: Select rows per page (`10`, `20`, `30`, `50`, `100`) and navigate pages seamlessly.

---

## 📅 5. Availability & Booking Calendar

- **Date Picker**: Select target wedding/event dates to check live garment availability.
- **Live Status Summaries**: View count of Available, Booked, and In-Cleaning garments for selected dates.
- **1-Click Booking**: Tap "Book Hire" on any available garment to pre-fill the PO Builder for that event date.

---

*Highland Kilt Hire QR Portal — Powered by ISO 18004 Standard Barcodes & Cloud Firestore Synchronization.*
