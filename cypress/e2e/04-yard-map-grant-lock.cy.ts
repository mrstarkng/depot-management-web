// Scenario 4 — Yard Map Grant Lock workflow (DEC-009).
//
// YardPlanner requests the layout edit lock. Manager sees the request and
// clicks Grant. YardPlanner's Save Layout + Release Lock become enabled.
//
// Because Cypress drives one browser at a time, this scenario relies on
// re-visiting the page after each login swap — realtime is observed via the
// lock banner state after a fresh navigation, not an open tab.

describe('Yard Map Grant Lock', () => {
  it('YardPlanner requests, Manager grants, YardPlanner saves & releases', () => {
    // YardPlanner requests.
    cy.login('yardPlanner');
    cy.visit('/yard-map');
    cy.contains('button', /edit layout/i, { timeout: 10000 }).click();
    cy.contains('button', /request edit|request lock/i).click();
    cy.contains(/requesting|waiting|pending/i, { timeout: 10000 }).should('be.visible');

    // Manager grants.
    cy.login('manager');
    cy.visit('/yard-map');
    cy.contains(/yardplanner.*requested|pending request/i, { timeout: 10000 }).should('be.visible');
    cy.contains('button', /grant/i).click();
    cy.contains(/granted|locked by/i, { timeout: 10000 }).should('be.visible');

    // YardPlanner returns; editor now active.
    cy.login('yardPlanner');
    cy.visit('/yard-map');
    cy.contains(/you hold the lock|you hold lock/i, { timeout: 10000 }).should('be.visible');
    cy.contains('button', /save layout/i).should('not.be.disabled');

    cy.contains('button', /save layout/i).click();
    cy.contains(/saved|thành công/i, { timeout: 10000 }).should('be.visible');

    cy.contains('button', /release lock/i).click();
    cy.contains(/layout unlocked|available/i, { timeout: 10000 }).should('be.visible');
  });

  it('Manager can revoke a held lock', () => {
    cy.login('yardPlanner');
    cy.visit('/yard-map');
    cy.contains('button', /edit layout/i).click();
    cy.contains('button', /request edit|request lock/i).click();

    cy.login('manager');
    cy.visit('/yard-map');
    cy.contains('button', /grant/i).click();

    // Manager now sees read-only-locked(other) with Revoke.
    cy.contains('button', /revoke/i, { timeout: 10000 }).click();
    cy.contains('button', /yes|confirm|xác nhận/i).click();
    cy.contains(/layout unlocked|available|revoked/i, { timeout: 10000 }).should('be.visible');
  });
});
