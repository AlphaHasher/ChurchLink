describe('Admin – Dashboard', () => {
  beforeEach(() => {
    // Enable E2E test mode and prepare console error spy
    cy.loginWithBearer();

    // Mock permissions API to allow admin routes to render
    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          permissions_management: true,
          web_builder_management: true,
          mobile_ui_management: true,
          event_editing: true,
          event_management: true,
          media_management: true,
          sermon_editing: true,
          bulletin_editing: true,
          finance: true,
          ministries_management: true,
          forms_management: true,
          bible_plan_management: true,
          notification_management: true,
        },
      },
    }).as('getPermissions');

    // Mock user mod check
    cy.intercept('GET', '**/api/v1/users/check-mod', {
      statusCode: 200,
      body: { success: true },
    }).as('checkMod');

    // Mock language preference API to prevent console errors
    cy.intercept('GET', '**/api/v1/users/language', {
      statusCode: 200,
      body: { language: 'en' },
    }).as('getUserLanguage');

    // Mock additional permissions fetch to prevent console errors
    cy.intercept('GET', '**/api/v1/users/permissions/all', {
      statusCode: 200,
      body: [],
    }).as('getAllPermissions');
  });

  it('loads, renders, and has no compile/runtime errors', () => {
    cy.visit('/admin');
    cy.wait('@getPermissions');
    
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
    cy.wait('@getPermissions');
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
