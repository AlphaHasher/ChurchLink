
describe('Events', () => {
  beforeEach(() => {
    cy.visit('/events');
  });

  it('loads the page successfully', () => {
    cy.findByRole('navigation').should('exist');
    cy.get('body').should('be.visible');
    cy.url().should('include', '/events');
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
