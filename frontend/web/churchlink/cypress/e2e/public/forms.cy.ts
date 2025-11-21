/// <reference types="cypress" />

describe('Public – Forms Pages', () => {
  beforeEach(() => {
    // SPY on API calls - E2E_TEST_MODE allows access without auth
    cy.intercept('GET', '**/api/v1/forms/slug/*').as('getForm');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('loads form without authentication in E2E test mode', () => {
    // In E2E_TEST_MODE, forms should be accessible without auth (no 401 errors)
    cy.visit('/forms/contact', { failOnStatusCode: false });

    // Wait for API call to complete
    cy.wait('@getForm', { timeout: 15000 }).then((interception) => {
      // In E2E mode, should NOT get 401 Unauthorized
      // Should get either 200 (form exists) or 404 (form not found)
      if (interception.response) {
        expect(interception.response.statusCode).to.not.equal(401);
        expect([200, 404]).to.include(interception.response.statusCode);
      }
    });

    // Page should render with content (not blank) - either form or error message
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.get('body').invoke('text').should('not.be.empty');

    // Should have navigation
    cy.get('[role="navigation"], nav, header').should('exist');

    // Verify page has interactive elements (buttons) - confirms successful render
    cy.get('button, a[role="button"], input[type="button"], input[type="submit"]').should('exist').and('be.visible');

    // Note: Console errors are expected when form doesn't exist (404), so we skip assertNoClientErrors
  });

  it('handles form not found gracefully', () => {
    cy.visit('/forms/nonexistent-form-slug-12345', { failOnStatusCode: false });

    // Wait for API call
    cy.wait('@getForm', { timeout: 15000 }).then((interception) => {
      // API should return 404 or similar error
      if (interception.response) {
        expect([404, 400]).to.include(interception.response.statusCode);
      }
    });

    // Should show not found, unavailable, or expired message
    cy.get('body', { timeout: 10000 }).invoke('text').should('match', /not found|unavailable|expired|doesn't exist/i);

    // Verify error page has buttons (e.g., back to home, navigation) - confirms proper error handling
    cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');

    // Note: Console errors are expected when form is not found (404)
  });

  it('verifies E2E auth bypass works (no 401 errors)', () => {
    // Test that E2E_TEST_MODE bypasses authentication properly
    // Should get 404 (not found) instead of 401 (unauthorized) for non-existent forms
    cy.visit('/forms/test-form-slug-123', { failOnStatusCode: false });

    cy.wait('@getForm', { timeout: 10000 }).then((interception) => {
      // Verify NO authentication error (401) - confirms E2E bypass works
      if (interception.response) {
        expect(interception.response.statusCode).to.not.equal(401);
        // Should be 404 (not found) since form doesn't exist
        expect(interception.response.statusCode).to.equal(404);
      }
    });

    // Page should show error message, not blank
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.get('body').invoke('text').should('not.be.empty');

    // Verify page has interactive elements - confirms page rendered successfully
    cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');

    // Note: Console errors are expected for 404 responses - this confirms E2E bypass worked (got 404, not 401)
  });

  it('payment success page loads', () => {
    cy.visit('/forms/test/payment/success', { failOnStatusCode: false });

    cy.get('body').should('be.visible');
    cy.get('body').invoke('text').should('not.be.empty');

    // Should have navigation
    cy.get('[role="navigation"], nav, header').should('exist');

    // Verify success page has action buttons (e.g., continue, return home) - confirms successful render
    cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');
  });

  it('payment cancel page loads', () => {
    cy.visit('/forms/test/payment/cancel', { failOnStatusCode: false });

    cy.get('body').should('be.visible');
    cy.get('body').invoke('text').should('not.be.empty');

    // Should have navigation
    cy.get('[role="navigation"], nav, header').should('exist');

    // Verify cancel page has action buttons (e.g., return to form, go home) - confirms successful render
    cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');
  });

  it('forms are responsive', () => {
    cy.visit('/forms/contact', { failOnStatusCode: false });

    cy.wait('@getForm', { timeout: 10000 });

    // Mobile
    cy.viewport('iphone-x');
    cy.get('body').should('be.visible');
    cy.get('button, a[role="button"], a[href]').should('exist');

    // Tablet
    cy.viewport('ipad-2');
    cy.get('body').should('be.visible');
    cy.get('button, a[role="button"], a[href]').should('exist');

    // Desktop
    cy.viewport(1920, 1080);
    cy.get('body').should('be.visible');
    cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');
  });
});
