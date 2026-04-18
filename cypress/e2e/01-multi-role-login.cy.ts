// Scenario 1 — Multi-role login.
//
// Each role seeded in cypress.env.json should be able to log in, land on the
// dashboard, and see the sidebar items their role grants.

describe('Multi-role login', () => {
  const matrix: Array<{
    role: 'manager' | 'yardPlanner' | 'gateOperator' | 'orderClerk';
    expected: string[];
    forbidden?: string[];
  }> = [
    {
      role: 'manager',
      expected: ['Dashboard', 'Operations', 'Yard Map', 'Yard Blocks', 'Delivery Orders'],
    },
    {
      role: 'yardPlanner',
      expected: ['Dashboard', 'Yard Map', 'Yard Blocks'],
    },
    {
      role: 'gateOperator',
      expected: ['Dashboard', 'Operations', 'Yard Map'],
    },
    {
      role: 'orderClerk',
      expected: ['Dashboard', 'Delivery Orders'],
    },
  ];

  matrix.forEach(({ role, expected, forbidden }) => {
    it(`${role} sees the right sidebar`, () => {
      cy.login(role);
      cy.visit('/dashboard');
      cy.contains('Dashboard', { matchCase: false }).should('be.visible');

      expected.forEach((label) => {
        cy.contains('nav a, aside a, [role="menuitem"]', label, { matchCase: false }).should('be.visible');
      });

      forbidden?.forEach((label) => {
        cy.contains('nav a, aside a, [role="menuitem"]', label, { matchCase: false }).should('not.exist');
      });
    });
  });

  it('rejects invalid credentials', () => {
    cy.visit('/login');
    cy.get('input[name="username"], input[formcontrolname="username"]').first().type('manager');
    cy.get('input[type="password"]').first().type('wrong-password');
    cy.contains('button', /login|sign in|đăng nhập/i).click();
    cy.contains(/invalid|incorrect|sai|không đúng/i).should('be.visible');
  });
});
