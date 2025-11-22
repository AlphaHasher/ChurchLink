describe('App shell', function () {
    it('loads home', function () {
        cy.visit('/');
        cy.findByRole('navigation').should('exist');
        // tbf we dont have a true home page yet so just use the login
        cy.findByRole('link', { name: /login/i }).should('exist');
    });
});
