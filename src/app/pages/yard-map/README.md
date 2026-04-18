# Yard Map — DEC-009 Frontend

## Modes

- **Operations View** (default): everyone with map access (GateOperator, YardPlanner, Manager) sees the canvas + drill-in + overlays.
- **Layout Editor**: single-writer, grant-based lock. Manager grants themselves; YardPlanner must request → Manager grants.

## Lock state machine (`editor/layout-editor.store.ts`)

```
viewing ──request──▶ requesting ──LockAcquired(self)──▶ holding
viewing ──grantSelf──▶ holding
holding ──save──▶ savingLocked ──ok──▶ holding ──release──▶ viewing
holding ──LockExpired/Released──▶ viewing
* ──LockAcquired(other)──▶ readOnlyLocked
readOnlyLocked ──LockReleased──▶ viewing
```

- TTL 15 min; heartbeat every 60 s while in `holding`.
- `rowVersion` per block is captured in the dirty set and sent on `PUT /api/yard-map/layout`.

## Key files

- `yard-map.component.ts` + `.html` — page shell, toolbar, category chips, drill-in, realtime wiring.
- `konva/konva-yard-map.ts` — plain Konva renderer (Stage + Layers), fit-all, zoom, pan, drag emit.
- `yard-map.tokens.ts` — category color palette + overlay ramps + `resolveBlockFill`.
- `editor/layout-editor.store.ts` — lock FSM + dirty tracking + save/heartbeat.
- `yard-map.errors.ts` — 401/403/404/409/422/423 → toast descriptor.

## Live indicator

- Bound to `YardMapService.connectionState$` (`disconnected | connecting | connected | reconnecting`).
- On reconnect, the store re-fetches `/api/yard-map/layout/lock` to reseed FSM.

## Realtime events consumed

- `ContainerGateIn` / `ContainerMoved` / `ContainerGateOut` → patch drill-in slots.
- `LayoutSaved` → if revision differs from local, refetch overview.
- `LayoutLockAcquired/Released/Expired` → refresh lock state.
- `LayoutLockRequested` → Manager-only toast + approval dialog.

## Role matrix (UI)

| Capability | GateOperator | YardPlanner | Manager |
|---|:-:|:-:|:-:|
| Canvas + drill-in view | ✓ | ✓ | ✓ |
| Edit Layout button | — | Request only | ✓ |
| Save Layout | — | ✓ (if holder) | ✓ (if holder) |
| Approve request / Revoke | — | — | ✓ |
| Relocate from drill-in | — | ✓ | ✓ |
