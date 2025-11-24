/// <reference types="cypress" />

// -----------------------------------------------------------------------------
// Constants / env helpers
// -----------------------------------------------------------------------------

const DEFAULT_REDIRECT_AFTER_LOGIN = '/';
const LOGIN_PATH = '/auth/login';

function getCreds(envKey) {
  const email =
    Cypress.env(envKey) ||
    Cypress.env('USER_EMAIL') ||
    'noadmin@testing.com';

  const password = Cypress.env('AUTH_PASSWORD');

  if (!password) {
    throw new Error(
      'Missing AUTH_PASSWORD. Make sure CYPRESS_AUTH_PASSWORD is set in your environment or cypress.env.json.',
    );
  }

  return { email, password };
}

// -----------------------------------------------------------------------------
// Console / error helpers
// -----------------------------------------------------------------------------

Cypress.Commands.add('prepareConsoleErrorSpy', () => {
  cy.on('window:before:load', (win) => {
    cy.stub(win.console, 'error').as('consoleError');
  });
});

// In E2E test mode we do NOT need a real bearer token. This command just enables
// "test mode" via localStorage and the console spy.
Cypress.Commands.add('loginWithBearer', () => {
  cy.prepareConsoleErrorSpy();
  cy.on('window:before:load', (win) => {
    try {
      win.localStorage.setItem('CL_E2E_TEST', '1');
    } catch {
      // ignore localStorage errors
    }
  });
});

Cypress.Commands.add('assertNoClientErrors', () => {
  cy.get('@consoleError').then((stub) => {
    expect(stub, 'console.error calls').to.have.callCount(0);
  });

  cy.get('body').should(($body) => {
    const hasOverlay =
      $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay')
        .length > 0;
    expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
  });
});

// -----------------------------------------------------------------------------
// Auth helpers
// -----------------------------------------------------------------------------

// Firebase-focused logout:
// 1) signOut() from Firebase if possible
// 2) clear our CL_E2E_TEST flag
// 3) delete ONLY Firebase's IndexedDB DBs (firebaseLocalStorageDb, heartbeat)
// 4) go to /auth/login
Cypress.Commands.add('logout', () => {
  // 1) Ask Firebase to sign out
  cy.window({ log: false }).then((win) => {
    const signOutCalls = [];

    try {
      // v8 style: window.firebase.auth().signOut()
      if (win.firebase && typeof win.firebase.auth === 'function') {
        const auth = win.firebase.auth();
        if (auth && typeof auth.signOut === 'function') {
          signOutCalls.push(auth.signOut());
        }
      }
    } catch {
      // ignore
    }

    try {
      // v9 modular (if you stash an auth instance globally)
      if (win.firebaseAuth && typeof win.firebaseAuth.signOut === 'function') {
        signOutCalls.push(win.firebaseAuth.signOut());
      }
    } catch {
      // ignore
    }

    if (signOutCalls.length > 0) {
      return Promise.allSettled(signOutCalls);
    }

    return undefined;
  }).then(() => {
    // 2 + 3) Clean up *only* Firebase-related persistence
    cy.window({ log: false }).then((win) => {
      // remove our test flag, if present
      try {
        win.localStorage.removeItem('CL_E2E_TEST');
      } catch {
        // ignore
      }

      // delete Firebase's IndexedDB DBs, but leave ChurchLinkCache alone
      try {
        const idb = win.indexedDB;
        if (idb && typeof idb.deleteDatabase === 'function') {
          // main Firebase auth persistence
          idb.deleteDatabase('firebaseLocalStorageDb');
          // optional heartbeat DB (name might vary slightly, but this is common)
          idb.deleteDatabase('firebase-heartbeat-database');
        }
      } catch {
        // ignore
      }
    });

    // 4) Land on the login page
    cy.visit(LOGIN_PATH);
    cy.contains('button', 'Sign In').should('be.visible');
  });
});

function doLogin({ envKey, redirectTo = DEFAULT_REDIRECT_AFTER_LOGIN }) {
  const { email, password } = getCreds(envKey);

  // Make sure we start from a logged-out Firebase state
  cy.logout();

  // Navigate the same way your login spec does
  cy.visit(`${LOGIN_PATH}?redirectTo=${encodeURIComponent(redirectTo)}`);

  cy.get('input[placeholder="Enter email address"]').clear().type(email);
  cy.get('input[placeholder="Enter password"]').clear().type(password, {
    log: false,
  });

  cy.contains('button', 'Sign In').click();

  // Should land on the page requested in ?redirectTo=
  cy.url().should('include', redirectTo);

  // Login form should be gone
  cy.contains('Sign In').should('not.exist');
}

// Public commands

Cypress.Commands.add('login', () => {
  // normal user login
  doLogin({ envKey: 'USER_EMAIL', redirectTo: DEFAULT_REDIRECT_AFTER_LOGIN });
});

Cypress.Commands.add('adminlogin', () => {
  // admin user login using ADMIN_EMAIL
  doLogin({ envKey: 'ADMIN_EMAIL', redirectTo: DEFAULT_REDIRECT_AFTER_LOGIN });
});
