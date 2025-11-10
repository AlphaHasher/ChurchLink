describe('Public – Thank You Page', () => {
  beforeEach(() => {
    // No API intercepts needed for static thank you page
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('loads thank you page and shows content', () => {
    cy.visit('/thank-you');
    
    // Verify heading renders
    cy.contains('h1', 'Thank You', { timeout: 10000 }).should('be.visible');
    
    // Should have a message (even if error about missing payment info)
    cy.get('body').invoke('text').should('match', /thank|payment|missing|error/i);
    
    // Should have button to go back home - confirms successful render
    cy.contains('button', /home|back/i).should('be.visible');
    
    // Verify page has interactive elements (buttons/links) - confirms successful render
    cy.get('button, a[href]').should('exist').and('be.visible');
  });

  it('handles missing payment context gracefully', () => {
    // Visit without payment parameters
    cy.visit('/thank-you');
    
    // Page must render with some content (not blank)
    cy.get('h1').should('exist').and('be.visible');
    
    // Should show content (any message is fine - thank you, error, etc.)
    cy.get('body').invoke('text').should('not.be.empty');
    
    // Verify page has action buttons - confirms successful render
    cy.get('button, a[href]').should('exist').and('be.visible');
  });

  it('back to home button works', () => {
    cy.visit('/thank-you');
    
    // Find and verify back button
    cy.contains('button', /home|back/i).should('be.visible').click();
    
    // Should navigate to home
    cy.url().should('match', /\/$|\/home/);
  });

  it('page is responsive', () => {
    cy.visit('/thank-you');
    
    // Wait for content
    cy.contains('h1', 'Thank You').should('be.visible');
    
    // Mobile
    cy.viewport('iphone-x');
    cy.contains('h1', 'Thank You').should('be.visible');
    cy.get('button').should('exist');
    
    // Tablet
    cy.viewport('ipad-2');
    cy.contains('h1', 'Thank You').should('be.visible');
    cy.get('button').should('exist');
    
    // Desktop
    cy.viewport(1920, 1080);
    cy.contains('h1', 'Thank You').should('be.visible');
    cy.get('button, a[href]').should('exist').and('be.visible');
  });
});
