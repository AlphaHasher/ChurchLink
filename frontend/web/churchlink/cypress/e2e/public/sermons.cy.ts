describe('Public – Sermons Page', () => {
  beforeEach(() => {
    // SPY on API calls (not mock - let real data through)
    cy.intercept('GET', '**/v1/sermons*').as('getSermons');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('loads the sermons page and displays title', () => {
    cy.visit('/sermons');
    
    // Wait for page to load
    cy.get('h1', { timeout: 15000 }).should('be.visible');
    
    // Wait for loading state to disappear if present
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Verify page heading renders
    cy.contains('h1', 'Sermons').should('be.visible');
  });

  it('displays sermon cards with correct information', () => {
    cy.visit('/sermons');
    
    // Wait for page to load
    cy.contains('h1', 'Sermons', { timeout: 15000 }).should('be.visible');
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if sermons exist or empty state is shown
    cy.get('body').then(($body) => {
      const hasNoSermons = $body.text().includes('No sermons found');
      
      if (!hasNoSermons) {
        // Verify sermon grid exists
        cy.get('div.grid').should('exist');
        
        // Verify at least one sermon card exists
        cy.get('div.grid > div').should('have.length.greaterThan', 0);
        
        // Verify first sermon card has required elements
        cy.get('div.grid > div').first().within(() => {
          // Title (h3)
          cy.get('h3').should('exist').and('not.be.empty');
          
          // Speaker (p with text-xs class)
          cy.get('p.text-xs').should('exist').and('not.be.empty');
        });
      } else {
        // Verify empty state is shown
        cy.contains('No sermons found').should('be.visible');
      }
    });
  });

  it('opens and displays filter dialog with all inputs', () => {
    cy.visit('/sermons');
    
    // Wait for page to load
    cy.contains('h1', 'Sermons', { timeout: 15000 }).should('be.visible');
    
    // Click filter button
    cy.get('button').contains('Filters').should('be.visible').click();
    
    // Verify dialog appears
    cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
    
    // Verify dialog title
    cy.get('[role="dialog"]').within(() => {
      cy.contains('Filter sermons').should('be.visible');
      
      // Verify Ministry select exists
      cy.get('#sermon-filter-ministry').should('exist');
      
      // Verify Speaker input exists
      cy.get('#sermon-filter-speaker').should('exist').and('have.attr', 'placeholder', 'Search by speaker');
      
      // Verify Title input exists
      cy.get('#sermon-filter-title').should('exist').and('have.attr', 'placeholder', 'Search by title');
      
      // Verify Date range inputs exist
      cy.get('#sermon-filter-start').should('exist').and('have.attr', 'type', 'date');
      cy.get('#sermon-filter-end').should('exist').and('have.attr', 'type', 'date');
      
      // Verify Favorites checkbox exists
      cy.get('#sermon-filter-favorites').should('exist');
      
      // Verify action buttons exist
      cy.contains('button', 'Reset filters').should('be.visible');
      cy.contains('button', 'Apply filters').should('be.visible');
      cy.contains('button', 'Cancel').should('be.visible');
    });
  });

  it('filters sermons by speaker', () => {
    cy.visit('/sermons');
    
    // Wait for page to load
    cy.contains('h1', 'Sermons', { timeout: 15000 }).should('be.visible');
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if sermons exist
    cy.get('body').then(($body) => {
      const hasNoSermons = $body.text().includes('No sermons found');
      
      if (!hasNoSermons) {
        // Get the first sermon's speaker name
        cy.get('div.grid > div').first().find('p.text-xs').first().invoke('text').then((speakerName) => {
          const speaker = speakerName.trim();
          
          if (speaker) {
            // Open filter dialog
            cy.get('button').contains('Filters').click();
            
            // Enter speaker name
            cy.get('#sermon-filter-speaker').clear().type(speaker);
            
            // Apply filters
            cy.contains('button', 'Apply filters').click();
            
            // Verify dialog closed
            cy.get('[role="dialog"]').should('not.exist');
            
            // Verify filter label is shown
            cy.contains(`Speaker: ${speaker}`).should('be.visible');
            
            // Verify filtered results contain the speaker
            cy.get('div.grid > div').each(($card) => {
              cy.wrap($card).find('p.text-xs').first().should('contain', speaker);
            });
          }
        });
      }
    });
  });

  it('opens sermon details modal with video', () => {
    cy.visit('/sermons');
    
    // Wait for page to load
    cy.contains('h1', 'Sermons', { timeout: 15000 }).should('be.visible');
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if sermons exist
    cy.get('body').then(($body) => {
      const hasNoSermons = $body.text().includes('No sermons found');
      
      if (!hasNoSermons) {
        // Click on first sermon card
        cy.get('div.grid > div').first().click();
        
        // Verify modal opens
        cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
        
        // Verify modal contains sermon details
        cy.get('[role="dialog"]').within(() => {
          // Verify title exists (DialogTitle)
          cy.get('h2').should('exist').and('not.be.empty');
          
          // Verify YouTube iframe exists
          cy.get('iframe[src*="youtube"]', { timeout: 5000 }).should('exist');
          
          // Verify video container has correct aspect ratio
          cy.get('div.aspect-video').should('exist');
        });
      }
    });
  });

  it('closes sermon modal when clicking outside or close button', () => {
    cy.visit('/sermons');
    
    // Wait for page to load
    cy.contains('h1', 'Sermons', { timeout: 15000 }).should('be.visible');
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if sermons exist
    cy.get('body').then(($body) => {
      const hasNoSermons = $body.text().includes('No sermons found');
      
      if (!hasNoSermons) {
        // Click on first sermon card
        cy.get('div.grid > div').first().click();
        
        // Verify modal opens
        cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
        
        // Close modal by pressing Escape key
        cy.get('body').type('{esc}');
        
        // Verify modal closed
        cy.get('[role="dialog"]').should('not.exist');
      }
    });
  });

  it('page is responsive and maintains functionality', () => {
    cy.visit('/sermons');
    
    // Wait for content to load
    cy.contains('h1', 'Sermons', { timeout: 10000 }).should('be.visible');
    
    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.contains('h1', 'Sermons').should('be.visible');
    cy.get('button').contains('Filters').should('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.contains('h1', 'Sermons').should('be.visible');
    cy.get('button').contains('Filters').should('be.visible');
    
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.contains('h1', 'Sermons').should('be.visible');
    cy.get('button').contains('Filters').should('be.visible');
  });
});
