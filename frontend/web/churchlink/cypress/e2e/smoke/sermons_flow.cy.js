describe('Sermons', function () {
    beforeEach(function () {
        cy.visit('/sermons');
    });
    it('loads the sermons page successfully', function () {
        cy.findByRole('navigation').should('exist');
        cy.get('body').should('be.visible');
        cy.url().should('include', '/sermons');
    });
    it('displays page content', function () {
        cy.get('body').should('not.be.empty');
        cy.get('body').should('be.visible');
    });
    it('page is interactive', function () {
        cy.get('body').within(function () {
            cy.get('*').should('have.length.greaterThan', 5);
        });
    });
});
