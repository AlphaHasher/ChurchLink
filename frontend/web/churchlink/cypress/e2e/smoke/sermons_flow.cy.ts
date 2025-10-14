describe('Sermons', () => {
  beforeEach(() => {
    cy.visit('/sermons');
  });

  it('loads the sermons page successfully', () => {
    cy.findByRole('navigation').should('exist');
    cy.get('body').should('be.visible');
    cy.url().should('include', '/sermons');
  });

  it('displays page content', () => {
    cy.get('body').should('not.be.empty');
    cy.get('body').should('be.visible');
  });

  it('page is interactive', () => {
    cy.get('body').within(() => {
      cy.get('*').should('have.length.greaterThan', 5);
    });
  });
});
