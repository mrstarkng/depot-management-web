/// <reference types="cypress" />

type RoleKey = 'manager' | 'yardPlanner' | 'gateOperator' | 'orderClerk';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(role: RoleKey): Chainable<void>;
      apiLogin(role: RoleKey): Chainable<{ token: string; expires: string; refreshToken?: string }>;
    }
  }
}

// Keys must match AuthService (auth.service.ts):
//   TOKEN_KEY         = 'depot_token'
//   REFRESH_TOKEN_KEY = 'depot_refresh_token'
//   EXPIRES_KEY       = 'depot_expires'
// Login payload uses `userName` (camelCase) per AuthController.
const TOKEN_KEY = 'depot_token';
const REFRESH_TOKEN_KEY = 'depot_refresh_token';
const EXPIRES_KEY = 'depot_expires';

function credentialsFor(role: RoleKey): { userName: string; password: string } {
  const users = Cypress.env('users') as Record<RoleKey, { username: string; password: string }>;
  const creds = users?.[role];
  if (!creds) {
    throw new Error(`Missing cypress.env.json credentials for role "${role}"`);
  }
  return { userName: creds.username, password: creds.password };
}

Cypress.Commands.add('apiLogin', (role: RoleKey) => {
  const apiBase = Cypress.env('apiBaseUrl') as string;
  const body = credentialsFor(role);
  return cy
    .request({
      method: 'POST',
      url: `${apiBase}/api/auth/login`,
      body,
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, `login ${role}`).to.eq(200);
      const token = res.body?.token as string | undefined;
      const expires = res.body?.expires as string | undefined;
      const refreshToken = res.body?.refreshToken as string | undefined;
      expect(token, 'token').to.be.a('string');
      expect(expires, 'expires').to.be.a('string');
      return { token: token!, expires: expires!, refreshToken };
    });
});

Cypress.Commands.add('login', (role: RoleKey) => {
  cy.session(
    ['login', role],
    () => {
      // Seed localStorage at the app origin before any SPA boot.
      cy.visit('/login', { failOnStatusCode: false });
      cy.apiLogin(role).then(({ token, expires, refreshToken }) => {
        cy.window({ log: false }).then((win) => {
          win.localStorage.setItem(TOKEN_KEY, token);
          win.localStorage.setItem(EXPIRES_KEY, expires);
          if (refreshToken) {
            win.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          }
        });
      });
      // Land on a gated page so bootstrapSession() runs with tokens already set.
      cy.visit('/dashboard');
    },
    {
      validate() {
        cy.window({ log: false })
          .its('localStorage')
          .invoke('getItem', TOKEN_KEY)
          .should('be.a', 'string');
      },
      cacheAcrossSpecs: true,
    },
  );
});

export {};
