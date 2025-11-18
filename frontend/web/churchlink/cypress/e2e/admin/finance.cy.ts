describe('Admin – Finance Management', () => {
  beforeEach(() => {
    cy.loginWithBearer();

    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          finance: true,
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

    // Mock finance APIs
    cy.intercept('GET', '**/api/v1/finance/**', {
      statusCode: 200,
      body: { transactions: [], total: 0 },
    }).as('getFinanceData');
  });

  it('loads finance main page', () => {
    cy.visit('/admin/finance');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.get('body').should('be.visible');
  });

  it('loads refunds management page', () => {
    cy.visit('/admin/finance/refunds');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.get('body').should('be.visible');
  });
});