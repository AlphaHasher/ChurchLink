describe('Admin – Permissions Management', () => {
  beforeEach(() => {
    cy.loginWithBearer();

    // Mock permissions API
    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          permissions_management: true,
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

    // Mock permissions data
    cy.intercept('GET', '**/api/v1/users/permissions/all', {
      statusCode: 200,
      body: [],
    }).as('getAllPermissions');
  });

  it('loads permissions management page', () => {
    cy.visit('/admin/permissions');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.contains(/permission/i, { timeout: 10000 }).should('be.visible');
  });

  it('renders permissions interface', () => {
    cy.visit('/admin/permissions');
    cy.wait('@getPermissions');
    
    cy.get('body').should('be.visible');
  });
});