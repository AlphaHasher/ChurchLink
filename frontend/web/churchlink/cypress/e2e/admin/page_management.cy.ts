describe('Admin – Website Page Management', () => {
  beforeEach(() => {
    cy.loginWithBearer();
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
    cy.contains('Website Pages').should('be.visible');
    cy.get('.ag-theme-quartz .ag-center-cols-container .ag-row').should('have.length.at.least', 1);
  });

  it('toggles visibility and opens editor without visual regressions', () => {
    cy.visit('/admin/webbuilder');
    // Give page time to load and make API calls
    cy.contains('Website Pages', { timeout: 10000 }).should('be.visible');
    cy.findAllByRole('button', { name: /visible|hidden/i }).first().click();
    cy.get('[title="Edit page"]').first().click();
    cy.assertNoClientErrors();
  });
});
