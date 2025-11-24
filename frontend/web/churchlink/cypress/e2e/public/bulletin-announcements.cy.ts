describe('Bulletin – Web – Announcements Tests', () => {
  beforeEach(() => {
    // SPY on API calls (not mock - let real data through)
    cy.intercept('GET', '**/v1/bulletins/current_week').as('getCurrentWeek');
    cy.intercept('GET', '**/v1/bulletins/*').as('getBulletinFeed');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('displays announcements section with cards', () => {
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
    
    // Verify Announcements section header is visible
    cy.get('h2').contains('Announcements', { timeout: 5000 }).should('be.visible');
    
    // Verify announcements filter button exists (second filter button on page)
    cy.contains('button', 'Filters').should('have.length.greaterThan', 0);
    
    // Check if announcements exist or empty state is shown
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Verify at least one bulletin card exists with headline (h3)
        // Bulletin cards appear after service cards in the DOM
        cy.get('[data-slot="card"]').should('have.length.greaterThan', 0);
        // Get the last card (bulletin card, not service card)
        cy.get('[data-slot="card"]').last().find('h3').should('exist').and('not.be.empty');
      } else {
        // Verify empty state is shown
        cy.contains('No announcements found').should('be.visible');
      }
    });
  });

  it('opens announcement details modal when card clicked', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Get the last bulletin card (announcements appear after services)
        cy.get('[data-slot="card"]').last().find('h3').invoke('text').then((bulletinHeadline) => {
          // Click on the bulletin card
          cy.get('[data-slot="card"]').last().click();
            
            // Verify modal opens with dialog role
            cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
            
            // Verify modal contains announcement details
            cy.get('[role="dialog"]').within(() => {
              // Verify headline exists
              cy.get('h2').should('exist').and('contain', bulletinHeadline.trim());
              
              // Verify close button exists
              cy.get('button').should('exist');
            });
            
          // Close modal by pressing Escape
          cy.get('body').type('{esc}');
          
          // Verify modal closed
          cy.get('[role="dialog"]').should('not.exist');
        });
      }
    });
  });

  it('filters announcements by ministry', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Check if there are ministry tags on bulletin cards
        cy.get('[data-slot="card"]').last().then(($card) => {
          const hasMinistriesTag = $card.find('.bg-gray-200').length > 0;
          
          if (hasMinistriesTag) {
            // Get a ministry name from a tag on the bulletin card
            cy.get('[data-slot="card"]').last().find('.bg-gray-200').first().invoke('text').then((ministryName) => {
                const ministry = ministryName.trim();
                
                if (ministry && !ministry.includes('+') && ministry !== 'more') {
                  // Open filter dialog for announcements section (find button near Announcements heading)
                  cy.get('h2').contains('Announcements').parent().parent().find('button').contains('Filters').click();
                  
                  // Verify dialog appears
                  cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
                  
                  // Verify dialog title
                  cy.get('[role="dialog"]').within(() => {
                    cy.contains('Filter bulletins').should('be.visible');
                    
                    // Select ministry
                    cy.get('#bulletin-filter-ministry').click();
                  });
                  
                  // Select ministry from dropdown
                  cy.contains('[role="option"]', ministry).click();
                  
                  // Apply filters
                  cy.get('[role="dialog"]').within(() => {
                    cy.contains('button', 'Apply filters').click();
                  });
                  
                  // Verify dialog closed
                  cy.get('[role="dialog"]').should('not.exist');
                  
                  // Verify filter label is shown
                  cy.contains(`Ministry: ${ministry}`).should('be.visible');
                }
              });
          }
        });
      }
    });
  });

  it('filters announcements by title', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Get the bulletin card headline (announcements appear after services)
        cy.get('[data-slot="card"]').last().find('h3').invoke('text').then((bulletinHeadline) => {
          const searchText = bulletinHeadline.trim().substring(0, 5);
          
          if (searchText) {
            // Open filter dialog for announcements section (find button near Announcements heading)
            cy.get('h2').contains('Announcements').parent().parent().find('button').contains('Filters').click();
            
            // Verify dialog appears and wait for content to be fully loaded
            cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
            
            // Verify dialog content and interact within dialog context
            cy.get('[role="dialog"]').within(() => {
              cy.contains('Filter bulletins').should('be.visible');
              
              // Wait for and interact with title input
              cy.get('input[placeholder="Search by title"]', { timeout: 5000 }).should('be.visible').clear().type(searchText);
              
              // Apply filters
              cy.contains('button', 'Apply filters').click();
            });
            
            // Verify dialog closed
            cy.get('[role="dialog"]').should('not.exist');
            
            // Verify filter label is shown
            cy.contains(`Title: "${searchText}"`).should('be.visible');
            
            // Verify filtered results contain the search text
            cy.get('[data-slot="card"]').last().find('h3').should('contain', searchText);
          }
        });
      }
    });
  });

  it('resets announcement filters correctly', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Get the bulletin card headline (announcements appear after services)
        cy.get('[data-slot="card"]').last().find('h3').invoke('text').then((bulletinHeadline) => {
          const searchText = bulletinHeadline.trim().substring(0, 3);
          
          if (searchText) {
            // Open filter dialog for announcements section (find button near Announcements heading)
            cy.get('h2').contains('Announcements').parent().parent().find('button').contains('Filters').click();
            
            // Apply a title filter within dialog context
            cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
            cy.get('[role="dialog"]').within(() => {
              cy.contains('Filter bulletins').should('be.visible');
              cy.get('input[placeholder="Search by title"]', { timeout: 5000 }).should('be.visible').clear().type(searchText);
              cy.contains('button', 'Apply filters').click();
            });
            
            // Verify filter is applied
            cy.contains(`Title: "${searchText}"`).should('be.visible');
            
            // Open filter dialog again for announcements section
            cy.get('h2').contains('Announcements').parent().parent().find('button').contains('Filters').click();
            
            // Reset filters
            cy.get('[role="dialog"]').within(() => {
              cy.contains('button', 'Reset filters').click();
            });
            
            // Verify dialog closed and filter labels are gone
            cy.get('[role="dialog"]').should('not.exist');
            cy.contains(`Title: "${searchText}"`).should('not.exist');
          }
        });
      }
    });
  });

  it('displays announcement publish date', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Verify date display on bulletin card (announcements appear after services)
        cy.get('[data-slot="card"]').last().within(() => {
          // Check for date label with uppercase text-xs style
          cy.get('.text-xs.uppercase').should('exist');
        });
      }
    });
  });

  it('displays ministry tags on announcement cards', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Check if bulletin card has ministry tags
        cy.get('[data-slot="card"]').last().then(($card) => {
          // Check if any bulletin card has ministry tags
          const hasMinistriesTag = $card.find('.bg-gray-200').length > 0;
          
          if (hasMinistriesTag) {
            cy.get('[data-slot="card"]').last().within(() => {
              // Verify ministry tags exist with correct styling
              cy.get('.bg-gray-200').should('exist').and('have.class', 'rounded-full');
            });
          }
        });
      }
    });
  });

  it('displays announcement images when available', () => {
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
    
    // Check if announcements exist
    cy.get('body').then(($body) => {
      const hasNoAnnouncements = $body.text().includes('No announcements found');
      
      if (!hasNoAnnouncements) {
        // Check if bulletin card has an image
        cy.get('[data-slot="card"]').last().then(($card) => {
          // Check if any bulletin card has an image
          const hasImages = $card.find('.aspect-video').length > 0;
          
          if (hasImages) {
            cy.get('[data-slot="card"]').last().within(() => {
              // Verify image container exists with correct aspect ratio
              cy.get('.aspect-video').should('exist');
            });
          }
        });
      }
    });
  });

  it('page is responsive for announcements section', () => {
    cy.visit('/weekly-bulletin');
    
    // Wait for API calls
    cy.wait('@getCurrentWeek', { timeout: 15000 });
    cy.wait('@getBulletinFeed', { timeout: 15000 });
    
    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.get('h2').contains('Announcements').should('be.visible');
    cy.contains('button', 'Filters').should('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.get('h2').contains('Announcements').should('be.visible');
    cy.contains('button', 'Filters').should('be.visible');
    
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.get('h2').contains('Announcements').should('be.visible');
    cy.contains('button', 'Filters').should('be.visible');
  });
});
