# Depot Management Web

Intern capstone project: Hệ thống quản lý depot cho SNP - Frontend built with Angular 19 + PrimeNG.

## Architecture

```
src/app/
  core/
    guards/          # Route guards (auth)
    interceptors/    # HTTP interceptors (auth token)
    models/          # TypeScript interfaces matching backend entities
    services/        # API client services
  pages/
    dashboard/       # Overview with summary cards
    yard-blocks/     # Yard block CRUD
    containers/      # Container master CRUD + detail view
    delivery-orders/ # Delivery order CRUD + detail view
    lifecycle/       # Gate in/out and relocate operations
```

## Domain Modules

| Page | Backend API |
|------|-------------|
| Dashboard | Summary aggregation |
| Yard Blocks | `/api/yard-blocks` |
| Containers | `/api/containers` |
| Gate In/Out | `/api/container-lifecycle` |
| Delivery Orders | `/api/delivery-orders` |

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Install & Run
```bash
npm install
npm start
```
App runs at `http://localhost:4200`. API requests are proxied to `http://localhost:5000` via `proxy.conf.json`.

### Build for Production
```bash
npm run build
```

### Run with Docker
```bash
docker build -t depot-management-web .
docker run -p 80:80 depot-management-web
```

## Tech Stack

- **Framework**: Angular 19 (standalone components, signals)
- **UI Library**: PrimeNG 19 + PrimeFlex + PrimeIcons
- **Theme**: Aura (dark mode supported)
- **HTTP**: HttpClient with functional interceptors
- **Routing**: Lazy-loaded standalone components
