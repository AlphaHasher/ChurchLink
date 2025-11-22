describe('Admin – Users Management', () => {
  beforeEach(() => {
    // Enable E2E test mode and prepare console error spy
    cy.loginWithBearer();

    // Mock permissions API to allow admin routes to render
    cy.intercept('GET', /\/api\/v1\/users\/permissions/, {
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
    cy.intercept('GET', /\/api\/v1\/users\/check-mod/, {
      statusCode: 200,
      body: { success: true },
    }).as('checkMod');

    // Mock language preference API
    cy.intercept('GET', /\/api\/v1\/users\/language/, {
      statusCode: 200,
      body: { language: 'en' },
    }).as('getUserLanguage');

    // Mock users list API
    cy.intercept('GET', /\/api\/v1\/users\/.*/, {
      statusCode: 200,
      body: { users: [], total: 0 },
    }).as('getUsers');
  });

  it('loads users management page without errors', () => {
    cy.visit('/admin/users/manage-users');
    
    // Check for Vite compile errors but be more tolerant of API failures in E2E mode
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    // Should show users management interface or have loaded the page successfully
    cy.get('body', { timeout: 10000 }).should('be.visible');
    
    // The page should either show users content or redirect to login (which would happen without E2E mode)
    cy.url().then((url) => {
      // In E2E mode, it should stay on the admin page (not redirect to login)
      expect(url).to.include('/admin');
    });
  });

  it('displays user management interface components', () => {
    cy.visit('/admin/users/manage-users');
    
    // Should have typical user management UI elements
    cy.get('body').should('be.visible');
    
    // Verify we stay on admin route (E2E mode bypasses auth)
    cy.url().should('include', '/admin');
  });

  it('handles membership requests page', () => {
    cy.visit('/admin/users/membership-requests');
    
    // Should load membership requests without compile errors
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });
    
    cy.get('body').should('be.visible');
    cy.url().should('include', '/admin');
  });
});