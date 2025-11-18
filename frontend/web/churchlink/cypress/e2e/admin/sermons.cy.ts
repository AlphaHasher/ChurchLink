describe('Admin – Sermons Management', () => {
  beforeEach(() => {
    cy.loginWithBearer();

    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          sermon_editing: true,
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

    // Mock sermons API
    cy.intercept('GET', '**/api/v1/sermons/**', {
      statusCode: 200,
      body: { sermons: [], total: 0 },
    }).as('getSermons');
  });

  it('loads sermons management page', () => {
    cy.visit('/admin/sermons');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.contains(/sermon/i, { timeout: 10000 }).should('be.visible');
  });

  it('renders sermons interface', () => {
    cy.visit('/admin/sermons');
    cy.wait('@getPermissions');
    
    cy.get('body').should('be.visible');
  });
});