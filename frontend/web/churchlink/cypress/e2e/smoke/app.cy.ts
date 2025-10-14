describe('App shell', () => {
  it('loads home', () => {
    cy.visit('/');
    cy.findByRole('navigation').should('exist');
    cy.findByRole('link', { name: /home/i }).should('exist');
  });
});