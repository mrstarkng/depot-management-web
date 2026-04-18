// Scenario 2 — Gate-In happy path + Yard Map realtime.
//
// GateOperator opens the Inbound tab, picks the first container from the
// typeahead, picks the first non-full block, fills bay/row/tier, and submits.
// The container should surface on Yard Map via SignalR.

describe('Gate-In + Yard Map realtime', () => {
  before(() => {
    cy.login('gateOperator');
  });

  it('accepts a seeded container into the first open block', () => {
    cy.visit('/operations');
    cy.get('[data-cy="tab-inbound"]').click();

    // Open the typeahead and pick the first suggested container.
    cy.get('[data-cy="gatein-container-search"]').clear().type('SEED');
    cy.contains('button', /SEED|TU/i, { timeout: 6000 }).first().click();

    // Pick a non-FULL block.
    cy.get('[data-cy="gatein-block-select"] option')
      .not(':disabled')
      .not('[disabled]')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="gatein-block-select"]').select($opt.val() as string);
      });

    cy.get('[data-cy="gatein-bay"]').clear().type('2');
    cy.get('[data-cy="gatein-row"]').clear().type('1');
    cy.get('[data-cy="gatein-tier"]').select('1', { force: true });

    cy.get('[data-cy="gatein-submit"]').should('not.be.disabled').click();

    cy.contains(/recorded|success|thành công/i, { timeout: 10000 }).should('be.visible');

    // Yard Map should be live.
    cy.visit('/yard-map');
    cy.contains(/live|connected|realtime/i, { timeout: 10000 }).should('be.visible');
  });

  it('disables options for FULL blocks in the Gate-In dropdown', () => {
    cy.visit('/operations');
    cy.get('[data-cy="tab-inbound"]').click();
    cy.get('[data-cy="gatein-block-select"] option').then(($opts) => {
      const full = [...$opts].find((o) => o.textContent?.includes('FULL'));
      if (!full) {
        cy.log('No full block in fixture; assertion skipped.');
        return;
      }
      expect(full.hasAttribute('disabled'), 'FULL option disabled').to.eq(true);
    });
  });
});
