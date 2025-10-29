describe('Public – Header & Footer', () => {
  beforeEach(() => {
    cy.prepareConsoleErrorSpy();
    cy.intercept('GET', '**/api/v1/header', {
      statusCode: 200,
      body: {
        items: [
          { title: 'Home', russian_title: 'Домой', slug: '/', visible: true },
          {
            title: 'Ministries', russian_title: 'Служения', items: [
              { title: 'Youth', russian_title: 'Молодежь', slug: '/youth', visible: true },
            ], visible: true
          },
        ],
      },
    }).as('getHeader');
    cy.intercept('GET', '**/api/v1/footer/items', {
      statusCode: 200,
      body: {
        items: [
          {
            title: 'About',
            titles: { en: 'About', ru: 'О нас' },
            items: [
              { title: 'Contact', titles: { en: 'Contact', ru: 'Контакты' }, url: '/contact', visible: true }
            ],
            visible: true
          },
        ],
      },
    }).as('getFooter');
    cy.intercept('GET', '**/api/v1/users/check-mod', { statusCode: 200, body: { success: false } });
  });

  it('loads home with header, footer, and no compile/runtime errors', () => {
    cy.visit('/');
    cy.assertNoClientErrors();
    cy.get('[data-slot="navigation-menu"]').should('be.visible');
    cy.contains('Home').should('be.visible');
    cy.contains('All rights reserved').should('be.visible');
  });

  it('opens dropdowns and navigates without visual issues', () => {
    cy.visit('/');
    cy.contains('Ministries').trigger('mouseover');
    cy.contains('Youth').should('be.visible').click();
    cy.location('pathname').should('eq', '/youth');
    cy.assertNoClientErrors();
  });
});
