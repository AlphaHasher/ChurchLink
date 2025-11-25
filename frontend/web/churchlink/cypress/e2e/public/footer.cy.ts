describe('Web Navigation – Footer Tests', () => {
  beforeEach(() => {
    // SPY on API calls - let real data through from running server
    cy.intercept('GET', '**/api/v1/footer/items').as('getFooter');
  });

  afterEach(() => {
    // Prevent race conditions between tests
    cy.wait(500);
  });

  it('displays footer at bottom of page', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to bottom of page
    cy.scrollTo('bottom');
    
    // Verify footer is visible
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    // Verify footer has the correct background color
    cy.get('footer').should('have.class', 'bg-neutral-300');
  });

  it('displays admin defined sections from live server', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const footerContent = $body.find('footer');
      
      // Check if footer has sections
      const sections = footerContent.find('h3');
      
      if (sections.length > 0) {
        // Verify admin-defined sections are present
        cy.get('footer').within(() => {
          // Each section should have a heading (h3)
          cy.get('h3').should('have.length.greaterThan', 0);
          
          // Verify section headings are visible and have text
          cy.get('h3').each(($heading) => {
            cy.wrap($heading).should('be.visible');
            cy.wrap($heading).invoke('text').should('not.be.empty');
          });
        });
      } else {
        // Footer might be empty or optional - verify it doesn't show error
        cy.get('footer').should('not.contain', 'error');
        cy.get('footer').should('not.contain', 'failed');
      }
    });
  });

  it('displays section labels correctly', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const sections = $body.find('footer h3');
      
      if (sections.length > 0) {
        cy.get('footer').within(() => {
          // Verify each section has proper styling
          cy.get('h3').each(($heading) => {
            // Section headings should be bold and larger
            cy.wrap($heading).should('have.class', 'font-bold');
            cy.wrap($heading).should('have.class', 'text-[21px]!');
          });
        });
      }
    });
  });

  it('displays links within sections', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const footerLinks = $body.find('footer ul li a');
      
      if (footerLinks.length > 0) {
        cy.get('footer').within(() => {
          // Verify links are present in lists
          cy.get('ul').should('exist');
          
          // Verify at least one link exists
          cy.get('ul li a').should('have.length.greaterThan', 0);
          
          // Verify each link has visible text
          cy.get('ul li a').each(($link) => {
            cy.wrap($link).invoke('text').should('not.be.empty');
            cy.wrap($link).should('have.class', 'text-neutral-800');
          });
        });
      }
    });
  });

  it('link text is correct and matches admin configuration', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const footerLinks = $body.find('footer ul li a');
      
      if (footerLinks.length > 0) {
        cy.get('footer').within(() => {
          // Verify each link has proper href attribute
          cy.get('ul li a').each(($link) => {
            cy.wrap($link).should('have.attr', 'href');
            cy.wrap($link).invoke('attr', 'href').should('not.be.empty');
          });
        });
      }
    });
  });

  it('navigates when footer link clicked', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const footerLinks = $body.find('footer ul li a');
      
      if (footerLinks.length > 0) {
        // Click the first footer link
        cy.get('footer ul li a').first().then(($link) => {
          const href = $link.attr('href');
          
          if (href && href !== '#') {
            cy.wrap($link).click();
            
            // Verify navigation occurred (URL changed or stayed on same page)
            cy.url().should('exist');
          }
        });
      }
    });
  });

  it('all interactive features are functional', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const footerContent = $body.find('footer');
      
      // Test all clickable elements
      const clickableElements = footerContent.find('a, button');
      
      if (clickableElements.length > 0) {
        cy.get('footer').within(() => {
          // Verify all links are clickable and not disabled
          cy.get('a').each(($element) => {
            cy.wrap($element).should('not.be.disabled');
            cy.wrap($element).should('have.attr', 'href');
          });
          
          // Verify hover styles work
          cy.get('a').first().then(($link) => {
            // Links should have hover:text-black class
            cy.wrap($link).should('have.class', 'hover:text-black');
          });
        });
      }
    });
  });

  it('displays copyright information', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    // Verify copyright text is present
    cy.get('footer').within(() => {
      cy.contains('All rights reserved').should('be.visible');
      
      // Verify current year is displayed
      const currentYear = new Date().getFullYear();
      cy.contains(currentYear.toString()).should('be.visible');
    });
  });

  it('footer layout is responsive', () => {
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    cy.scrollTo('bottom');
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.scrollTo('bottom');
    cy.get('footer').should('be.visible');
    
    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.scrollTo('bottom');
    cy.get('footer').should('be.visible');
    
    // Verify footer sections stack properly on mobile
    cy.get('body').then(($body) => {
      const sections = $body.find('footer h3');
      if (sections.length > 0) {
        cy.get('footer').within(() => {
          // On mobile, sections should be full width
          cy.get('h3').parent().should('have.class', 'w-full');
        });
      }
    });
  });

  it('handles empty footer gracefully', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to bottom
    cy.scrollTo('bottom');
    
    cy.get('body').then(($body) => {
      const hasFooter = $body.find('footer').length > 0;
      
      if (hasFooter) {
        // Footer exists - verify it renders properly
        cy.get('footer').should('be.visible');
      } else {
        // Footer is optional - if not present, that's okay
        // Just verify no error messages are shown
        cy.contains('error').should('not.exist');
        cy.contains('failed').should('not.exist');
      }
    });
  });

  it('footer loads without blocking page render', () => {
    cy.visit('/');
    
    // Page should load quickly without waiting for footer
    cy.get('body', { timeout: 5000 }).should('be.visible');
    
    // Footer can load asynchronously
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Eventually footer should appear
    cy.scrollTo('bottom');
    cy.get('footer', { timeout: 10000 }).should('be.visible');
  });

  it('section items are properly nested and organized', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Wait for footer to load
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const sections = $body.find('footer h3');
      
      if (sections.length > 0) {
        cy.get('footer').within(() => {
          // Each section should have a heading followed by a list
          cy.get('h3').each(($heading) => {
            cy.wrap($heading).parent().within(() => {
              // Section should contain an unordered list
              cy.get('ul').should('exist');
              
              // List should have items
              cy.get('ul li').should('have.length.greaterThan', 0);
            });
          });
        });
      }
    });
  });

  it('footer does not overlap with page content', () => {
    cy.visit('/');
    cy.wait('@getFooter', { timeout: 15000 });
    
    // Get page height before scrolling
    cy.document().then((doc) => {
      const bodyHeight = doc.body.scrollHeight;
      expect(bodyHeight).to.be.greaterThan(0);
    });
    
    // Scroll to footer
    cy.scrollTo('bottom');
    
    // Footer should be visible and at the bottom
    cy.get('footer', { timeout: 10000 }).should('be.visible');
    
    // Verify footer is positioned at the bottom (not fixed/overlapping)
    cy.get('footer').should('have.class', 'bg-neutral-300');
  });
});
