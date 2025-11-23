/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      prepareConsoleErrorSpy(): Chainable<Subject>
      loginWithBearer(): Chainable<Subject>
      assertNoClientErrors(): Chainable<Subject>
    }
  }
}

Cypress.Commands.add('prepareConsoleErrorSpy', () => {
  cy.on('window:before:load', (win) => {
    cy.stub(win.console, 'error').as('consoleError');
  });
});

// Use E2E test mode bypass - no authentication required
Cypress.Commands.add('loginWithBearer', () => {
  cy.prepareConsoleErrorSpy();
  
  // In E2E test mode, we don't need to authenticate
  // Just set a dummy token for API consistency
  cy.wrap('e2e-test-token').as('authToken');
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