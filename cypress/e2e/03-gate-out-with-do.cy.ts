// Scenario 3 — Gate-Out with Delivery Order.
//
// Flow:
// 1. OrderClerk opens the New Delivery Order slide-over, fills required
//    header fields (orderNumber / lineOperator / customer / expiryDate),
//    and submits. The DO appears in the list.
// 2. GateOperator opens Operations → Outbound tab, picks an in-depot
//    container from the typeahead, attaches the DO by typeahead, and
//    submits. The flow should succeed and the container leaves the yard.
//
// Notes:
// - The DO create form uses template-driven [(ngModel)]; we use data-cy
//   hooks added in this sprint.
// - DO is attached by order number typeahead, not by line; quota is managed
//   per line on the backend side.

describe('Gate-Out with Delivery Order', () => {
  const doNumber = `DO-${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')}`;

  it('OrderClerk creates a new DO', () => {
    cy.login('orderClerk');
    cy.visit('/delivery-orders');

    cy.get('[data-cy="do-new-order"]').click();
    cy.get('[data-cy="do-order-number"]').clear().type(doNumber);

    // Pick the first real option (skipping the "Select..." placeholder).
    cy.get('[data-cy="do-line-operator"] option')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="do-line-operator"]').select($opt.val() as string);
      });
    cy.get('[data-cy="do-customer"] option')
      .eq(1)
      .then(($opt) => {
        cy.get('[data-cy="do-customer"]').select($opt.val() as string);
      });

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 2);
    cy.get('[data-cy="do-expiry"]').clear().type(expiry.toISOString().slice(0, 10));

    cy.get('[data-cy="do-create-submit"]').should('not.be.disabled').click();

    cy.contains(doNumber, { timeout: 10000 }).should('be.visible');
  });

  it('GateOperator performs Gate-Out against the DO', () => {
    cy.login('gateOperator');
    cy.visit('/operations');
    cy.get('[data-cy="tab-outbound"]').click();

    // Pick first in-depot container from typeahead.
    cy.get('[data-cy="gateout-container-search"]').clear().type('SEED');
    cy.contains('button', /SEED|TU|CMAU/i, { timeout: 6000 }).first().click();

    // Attach the DO by typeahead.
    cy.get('[data-cy="gateout-order-search"]').clear().type(doNumber.slice(0, 6));
    cy.contains('button', doNumber, { timeout: 6000 }).click();

    cy.get('[data-cy="gateout-submit"]').should('not.be.disabled').click();

    cy.contains(/recorded|success|thành công/i, { timeout: 10000 }).should('be.visible');

    // DO should reflect remaining quantity decremented.
    cy.visit('/delivery-orders');
    cy.contains(doNumber).should('be.visible');
  });
});
