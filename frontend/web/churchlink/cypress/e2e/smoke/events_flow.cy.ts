describe('Events flow', () => {
  it('navigates to events page and loads events', () => {
    cy.visit('/events');
    cy.findByRole('navigation').should('exist');
  });
});