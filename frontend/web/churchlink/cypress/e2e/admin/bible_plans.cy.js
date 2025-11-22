describe('Admin – Bible Plans', function () {
    beforeEach(function () {
        cy.loginWithBearer();
    });
    it('loads, renders, and has no compile/runtime errors', function () {
        cy.visit('/admin/bible-plans/manage-plans');
        cy.assertNoClientErrors();
        cy.contains('Manage Bible Plans', { timeout: 10000 }).should('be.visible');
        // Wait for grid to load - it may take time for the real API to respond
        cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
    });
    it('page is interactive and searchable', function () {
        cy.visit('/admin/bible-plans/manage-plans');
        cy.contains('Manage Bible Plans', { timeout: 10000 }).should('be.visible');
        // Check that search input exists
        cy.get('input[placeholder*="Search"]', { timeout: 10000 }).should('be.visible');
        cy.assertNoClientErrors();
    });
});
