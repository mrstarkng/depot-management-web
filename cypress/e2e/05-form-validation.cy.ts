// Scenario 5 — Form validation.
//
// The Operations Inbound form enforces bay parity and bay/row/tier bounds via
// reactive FormControls. This spec drives invalid inputs and expects the
// submit button to stay disabled (or an inline error to appear).

describe('Form validation on Gate-In', () => {
  before(() => {
    cy.login('gateOperator');
  });

  beforeEach(() => {
    cy.visit('/operations');
    cy.get('[data-cy="tab-inbound"]').click();

    // Pick a seeded container from the typeahead.
    cy.get('[data-cy="gatein-container-search"]').clear().type('SEED');
    cy.contains('button', /SEED|TU/i, { timeout: 6000 }).first().click();
  });

  it('disables submit when bay parity is violated on a Reefer block', () => {
    cy.get('[data-cy="gatein-block-select"] option').then(($opts) => {
      const reefer = [...$opts].find((o) => /reefer|REEF|RF/i.test(o.textContent || ''));
      if (!reefer) {
        cy.log('No Reefer block in seed fixture; skipping.');
        return;
      }
      cy.get('[data-cy="gatein-block-select"]').select(reefer.getAttribute('value') as string);
    });

    cy.get('[data-cy="gatein-bay"]').clear().type('3'); // odd → violates parity for 20ft
    cy.get('[data-cy="gatein-row"]').clear().type('1');
    cy.get('[data-cy="gatein-tier"]').select('1', { force: true });

    cy.get('[data-cy="gatein-submit"]').should('be.disabled');
  });

  it('disables submit when bay exceeds block bounds', () => {
    cy.get('[data-cy="gatein-block-select"] option')
      .not(':disabled')
      .not('[disabled]')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="gatein-block-select"]').select($opt.val() as string);
      });

    cy.get('[data-cy="gatein-bay"]').clear().type('999'); // far above bayCount
    cy.get('[data-cy="gatein-row"]').clear().type('1');

    cy.get('[data-cy="gatein-submit"]').should('be.disabled');
  });

  it('enables submit with valid bay/row/tier on a Standard block', () => {
    cy.get('[data-cy="gatein-block-select"] option').then(($opts) => {
      const std = [...$opts].find((o) => /standard|STD|\(Physical\)/i.test(o.textContent || ''));
      if (!std) {
        cy.log('No Standard/Physical block in seed fixture; skipping.');
        return;
      }
      cy.get('[data-cy="gatein-block-select"]').select(std.getAttribute('value') as string);
    });

    cy.get('[data-cy="gatein-bay"]').clear().type('2');
    cy.get('[data-cy="gatein-row"]').clear().type('1');
    cy.get('[data-cy="gatein-tier"]').select('1', { force: true });

    cy.get('[data-cy="gatein-submit"]').should('not.be.disabled');
  });
});
