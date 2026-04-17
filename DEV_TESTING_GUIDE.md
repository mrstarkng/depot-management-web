# Depot Management Web — Dev Environment & Manual Testing Guide

## Prerequisites

| Tool    | Version  | Check command   |
|---------|----------|-----------------|
| Node.js | >= 18.x  | `node -v`       |
| npm     | >= 9.x   | `npm -v`        |

---

## 1. Install Dependencies

```bash
cd ~/Projects/depot-management-web
npm install
```

---

## 2. Running Modes

### Mode A: UI-Only (Mock Data — No Backend Needed)

The project includes a built-in **mock API interceptor** that returns realistic fake data for every API endpoint. This is the fastest way to verify UI/design.

**How it works:** The mock interceptor (`src/app/core/interceptors/mock-api.interceptor.ts`) intercepts all `/api/*` HTTP calls and returns pre-built sample data with simulated network latency (150–400ms). No backend or database is required.

**To enable (already enabled by default):**

Check that `mockApiInterceptor` is in the interceptors array in `src/app/app.config.ts`:

```typescript
provideHttpClient(withInterceptors([mockApiInterceptor, authInterceptor])),
```

**Start the dev server:**

```bash
npm start
```

Open **http://localhost:4200** in your browser.

### Mode B: Full Stack (Real Backend API)

When you're ready to test with the real .NET API backend:

**Step 1 — Disable the mock interceptor.**

In `src/app/app.config.ts`, remove `mockApiInterceptor` from the interceptors array:

```typescript
// Before (mock mode):
provideHttpClient(withInterceptors([mockApiInterceptor, authInterceptor])),

// After (real API mode):
provideHttpClient(withInterceptors([authInterceptor])),
```

**Step 2 — Start the backend API** (port 5000):

```bash
# Option 1: Docker (recommended — includes SQL Server)
cd ~/Projects/depot-management-api
docker-compose -f docker-compose.local.yml up -d

# Option 2: .NET CLI (requires local SQL Server on port 1433)
cd ~/Projects/depot-management-api/src/DepotManagement.Api
dotnet run
```

The API runs on `http://localhost:5000` (Docker) or `http://localhost:5067` (.NET CLI).

> If using .NET CLI on port 5067, update `proxy.conf.json` target to match:
> ```json
> { "/api": { "target": "http://localhost:5067", "secure": false } }
> ```

**Step 3 — Start the frontend:**

```bash
cd ~/Projects/depot-management-web
npm start
```

The Angular dev server (port 4200) proxies `/api/*` requests to the backend via `proxy.conf.json`.

---

## 3. Kill a Port (When Port Is Already in Use)

If you see `Error: listen EADDRINUSE :::4200` or similar:

```bash
# Find what process is using port 4200
lsof -i :4200

# Kill it by PID (replace 12345 with the actual PID from the output)
kill -9 12345

# One-liner: find and kill whatever is on port 4200
lsof -ti :4200 | xargs kill -9
```

Common ports in this project:

| Port | Service                        |
|------|--------------------------------|
| 4200 | Angular dev server (frontend)  |
| 5000 | Backend API (Docker)           |
| 5067 | Backend API (.NET CLI)         |
| 1433 | SQL Server (Docker)            |

```bash
# Kill frontend
lsof -ti :4200 | xargs kill -9

# Kill backend API (Docker)
lsof -ti :5000 | xargs kill -9

# Kill backend API (.NET CLI)
lsof -ti :5067 | xargs kill -9

# Or stop all Docker containers
cd ~/Projects/depot-management-api
docker-compose -f docker-compose.local.yml down
```

---

## 4. Manual UI Test Checklist

After starting the dev server (`npm start`), open **http://localhost:4200** and walk through each page.

### 4.1 Dashboard (`/`)

- [ ] 4 KPI cards display: **Total InDepot**, **Today Gate-In**, **Today Gate-Out**, **Yard Occupancy %**
- [ ] InDepot card is clickable (navigates to `/operations` In Depot tab)
- [ ] Today Gate-In card is clickable (navigates to `/operations` Inbound tab)
- [ ] Block Occupancy horizontal bar chart shows bars for each physical block
- [ ] Bars >90% occupancy show red color
- [ ] Recent Activity table shows last movements with color-coded action badges
- [ ] Expiring Soon table shows orders expiring within 7 days
- [ ] Page auto-refreshes (data reloads every 60 seconds — watch the network tab)

