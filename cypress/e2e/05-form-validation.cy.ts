// Scenario 5 — Form validation.
//
// The Operations Gate-In form enforces bay parity (Reefer/Hazardous blocks
// only accept even bays) and tier stacking (tier cannot exceed block.maxTier).
// This spec drives the form with invalid inputs and expects the submit button
// to stay disabled or an inline error to appear.

describe('Form validation on Gate-In', () => {
  before(() => {
    cy.login('gateOperator');
  });

  beforeEach(() => {
    cy.visit('/operations');
  });

  it('rejects odd bay on a Reefer block', () => {
    cy.get('select[formcontrolname="yardBlockId"] option').then(($opts) => {
      const reefer = [...$opts].find((o) => /reefer|REEF/i.test(o.textContent || ''));
      if (!reefer) {
        cy.log('No Reefer block in seed fixture; skipping.');
        return;
      }
      cy.get('select[formcontrolname="yardBlockId"]').select(reefer.getAttribute('value') as string);
    });

    cy.get('input[formcontrolname="containerNumber"]').clear().type('TESTVALID01');
    cy.get('input[formcontrolname="bay"]').clear().type('3'); // odd — invalid
    cy.get('input[formcontrolname="row"]').clear().type('1');
    cy.get('input[formcontrolname="tier"]').clear().type('1');

    cy.contains(/bay must be even|bay phải chẵn|invalid bay/i, { timeout: 4000 }).should('be.visible');
    cy.contains('button', /gate-?in|submit/i).should('be.disabled');
  });

  it('rejects tier above block maxTier', () => {
    cy.get('select[formcontrolname="yardBlockId"]')
      .find('option:not([disabled])')
      .eq(1)
      .then(($opt) => {
        cy.get('select[formcontrolname="yardBlockId"]').select($opt.val() as string);
      });

    cy.get('input[formcontrolname="containerNumber"]').clear().type('TESTVALID02');
    cy.get('input[formcontrolname="bay"]').clear().type('2');
    cy.get('input[formcontrolname="row"]').clear().type('1');
    cy.get('input[formcontrolname="tier"]').clear().type('99'); // way above maxTier

    cy.contains(/tier.*max|tier không vượt quá|invalid tier/i, { timeout: 4000 }).should('be.visible');
    cy.contains('button', /gate-?in|submit/i).should('be.disabled');
  });

  it('accepts valid bay/row/tier on Standard block', () => {
    cy.get('select[formcontrolname="yardBlockId"] option').then(($opts) => {
      const std = [...$opts].find((o) => /standard|STD/i.test(o.textContent || ''));
      if (!std) {
        cy.log('No Standard block in seed fixture; skipping.');
        return;
      }
      cy.get('select[formcontrolname="yardBlockId"]').select(std.getAttribute('value') as string);
    });

    cy.get('input[formcontrolname="containerNumber"]').clear().type('TESTVALID03');
    cy.get('input[formcontrolname="bay"]').clear().type('1');
    cy.get('input[formcontrolname="row"]').clear().type('1');
    cy.get('input[formcontrolname="tier"]').clear().type('1');

    cy.contains('button', /gate-?in|submit/i).should('not.be.disabled');
  });
});
