describe('Admin – Notifications & Ministries', () => {
  beforeEach(() => {
    cy.loginWithBearer();

    cy.intercept('GET', '**/api/v1/users/permissions', {
      statusCode: 200,
      body: {
        success: true,
        permissions: {
          admin: true,
          notification_management: true,
          ministries_management: true,
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

    // Mock APIs
    cy.intercept('GET', '**/api/v1/notifications/**', {
      statusCode: 200,
      body: { notifications: [] },
    }).as('getNotifications');

    cy.intercept('GET', '**/api/v1/ministries/**', {
      statusCode: 200,
      body: { ministries: [] },
    }).as('getMinistries');
  });

  it('loads notifications management page', () => {
    cy.visit('/admin/notifications');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.get('body').should('be.visible');
  });

  it('loads ministries management page', () => {
    cy.visit('/admin/ministries');
    cy.wait('@getPermissions');
    
    cy.get('body').should(($body) => {
      const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
      expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
    });

    cy.get('body').should('be.visible');
  });
});