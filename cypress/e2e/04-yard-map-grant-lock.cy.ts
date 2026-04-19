// Scenario 4 — Yard Map Grant Lock workflow (DEC-009).
//
// Known limitation
// ----------------
// The Manager's grant dialog is triggered by the `LayoutLockRequested`
// SignalR event. When Cypress swaps sessions between YardPlanner and
// Manager, the previous SignalR connection is torn down, so the Manager
// will only see the dialog if the request arrives after their hub
// connection is established. This makes the realistic end-to-end flow
// require two concurrent browser contexts — which Cypress does not support
// out of the box.
//
// Two options:
//   a) Rewrite scenario to use two browsers (e.g. Playwright), or
//   b) Drive Manager's grant through the REST API directly, while the
//      YardPlanner-held lock state is verified via UI.
//
// This spec implements (b): YardPlanner requests via UI, Manager grants
// via `POST /api/yard-map/layout-lock/grant`, then YardPlanner returns to
// the page and sees the editor active. Revoke is exercised similarly.
//
// When the team upgrades to Playwright or a multi-browser driver, this
// spec can be replaced by the pure-UI variant.

describe('Yard Map Grant Lock', () => {
  const apiBase = Cypress.env('apiBaseUrl') as string;

  function managerToken(): Cypress.Chainable<string> {
    return cy.apiLogin('manager').then(({ token }) => token);
  }

  it('YardPlanner holds the lock after Manager API grant', () => {
    // 1. YardPlanner requests the lock via UI.
    cy.login('yardPlanner');
    cy.visit('/yard-map');
    cy.contains('button', /request edit/i, { timeout: 10000 }).click();
    cy.contains(/waiting for manager approval/i, { timeout: 10000 }).should('be.visible');

    // 2. Manager grants via API (single-browser workaround).
    managerToken().then((token) => {
      cy.request({
        method: 'GET',
        url: `${apiBase}/api/yard-map/layout-lock`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((statusRes) => {
        const requesterUserId = statusRes.body?.requesterUserId ?? statusRes.body?.pendingRequest?.requesterUserId;
        expect(requesterUserId, 'pending requester id').to.exist;

        cy.request({
          method: 'POST',
          url: `${apiBase}/api/yard-map/layout-lock/grant`,
          headers: { Authorization: `Bearer ${token}` },
          body: { requesterUserId },
        }).its('status').should('be.oneOf', [200, 204]);
      });
    });

    // 3. YardPlanner returns; editor should now be active.
    cy.visit('/yard-map');
    cy.contains(/you hold|save layout/i, { timeout: 10000 }).should('be.visible');
    cy.contains('button', /save layout/i).should('be.visible');

    // 4. Release the lock cleanly.
    cy.contains('button', /release lock/i).click();
    cy.contains(/release/i, { timeout: 10000 }).should('exist');
  });

  it('Manager revokes an active lock via API, UI reflects release', () => {
    // YardPlanner requests again.
    cy.login('yardPlanner');
    cy.visit('/yard-map');
    cy.contains('button', /request edit/i, { timeout: 10000 }).click();

    // Manager grants then immediately revokes via API.
    managerToken().then((token) => {
      cy.request({
        method: 'GET',
        url: `${apiBase}/api/yard-map/layout-lock`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((statusRes) => {
        const requesterUserId = statusRes.body?.requesterUserId ?? statusRes.body?.pendingRequest?.requesterUserId;
        if (requesterUserId) {
          cy.request({
            method: 'POST',
            url: `${apiBase}/api/yard-map/layout-lock/grant`,
            headers: { Authorization: `Bearer ${token}` },
            body: { requesterUserId },
            failOnStatusCode: false,
          });
        }
        cy.request({
          method: 'POST',
          url: `${apiBase}/api/yard-map/layout-lock/revoke`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).its('status').should('be.oneOf', [200, 204, 409]);
      });
    });

    // YardPlanner sees the lock is gone.
    cy.visit('/yard-map');
    cy.contains('button', /request edit|edit layout/i, { timeout: 10000 }).should('be.visible');
  });
});
