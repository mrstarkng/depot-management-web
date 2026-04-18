// Scenario 3 — Gate-Out with Delivery Order.
//
// OrderClerk creates a DO against a container currently in the yard, then
// GateOperator performs a Gate-Out against that DO. The container should
// disappear from the block slot and the DO should transition to Consumed.

describe('Gate-Out with Delivery Order', () => {
  const doNumber = `DO-${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')}`;

  it('OrderClerk creates a DO for an in-yard container', () => {
    cy.login('orderClerk');
    cy.visit('/delivery-orders');

    cy.contains('button', /new|create|tạo/i).click();

    cy.get('input[formcontrolname="doNumber"]').clear().type(doNumber);
    cy.get('input[formcontrolname="containerNumber"]')
      .parents('form')
      .find('input[formcontrolname="containerNumber"]')
      .clear()
      .type('SEED00000001'); // Seeded container, present in every reset.

    // Expiry date: 2 days from now.
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 2);
    const expiryISO = expiry.toISOString().slice(0, 10);
    cy.get('input[formcontrolname="expiryDate"], input[type="date"]').first().clear().type(expiryISO);

    cy.contains('button', /save|create|submit|xác nhận/i).click();

    cy.contains(doNumber, { timeout: 10000 }).should('be.visible');
  });

  it('GateOperator performs Gate-Out against the DO', () => {
    cy.login('gateOperator');
    cy.visit('/operations');

    cy.contains(/gate-?out/i).click();

    cy.get('input[formcontrolname="deliveryOrderNumber"], input[name="deliveryOrderNumber"]')
      .first()
      .clear()
      .type(doNumber);
    cy.contains('button', /gate-?out|submit|confirm/i).click();

    cy.contains(/success|đã gate|thành công/i, { timeout: 10000 }).should('be.visible');

    // DO consumed.
    cy.visit('/delivery-orders');
    cy.contains(doNumber)
      .parents('tr')
      .within(() => {
        cy.contains(/consumed|đã sử dụng/i).should('be.visible');
      });
  });
});