### 4.2 Yard Blocks (`/yard-blocks`)

- [ ] Table loads with 6 blocks (4 Physical, 2 Virtual)
- [ ] Columns: Code, Type, Bays, Rows, Tiers, Containers, Status
- [ ] Physical blocks show bay/row/tier counts; Virtual blocks show "—"
- [ ] Search filter works (type "A1")
- [ ] Type filter dropdown works (Physical / Virtual)
- [ ] Status filter dropdown works (Active / Inactive)
- [ ] "Reset" clears all filters
- [ ] Column headers are sortable (click to toggle asc/desc)
- [ ] Pagination controls appear at bottom
- [ ] Click **New Block** — slide-over opens with form
  - [ ] Block Type = Physical shows Dimensions section (Bay/Row/Tier)
  - [ ] Block Type = Virtual hides Dimensions
  - [ ] Max Capacity auto-calculates from Bay x Row x Tier
  - [ ] Cancel closes slide-over
- [ ] Kebab menu (three dots) on each row:
  - [ ] **Edit** — opens slide-over pre-filled
  - [ ] **View on Map** — appears only for Physical blocks
  - [ ] **Delete** — shows confirmation dialog

### 4.3 Containers (`/containers`)

- [ ] Table loads with 30 containers
- [ ] Columns: Container #, Type, ISO Code, Size, Owner, Condition, Status (In/Out badge)
- [ ] Container # is a clickable link to detail page
- [ ] Search by number/owner works
- [ ] Type, Size, Condition filters work
- [ ] Column headers are sortable
- [ ] Click **New Container**:
  - [ ] Container Number field auto-uppercases
  - [ ] BIC format hint shows below the field
  - [ ] On blur, uniqueness check runs ("Checking availability..." text appears)
  - [ ] Type, Size, ISO Code, Max Weight, Tare Weight, Date of Manufacture, Owner, Condition fields present
- [ ] Kebab menu: **Edit** and **View Details**

### 4.4 Container Detail (`/containers/:containerNumber`)

- [ ] Breadcrumb shows: Home > Containers > XXXX
- [ ] Back arrow navigates to container list
- [ ] Container info card shows all details
- [ ] Current Location card shows yard position (or "Not in depot")
- [ ] Visit History table shows past visits

### 4.5 Operations — Inbound Tab (`/operations`, tab 1)

- [ ] 4 tabs visible: **Inbound**, **Outbound**, **In Depot**, **Relocate**
- [ ] Left panel: "Record Gate-In" form
  - [ ] Container search autocomplete — shows containers NOT in depot
  - [ ] Selecting a container fills the number
  - [ ] Line Operator dropdown populated
  - [ ] Yard Block dropdown shows code + type
  - [ ] Bay/Row/Tier fields appear only when Physical block selected
  - [ ] Classification (A/B/C/D) and Condition (Normal/Damaged) dropdowns
  - [ ] Inbound Vehicle required field
  - [ ] Remarks textarea
  - [ ] Submit button disabled until required fields filled
  - [ ] Inline error banner appears on failed submit (red box above button)
  - [ ] Success shows toast notification and adds to Recent list
- [ ] Right panel: "Recent Inbound" list

### 4.6 Operations — Outbound Tab (tab 2)

- [ ] Container search autocomplete — shows only containers IN depot
- [ ] After selecting container, info card shows current location/grade/condition
- [ ] Order search autocomplete — shows non-expired orders with remaining qty
- [ ] After selecting order, order info card shows remaining quantities per line
- [ ] Vehicle field (optional)
- [ ] Remarks textarea
- [ ] Submit and Recent Outbound list

### 4.7 Operations — In Depot Tab (tab 3)

- [ ] 3 summary cards: **Total InDepot**, **Physical**, **Virtual**
- [ ] Filter bar: search, Block filter, Classification filter, Type filter
- [ ] Table: Container#, Operator, Block, Bay, Row, Tier, Grade, Condition, Inbound At
- [ ] Click a row to expand — shows movement history timeline
- [ ] Expanded row has **Relocate** and **Gate-Out** buttons
- [ ] Relocate opens slide-over with relocation form
- [ ] Pagination works

