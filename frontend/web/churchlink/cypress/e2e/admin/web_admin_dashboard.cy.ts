describe('Admin – Dashboard', () => {
  beforeEach(() => {
    // E2E mode handles authentication automatically
    cy.prepareConsoleErrorSpy();
  });

  it('loads, renders, and has no compile/runtime errors', () => {
    cy.visit('/admin');
    cy.wait(3000); // Wait for page to load
    
    cy.get('body').should('be.visible');
    
    // Check for Vite compile errors but be more tolerant of API errors in E2E mode
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });
    
    cy.contains('Welcome to the Admin Panel', { timeout: 10000 }).should('be.visible');
    // Ensure the action grid/cards area is present
    cy.get('section').should('be.visible');
    // At least one card should expose an overlay link
    cy.get('a[aria-label^="Open"]').should('exist');
  });

  it('cards are clickable and navigate when available', () => {
    cy.visit('/admin');
    cy.wait(3000); // Wait for page to load
    cy.contains('Welcome to the Admin Panel', { timeout: 10000 }).should('be.visible');

    // Try to click the Users card if it is visible (permission-dependent)
    cy.get('a[aria-label="Open Users"]').then(($link) => {
      if ($link.length) {
        cy.wrap($link).click();
        // E2E mode bypasses auth checks, so the app should navigate to users if link exists
        cy.url({ timeout: 10000 }).should('include', '/admin/users');
      } else {
        // If the Users card isn't present due to permissions, just assert other cards exist
        cy.get('a[aria-label^="Open"]').should('have.length.at.least', 1);
      }
    });
  });
});
