/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      loginAsAdmin(): Chainable<Subject>
      cleanupTestSermons(): Chainable<Subject>
    }
  }
}

// In E2E test mode, no authentication required
Cypress.Commands.add('loginAsAdmin', () => {
  // E2E mode bypasses authentication, just return a dummy token
  const dummyToken = 'e2e-admin-token';
  cy.wrap(dummyToken).as('adminToken');
  return cy.wrap(dummyToken);
});

// Clean up test sermons - E2E mode bypasses authentication
Cypress.Commands.add('cleanupTestSermons', () => {
  // Get all sermons without auth headers (E2E mode)
  cy.request({
    method: 'GET',
    url: 'http://localhost:8000/api/v1/sermons',
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200 && response.body && Array.isArray(response.body)) {
      // Delete any sermons that match our test data patterns
      response.body.forEach((sermon: any) => {
        if (sermon.title && (
          sermon.title.includes('Test Sermon') ||
          sermon.title.includes('E2E Test') ||
          sermon.title.includes('Updated Test')
        )) {
          cy.request({
            method: 'DELETE',
            url: `http://localhost:8000/api/v1/sermons/${sermon.id}`,
            failOnStatusCode: false
          });
        }
      });
    }
  });
});