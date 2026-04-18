/// <reference types="cypress" />

type RoleKey = 'manager' | 'yardPlanner' | 'gateOperator' | 'orderClerk';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(role: RoleKey): Chainable<void>;
      apiLogin(role: RoleKey): Chainable<string>;
    }
  }
}

function credentialsFor(role: RoleKey): { username: string; password: string } {
  const users = Cypress.env('users') as Record<RoleKey, { username: string; password: string }>;
  const creds = users?.[role];
  if (!creds) {
    throw new Error(`Missing cypress.env.json credentials for role "${role}"`);
  }
  return creds;
}

Cypress.Commands.add('apiLogin', (role: RoleKey) => {
  const apiBase = Cypress.env('apiBaseUrl') as string;
  const { username, password } = credentialsFor(role);
  return cy
    .request({
      method: 'POST',
      url: `${apiBase}/api/auth/login`,
      body: { username, password },
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, `login ${role}`).to.eq(200);
      const token = res.body?.token ?? res.body?.accessToken;
      expect(token, 'access token').to.be.a('string');
      return token as string;
    });
});

Cypress.Commands.add('login', (role: RoleKey) => {
  cy.session(
    ['login', role],
    () => {
      cy.apiLogin(role).then((token) => {
        cy.window({ log: false }).then((win) => {
          win.localStorage.setItem('auth.token', token);
        });
      });
      cy.visit('/');
    },
    {
      validate() {
        cy.window({ log: false }).its('localStorage').invoke('getItem', 'auth.token').should('be.a', 'string');
      },
      cacheAcrossSpecs: true,
    },
  );
});

export {};
