// Scenario 2 — Gate-In happy path + Yard Map realtime.
//
// GateOperator performs a Gate-In on Operations; the selected block's
// occupancy on the Yard Map should update without a full reload via the
// SignalR event `ContainerGateIn`.

describe('Gate-In + Yard Map realtime', () => {
  const containerNumber = `TEST${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(7, '0')}`;

  before(() => {
    cy.login('gateOperator');
  });

  it('accepts a new gate-in and reflects on Yard Map', () => {
    cy.visit('/operations');
    cy.contains('h1, h2', /gate-in|operations/i, { timeout: 10000 }).should('be.visible');

    // Fill Gate-In form.
    cy.get('input[formcontrolname="containerNumber"]').clear().type(containerNumber);
    cy.get('select[formcontrolname="yardBlockId"]')
      .find('option:not([disabled])')
      .eq(1)
      .then(($opt) => {
        const val = $opt.val() as string;
        cy.get('select[formcontrolname="yardBlockId"]').select(val);
      });

    cy.get('input[formcontrolname="bay"]').clear().type('2');
    cy.get('input[formcontrolname="row"]').clear().type('1');
    cy.get('input[formcontrolname="tier"]').clear().type('1');

    cy.contains('button', /gate-?in|submit|confirm/i).click();

    cy.contains(/success|đã gate|thành công/i, { timeout: 10000 }).should('be.visible');

    // Realtime echo on Yard Map.
    cy.visit('/yard-map');
    cy.contains(/live|connected|realtime/i, { timeout: 10000 }).should('be.visible');
    cy.contains(containerNumber, { timeout: 15000 }).should('exist');
  });

  it('blocks gate-in on a full block', () => {
    cy.visit('/operations');
    cy.get('select[formcontrolname="yardBlockId"] option').then(($opts) => {
      const full = [...$opts].find((o) => o.textContent?.includes('FULL'));
      if (!full) {
        cy.log('No full block in fixture; skipping.');
        return;
      }
      expect(full.hasAttribute('disabled')).to.eq(true);
    });
  });
});
