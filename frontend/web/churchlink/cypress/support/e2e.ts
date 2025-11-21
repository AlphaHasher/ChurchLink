// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'
import '@testing-library/cypress/add-commands';

beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();

  cy.window({ log: false }).then((win) => {
    try {
      win.sessionStorage.clear();
    } catch {}

    // Brute-force: delete all IndexedDB databases for this origin
    if (win.indexedDB && "databases" in win.indexedDB) {
      return (win.indexedDB as any).databases().then((dbs: any[]) => {
        dbs.forEach((db) => {
          if (db.name) {
            win.indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }
  });
});