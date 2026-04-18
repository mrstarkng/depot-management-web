# Cypress E2E

Headless, CI-friendly end-to-end tests for the Depot Management web app.

## Prerequisites

1. Backend running at `http://localhost:5000` with the seed fixture applied.
2. Frontend running at `http://localhost:4200` (`npm start`).
3. `cypress.env.json` kept in sync with seed user credentials.

## Commands

```bash
# Interactive (opens Cypress UI)
npm run cypress:open

# Headless (CI)
npm run cypress:run
```

## Scenarios

| # | Spec | Covers |
| - | ---- | ------ |
| 1 | `01-multi-role-login.cy.ts` | Manager / YardPlanner / GateOperator / OrderClerk login + sidebar gating |
| 2 | `02-gate-in-realtime.cy.ts` | GateOperator Gate-In + Yard Map realtime echo + FULL block disable |
| 3 | `03-gate-out-with-do.cy.ts` | OrderClerk creates DO → GateOperator Gate-Out → DO consumed |
| 4 | `04-yard-map-grant-lock.cy.ts` | DEC-009 Request / Grant / Save / Release / Revoke |
| 5 | `05-form-validation.cy.ts` | Gate-In bay parity + tier stack validation |

## Notes

- Uses `cy.session()` so each role's token is cached across the suite.
- `cy.apiLogin(role)` hits the backend directly, skipping the login UI.
- Reset the database between full runs; each scenario assumes the stock seed.
