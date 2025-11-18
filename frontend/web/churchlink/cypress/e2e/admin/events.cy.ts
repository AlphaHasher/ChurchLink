describe('Admin – Events Management', () => {
  beforeEach(() => {
    cy.loginWithBearer();

    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          event_management: true,
          event_editing: true,
        },
      },
    }).as('getPermissions');

    cy.intercept('GET', '**/api/v1/users/check-mod', {
      statusCode: 200,
      body: { success: true },
    }).as('checkMod');

    cy.intercept('GET', '**/api/v1/users/language', {
      statusCode: 200,
      body: { language: 'en' },
    }).as('getUserLanguage');

    // Mock events API
    cy.intercept('GET', '**/api/v1/events/**', {
      statusCode: 200,
      body: { events: [], total: 0 },
    }).as('getEvents');
  });

  it('loads events management page', () => {
    cy.visit('/admin/events');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.contains(/event/i, { timeout: 10000 }).should('be.visible');
  });

  it('renders events interface', () => {
    cy.visit('/admin/events');
    cy.wait('@getPermissions');
    
    cy.get('body').should('be.visible');
  });
});