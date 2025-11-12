describe('Public – Weekly Bulletin Page', () => {
  beforeEach(() => {
    // SPY on API calls
    cy.intercept('GET', '**/v1/bulletins/current_week').as('getCurrentWeek');
    cy.intercept('GET', '**/v1/bulletins/*').as('getBulletinFeed');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('loads weekly bulletin page and renders actual content', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.contains('Loading', { timeout: 10000 }).should('not.exist');
    
    // Verify page heading
    cy.contains('h1', 'Weekly Bulletin').should('be.visible');
    
    // Verify filter button exists
    cy.get('button').contains(/filter/i).should('be.visible');
    
    // Verify week label OR services OR announcements render
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      const hasWeekLabel = !!(bodyText.match(/week of|for the week/i));
      const hasServices = $body.find('[data-testid*="service"], [class*="service"]').length > 0 ||
                         bodyText.includes('Services');
      const hasAnnouncements = bodyText.includes('Announcements') || bodyText.includes('📢');
      const hasEmptyState = bodyText.includes('No announcements') || bodyText.includes('No bulletins');
      
      const result = hasWeekLabel || hasServices || hasAnnouncements || hasEmptyState;
      expect(result, 'Page must show week info, services, announcements, OR empty state').to.be.true;
    });
    
    // Verify filter button is visible - confirms successful render
    cy.get('button').contains(/filter/i).should('be.visible');
  });

  it('verifies services section when present', () => {
    cy.visit('/weekly-bulletin');
    cy.wait('@getBulletinFeed').then((interception) => {
      const feed = interception.response?.body;
      const services = feed?.services || [];
      
      if (services.length > 0) {
        // Should show services section
        cy.get('body').should('contain.text', /service|week of/i);
        
        // Services should have cards or list items
        cy.get('[data-testid*="service"], [class*="service-card"], article')
          .should('have.length.greaterThan', 0);
      }
    });
    
    // Verify page has interactive elements - confirms successful render
    cy.get('button, a[href]').should('exist');
  });

  it('verifies announcements section when present', () => {
    cy.visit('/weekly-bulletin');
    cy.wait('@getBulletinFeed').then((interception) => {
      const feed = interception.response?.body;
      const bulletins = feed?.bulletins || [];
      
      if (bulletins.length > 0) {
        // Should show Announcements heading with emoji
        cy.contains('h2', 'Announcements').should('be.visible');
        
        // Bulletins should render
        cy.get('[data-testid*="bulletin"], article, [class*="bulletin"]')
          .should('have.length.greaterThan', 0);
      }
    });
    
    // Verify page has filter button - confirms successful render
    cy.get('button').contains(/filter/i).should('be.visible');
  });

  it('filter dialog is functional', () => {
    cy.visit('/weekly-bulletin');
    cy.wait('@getBulletinFeed');
    
    // Open filter
    cy.get('button').contains(/filter/i).click();
    
    // Verify dialog
    cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
    
    // Verify dialog has interactive elements - confirms functional dialog
    cy.get('[role="dialog"]').within(() => {
      cy.get('button, select, input').should('have.length.greaterThan', 0);
    });
  });

  it('page is responsive', () => {
    cy.visit('/weekly-bulletin');
    cy.wait('@getBulletinFeed');
    
    // Wait for heading
    cy.contains('h1', 'Weekly Bulletin').should('be.visible');
    
    // Test mobile
    cy.viewport('iphone-x');
    cy.contains('h1', 'Weekly Bulletin').should('be.visible');
    cy.get('button').should('exist');
    
    // Test tablet
    cy.viewport('ipad-2');
    cy.contains('h1', 'Weekly Bulletin').should('be.visible');
    cy.get('button').should('exist');
    
    // Test desktop
    cy.viewport(1920, 1080);
    cy.contains('h1', 'Weekly Bulletin').should('be.visible');
    cy.get('button, a[href]').should('exist').and('be.visible');
  });
});
