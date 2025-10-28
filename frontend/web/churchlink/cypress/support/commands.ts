/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      prepareConsoleErrorSpy(): Chainable<void>
      loginWithBearer(): Chainable<void>
      assertNoClientErrors(): Chainable<void>
    }
  }
}

Cypress.Commands.add('prepareConsoleErrorSpy', () => {
  cy.on('window:before:load', (win) => {
    cy.stub(win.console, 'error').as('consoleError');
  });
});

// In E2E test mode we do NOT need a real bearer token. This command now only enables test mode.
Cypress.Commands.add('loginWithBearer', () => {
  cy.prepareConsoleErrorSpy();
  cy.on('window:before:load', (win) => {
    try { win.localStorage.setItem('CL_E2E_TEST', '1'); } catch {}
  });
});

Cypress.Commands.add('assertNoClientErrors', () => {
  cy.get('@consoleError').then((stub) => {
    expect(stub, 'console.error calls').to.have.callCount(0);
  });
  cy.get('body').should(($body) => {
    const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
    expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
  });
});