### 4.8 Operations — Relocate Tab (tab 4)

- [ ] Container search autocomplete (InDepot only)
- [ ] After selection, "Current Location" card shows container's current block/position
- [ ] New Block dropdown, Bay/Row/Tier (conditional on Physical)
- [ ] Remarks field
- [ ] Submit button, inline error display
- [ ] Right panel: "Recent Relocations" list

### 4.9 Delivery Orders (`/delivery-orders`)

- [ ] Table: Order#, Operator, Customer, Vessel, Expiry, Status badge
- [ ] Filters: search, Status (All/Open/Fulfilled/Expired), Operator dropdown, Date range (from/to)
- [ ] Click row to expand inline detail: order lines with qty/released/remaining
- [ ] Voyage number and remarks shown in expanded header
- [ ] Column sort works
- [ ] Click **New Order**:
  - [ ] Fields: Order Number, Line Operator, Customer, Order Date (default today), Expiry Date, Vessel, Voyage, Remarks
  - [ ] Order Lines: add/remove lines with Type, Size, ISO Code, Quantity
  - [ ] Minimum 1 line enforced (can't remove last)
- [ ] Order # in table links to detail page

### 4.10 Delivery Order Detail (`/delivery-orders/:orderNumber`)

- [ ] Breadcrumb and back arrow
- [ ] Status badge (Open/Fulfilled/Expired)
- [ ] **Edit Order** button visible for Open orders only (hidden for Fulfilled/Expired)
- [ ] Order Info card: Operator, Customer, Tax Code, Vessel, Expiry, Voyage
- [ ] Summary card: Requested / Released / Remaining counts with progress bar
- [ ] Order Lines table: Type, Qty, Released, Remaining, Depot Stock, Can Fulfill icon
  - [ ] Fully released lines show strikethrough + opacity
- [ ] Eligible Containers table with Release button
- [ ] **Release History** section appears when there are released containers

### 4.11 Customers (`/customers`)

- [ ] Table: Tax Code, Name, Email, Phone, Status badge
- [ ] Status filter (All/Active/Inactive)
- [ ] Search works
- [ ] Click **New Customer** — form with: Tax Code, Name, Email, Phone, Address, Contact Person, Active toggle
- [ ] Kebab menu: **Edit** (opens pre-filled form), **Deactivate/Activate** (with confirm dialog)

### 4.12 Line Operators (`/line-operators`)

- [ ] Table: Code, Name, Email, Phone, Country, Status badge
- [ ] Status filter, search
- [ ] Click **New Operator** — form: Code (max 10, auto-uppercase, disabled on edit), Name, Email, Phone, Country, Address, Contact Person, Active toggle
- [ ] Kebab menu: Edit, Deactivate/Activate with confirm dialog

### 4.13 Cross-Cutting Checks

- [ ] **Sidebar navigation**: all menu items navigate correctly
- [ ] **Sidebar collapse**: toggle button collapses/expands sidebar
- [ ] **Mobile responsive**: sidebar collapses to hamburger menu on small screens
- [ ] **Toast notifications**: success (green) and error (red) toasts appear top-right
- [ ] **Confirm dialogs**: appear for delete/deactivate actions with Cancel/Confirm buttons
- [ ] **Status badges**: consistent color coding (Active=green, Inactive=gray, Expired=red, Fulfilled=green)
- [ ] **Pagination**: all table pages show item count, page navigation, items-per-page selector
- [ ] **Loading states**: tables show "Loading..." before data arrives
- [ ] **Empty states**: tables show "No X found" when filtered results are empty

---

## 5. Quick Reference Commands

```bash
# Start dev server (mock mode)
npm start

# Build for production
npm run build

# Check if port 4200 is in use
lsof -i :4200

# Kill port 4200
lsof -ti :4200 | xargs kill -9

# Open in browser
open http://localhost:4200
```

---

## 6. Switching Between Mock and Real API

| Mode      | `app.config.ts` interceptors                              | Backend needed? |
|-----------|------------------------------------------------------------|-----------------|
| Mock (UI) | `[mockApiInterceptor, authInterceptor]`                    | No              |
| Real API  | `[authInterceptor]`                                        | Yes             |

> **Important:** Remember to remove `mockApiInterceptor` before committing to production. It should only be used for local UI development and testing.
