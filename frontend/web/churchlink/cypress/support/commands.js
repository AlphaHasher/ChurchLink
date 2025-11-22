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

// Core login function that mirrors your login test behavior
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

// -----------------------------------------------------------------------------
// Test data helpers: ministries
// -----------------------------------------------------------------------------

const TEST_MINISTRIES = ['Youth Ministry', 'Bible Studies', 'Community Outreach'];

Cypress.Commands.add('createTestMinistries', () => {
  cy.adminlogin();
  cy.visit('/admin/ministries');

  TEST_MINISTRIES.forEach((name) => {
    cy.contains('button', 'Add ministry').click();

    cy.get('[role="dialog"]')
      .should('be.visible')
      .within(() => {
        cy.contains('Create ministry').should('be.visible');
        cy.get('input[placeholder="Ministry name"]').clear().type(name);
        cy.contains('button', 'Create').click();
      });

    cy.get('[role="dialog"]').should('not.exist');

    // Expect the success status + the row to appear
    cy.contains('Success').should('be.visible');
    cy.contains('.ag-cell[col-id="name"]', name, { timeout: 10000 }).should(
      'be.visible',
    );
  });
});

Cypress.Commands.add('deleteTestMinistries', () => {
  cy.adminlogin();
  cy.visit('/admin/ministries');

  TEST_MINISTRIES.forEach((name) => {
    // Filter by ministry name (debounced search)
    cy.get('input[placeholder="Search ministries..."]').clear().type(name);
    cy.wait(1000);

    // If no row with that exact name exists, skip
    cy.get('body').then(($body) => {
      const cell = $body
        .find('.ag-cell[col-id="name"]')
        .filter((_, el) => {
          const text = (el.textContent || '').trim();
          return text === name;
        })
        .first();

      if (!cell.length) {
        return;
      }

      // Delete via the pinned-right actions column
      cy.get('.ag-pinned-right-cols-container .ag-row')
        .first()
        .within(() => {
          cy.get('button[aria-label="Delete Ministry"]').click();
        });

      cy.contains('Delete ministry')
        .should('be.visible')
        .parent()
        .parent()
        .within(() => {
          cy.contains('button', 'Delete').click();
        });

      cy.contains('Delete ministry').should('not.exist');
      cy.contains('.ag-cell[col-id="name"]', name).should('not.exist');
    });

    // Clear the search box before the next name
    cy.get('input[placeholder="Search ministries..."]').clear();
  });
});

// -----------------------------------------------------------------------------
// Test data helpers: media images
// -----------------------------------------------------------------------------

const TEST_IMAGES = ['wolf.jpg', 'octopus.avif', 'orangutan.jpg'];

Cypress.Commands.add('createTestImages', () => {
  cy.adminlogin();
  cy.visit('/admin/media-library');

  TEST_IMAGES.forEach((filename) => {
    cy.get('input[type="file"][multiple][accept="image/*"]')
      .should('exist')
      .selectFile(`cypress/fixtures/media/${filename}`, { force: true });

    cy.contains('div', filename, { timeout: 15000 }).should('be.visible');
  });
});

Cypress.Commands.add('deleteTestImages', () => {
  cy.adminlogin();
  cy.visit('/admin/media-library');

  TEST_IMAGES.forEach((filename) => {
    // Tile must exist; if you want this to be fully idempotent, you can wrap
    // this in a body-check similar to deleteTestMinistries.
    cy.contains('div', filename, { timeout: 10000 }).rightclick();

    cy.contains('button', 'Delete Image').click();

    cy.contains('Delete image')
      .should('be.visible')
      .parent()
      .parent()
      .within(() => {
        cy.contains('Are you sure you want to delete').should('be.visible');
        cy.contains('button', 'Delete').click();
      });

    cy.contains('Delete image').should('not.exist');
    cy.contains('div', filename).should('not.exist');
  });
});

