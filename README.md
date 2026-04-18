# Depot Management Web

Frontend for the **Depot Container Management** capstone project (SNP). Built with **Angular 19** (standalone components + signals), **PrimeNG 19** (Aura theme), **Tailwind CSS v4**, **Konva 10** for the Yard Map canvas, and **SignalR** for realtime updates.

![CI](https://github.com/mrstarkng/depot-management-web/actions/workflows/ci.yml/badge.svg)

---

## Quickstart

```bash
npm install
npm start          # dev server at http://localhost:4200
```

The dev server proxies `/api/*` and `/hubs/*` to the backend at `http://localhost:5067` (see `proxy.conf.json`).

### Production build

```bash
npm run build
```

### Unit tests

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

### Docker

```bash
docker build -t depot-management-web .
docker run -p 80:80 depot-management-web
```

---

## Architecture

```
src/app/
├── core/
│   ├── guards/          # authGuard, guestGuard, role guards (yardAccess, orderAccess, managerAccess, …)
│   ├── interceptors/    # authInterceptor (JWT + 401 refresh), mockApiInterceptor (dev-only)
│   ├── models/          # TypeScript interfaces matching backend DTOs
│   ├── services/        # AuthService, DepotService, UsersService, YardMapService (REST + SignalR)
│   └── components/      # Shared UI: StatusBadge, SlideOver, ConfirmDialog, Pagination, SectionDivider
└── pages/
    ├── auth/            # Login
    ├── dashboard/       # KPI cards, recent activity, expiring orders
    ├── yard-blocks/     # Block CRUD (Physical / Virtual; Category dropdown per DEC-009)
    ├── containers/      # Container master CRUD + detail (visit history, current location)
    ├── operations/      # 4 tabs: Gate-In, Gate-Out, In Depot, Relocate (Reactive Forms validators)
    ├── delivery-orders/ # DO list + detail (eligible containers, release history)
    ├── yard-map/        # Konva canvas + drill-in + Layout Editor (DEC-009)
    ├── customers/       # Reference data
    ├── line-operators/  # Reference data
    └── users/           # User management (Manager only)
```

---

## Role matrix (DEC-007)

| Capability | GateOperator | YardPlanner | OrderClerk | Manager |
|---|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Yard Blocks CRUD | — | ✓ | — | ✓ |
| Containers CRUD | — | ✓ | — | ✓ |
| Operations (Gate-In/Out) | ✓ | — | — | ✓ |
| Operations (Relocate) | — | ✓ | — | ✓ |
| Delivery Orders | — | — | ✓ | ✓ |
| Customers / Line Operators | — | — | ✓ | ✓ |
| Yard Map view | ✓ | ✓ | ✓ | ✓ |
| Yard Map Layout Editor | — | ✓ (requires Manager grant) | — | ✓ |
| User Management | — | — | — | ✓ |

---

## Contributing

- Every PR runs `npm ci && npm run build && npm test` via GitHub Actions. Keep it green.
- Follow the `.editorconfig` (LF, 2-space indent, UTF-8).
- No `--no-verify` commits, no new npm packages without a documented reason.
- See `.github/PULL_REQUEST_TEMPLATE.md` for the PR checklist.

## License

MIT — see [`LICENSE`](LICENSE).
