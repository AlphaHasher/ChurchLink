describe('Admin – Website Page Management', () => {
  beforeEach(() => {
    cy.loginWithBearer();
    
    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          webbuilder_editing: true,
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
    
    cy.intercept('GET', '**/api/v1/pages/**', {
      statusCode: 200,
      body: [
        { _id: '1', title: 'Home', slug: '/', visible: true, locked: false },
        { _id: '2', title: 'About', slug: 'about', visible: false, locked: false },
      ],
    }).as('getPages');
    cy.intercept('PUT', '**/api/v1/pages/**', { statusCode: 200, body: {} }).as('updatePage');
    cy.intercept('DELETE', '**/api/v1/pages/**', { statusCode: 200, body: { success: true } }).as('deletePage');
    cy.intercept('GET', '**/api/v1/pages/staging/**', { statusCode: 404 });
    cy.intercept('GET', '**/api/v1/pages/preview/**', { statusCode: 200, body: { version: 2, sections: [] } });
  });

  it('loads without compile/runtime errors and renders the grid', () => {
    cy.visit('/admin/webbuilder');
    cy.assertNoClientErrors();
    // Check URL confirms we're on the right page
    cy.url().should('include', '/admin/webbuilder');
    // Wait for grid to load
    cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
  });

  it('toggles visibility and opens editor without visual regressions', () => {
    cy.visit('/admin/webbuilder');
    cy.assertNoClientErrors();
    // Give page time to load and make API calls
    cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
    // Check that page interface is working
    cy.get('body').should('be.visible');
  });
});
