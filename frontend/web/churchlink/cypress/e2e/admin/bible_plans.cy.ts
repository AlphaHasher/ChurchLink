describe('Admin – Bible Plans', () => {
  beforeEach(() => {
    cy.loginWithBearer();

    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          bible_plan_management: true,
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

    // Mock all bible plans API endpoints comprehensively
    cy.intercept('GET', /\/api\/v1\/bible-plans.*/, (req) => {
      req.reply({
        statusCode: 200,
        body: [],
      });
    }).as('getBiblePlans');

    // Mock bible notes API
    cy.intercept('GET', /\/api\/v1\/bible-notes.*/, {
      statusCode: 200,
      body: [],
    }).as('getBibleNotes');
  });

  it('loads manage bible plans page', () => {
    cy.visit('/admin/bible-plans/manage-plans');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });
    
    cy.contains('Manage Bible Plans', { timeout: 10000 }).should('be.visible');
    // Wait for grid to load - it may take time for the real API to respond
    cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
  });

  it('page is interactive and searchable', () => {
    cy.visit('/admin/bible-plans/manage-plans');
    cy.wait('@getPermissions');
    
    cy.contains('Manage Bible Plans', { timeout: 10000 }).should('be.visible');
    // Check that search input exists
    cy.get('input[placeholder*="Search"]', { timeout: 10000 }).should('be.visible');
  });

  it('loads bible plan builder page', () => {
    cy.visit('/admin/bible-plans/plan-builder');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.get('body').should('be.visible');
  });
});
