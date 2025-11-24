describe('Bulletin – Web – Services Tests', () => {
  beforeEach(() => {
    // SPY on API calls (not mock - let real data through)
    cy.intercept('GET', '**/v1/bulletins/current_week').as('getCurrentWeek');
    cy.intercept('GET', '**/v1/bulletins/*').as('getBulletinFeed');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('displays services section with cards', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Verify Services section header is visible with week label
    cy.get('h2').contains(/services|week of/i, { timeout: 5000 }).should('be.visible');
    
    // Verify services filter button exists
    cy.contains('button', 'Filters').should('be.visible');
    
    // Check if services exist or empty state is shown
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Find the Services section (div.mb-12 that contains the h2 header)
        cy.get('h2').contains(/services|week of/i).parents('.mb-12').first().within(() => {
          // Verify service cards exist using data-slot attribute
          cy.get('[data-slot="card"]').should('have.length.greaterThan', 0);
          
          // Verify first service card has title (h3)
          cy.get('[data-slot="card"]').first().find('h3').should('exist').and('not.be.empty');
          
          // Verify time display with AM/PM exists in service cards (check for span with time)
          cy.get('[data-slot="card"]').first().find('span').then($spans => {
            const texts = $spans.toArray().map(el => el.textContent);
            expect(texts.some(text => text && (text.includes('AM') || text.includes('PM')))).to.be.true;
          });
          
          // Verify service cards have clock icon (SVG)
          cy.get('[data-slot="card"]').first().find('svg').should('exist');
        });
      } else {
        // Verify empty state is shown
        cy.contains('No services found').should('be.visible');
      }
    });
  });

  it('opens service details modal when card clicked', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if services exist
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Get the first service card title
        cy.get('[data-slot="card"]').first().find('h3').invoke('text').then((serviceTitle) => {
          // Click on first service card
          cy.get('[data-slot="card"]').first().click();
          
          // Verify modal opens with fixed overlay
          cy.get('.fixed.inset-0', { timeout: 5000 }).should('be.visible');
          
          // Verify modal contains service details
          cy.get('.fixed.inset-0').within(() => {
            // Verify title exists (h2)
            cy.get('h2').should('exist').and('contain', serviceTitle.trim());
            
            // Verify time display with day and time
            cy.get('svg').should('exist'); // Clock icon
            cy.contains(/AM|PM/).should('exist');
            
            // Verify close button exists
            cy.get('button').should('exist');
          });
          
          // Close modal by clicking close button
          cy.get('.fixed.inset-0 button').first().click();
          
          // Verify modal closed
          cy.get('.fixed.inset-0').should('not.exist');
        });
      }
    });
  });

  it('filters services by day of the week', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if services exist
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Open filter dialog
        cy.contains('button', 'Filters').first().click();
        
        // Verify dialog appears
        cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
        
        // Verify dialog title
        cy.get('[role="dialog"]').within(() => {
          cy.contains('Filter services').should('be.visible');
          
          // Select a day of the week (e.g., Sunday)
          cy.get('#service-filter-day').click();
        });
        
        // Select Sunday from dropdown
        cy.contains('[role="option"]', 'Sunday').click();
        
        // Apply filters
        cy.get('[role="dialog"]').within(() => {
          cy.contains('button', 'Apply filters').click();
        });
        
        // Verify dialog closed
        cy.get('[role="dialog"]').should('not.exist');
        
        // Verify filter label is shown
        cy.contains('Day: Sunday').should('be.visible');
        
        // Verify filtered results show Sunday services
        cy.get('body').should('contain.text', 'Sunday');
      }
    });
  });

  it('filters services by time of day', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if services exist
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Open filter dialog
        cy.contains('button', 'Filters').first().click();
        
        // Verify dialog appears
        cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
        
        // Select a time range (e.g., Morning)
        cy.get('[role="dialog"]').within(() => {
          cy.get('#service-filter-time').click();
        });
        
        // Select Morning from dropdown
        cy.contains('[role="option"]', 'Morning').click();
        
        // Apply filters
        cy.get('[role="dialog"]').within(() => {
          cy.contains('button', 'Apply filters').click();
        });
        
        // Verify dialog closed
        cy.get('[role="dialog"]').should('not.exist');
        
        // Verify filter label is shown
        cy.contains('Time: Morning').should('be.visible');
      }
    });
  });

  it('filters services by title', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if services exist
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Get the first service title
        cy.get('h3').first().invoke('text').then((serviceTitle) => {
          const searchText = serviceTitle.trim().substring(0, 5);
          
          if (searchText) {
            // Open filter dialog
            cy.contains('button', 'Filters').first().click();
            
            // Verify dialog appears
            cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
            
            // Enter title search
            cy.get('#service-filter-title').clear().type(searchText);
            
            // Apply filters
            cy.contains('button', 'Apply filters').click();
            
            // Verify dialog closed
            cy.get('[role="dialog"]').should('not.exist');
            
            // Verify filter label is shown
            cy.contains(`Title: "${searchText}"`).should('be.visible');
            
            // Verify filtered results contain the search text
            cy.get('h3').first().should('contain', searchText);
          }
        });
      }
    });
  });

  it('resets service filters correctly', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if services exist
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Open filter dialog
        cy.contains('button', 'Filters').first().click();
        
        // Apply a filter
        cy.get('[role="dialog"]').within(() => {
          cy.get('#service-filter-day').click();
        });
        cy.contains('[role="option"]', 'Sunday').click();
        cy.get('[role="dialog"]').within(() => {
          cy.contains('button', 'Apply filters').click();
        });
        
        // Verify filter is applied
        cy.contains('Day: Sunday').should('be.visible');
        
        // Open filter dialog again
        cy.contains('button', 'Filters').first().click();
        
        // Reset filters
        cy.get('[role="dialog"]').within(() => {
          cy.contains('button', 'Reset filters').click();
        });
        
        // Verify dialog closed and filter labels are gone
        cy.get('[role="dialog"]').should('not.exist');
        cy.contains('Day: Sunday').should('not.exist');
      }
    });
  });

  it('displays service timeline when available', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      if ($body.text().includes('Loading')) {
        cy.contains('Loading', { timeout: 10000 }).should('not.exist');
      }
    });
    
    // Check if services exist
    cy.get('body').then(($body) => {
      const hasNoServices = $body.text().includes('No services found');
      
      if (!hasNoServices) {
        // Click on first service card
        cy.get('[data-slot="card"]').first().click();
        
        // Verify modal opens
        cy.get('.fixed.inset-0', { timeout: 5000 }).should('be.visible');
        
        // Check if timeline exists (optional based on data)
        cy.get('.fixed.inset-0').then(($modal) => {
          // Timeline has border-l-4 border-blue-900
          const hasTimeline = $modal.find('.border-l-4.border-blue-900').length > 0;
          
          if (hasTimeline) {
            cy.get('.border-l-4.border-blue-900').should('exist').and('be.visible');
          }
        });
      }
    });
  });

  it('page is responsive for services section', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.get('h2').contains(/services|week of/i).should('be.visible');
    cy.contains('button', 'Filters').should('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.get('h2').contains(/services|week of/i).should('be.visible');
    cy.contains('button', 'Filters').should('be.visible');
    
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.get('h2').contains(/services|week of/i).should('be.visible');
    cy.contains('button', 'Filters').should('be.visible');
  });
});
