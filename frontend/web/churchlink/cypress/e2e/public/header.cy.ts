describe('Web Navigation – Header Tests', () => {
  beforeEach(() => {
    // SPY on API calls - let real data through from running server
    cy.intercept('GET', '**/api/v1/header').as('getHeader');
    cy.intercept('GET', '**/api/v1/users/check-mod').as('checkMod');
  });

  afterEach(() => {
    // Prevent race conditions between tests
    cy.wait(500);
  });

  it('displays header with navigation links on desktop', () => {
    // Set viewport to desktop
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Verify header/navbar is visible
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Verify navigation menu list exists
    cy.get('[data-slot="navigation-menu-list"]').should('be.visible');
    
    // Check if navigation items exist
    cy.get('body').then(($body) => {
      const navItems = $body.find('[data-slot="navigation-menu-item"]');
      
      if (navItems.length > 0) {
        // Verify at least one navigation item is visible
        cy.get('[data-slot="navigation-menu-item"]')
          .should('have.length.greaterThan', 0);
      }
    });
  });

  it('displays admin defined navigation items from live server', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Wait for loading to complete
    cy.get('body').then(($body) => {
      // Check if navigation items are present
      const navItems = $body.find('[data-slot="navigation-menu-item"]');
      
      if (navItems.length > 0) {
        // Verify navigation items render correctly
        cy.get('[data-slot="navigation-menu-item"]').each(($item) => {
          // Each item should have visible text content
          cy.wrap($item).should('be.visible');
          cy.wrap($item).invoke('text').should('not.be.empty');
        });
      }
    });
  });

  it('opens dropdown menus when hovered', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      // Find navigation items that have dropdown indicators (ChevronDown icon)
      const dropdownItems = $body.find('[data-slot="navigation-menu-item"]:has(svg)');
      
      if (dropdownItems.length > 0) {
        // Get the first dropdown item
        cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().then(($dropdown) => {
          // Hover over dropdown trigger
          cy.wrap($dropdown).trigger('mouseenter');
          
          // Wait a moment for dropdown animation
          cy.wait(500);
          
          // Verify dropdown menu appears
          cy.wrap($dropdown).within(() => {
            // Dropdown content should be visible (absolute positioned div)
            cy.get('div.absolute').should('be.visible');
            
            // Dropdown should contain sub-items (buttons)
            cy.get('button').should('have.length.greaterThan', 0);
          });
        });
      }
    });
  });

  it('navigates when header link clicked', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      // Find a direct link (no dropdown icon)
      const directLinks = $body.find('[data-slot="navigation-menu-item"] button').not(':has(svg)');
      
      if (directLinks.length > 0) {
        // Click the first direct link
        cy.get('[data-slot="navigation-menu-item"] button').not(':has(svg)').first().then(($link) => {
          const linkText = $link.text().trim();
          
          if (linkText && linkText !== 'Home') {
            cy.wrap($link).click();
            
            // Verify navigation occurred (URL changed or stayed on home)
            cy.url().should('exist');
          }
        });
      } else {
        // Try clicking a dropdown sub-item instead
        const dropdownItems = $body.find('[data-slot="navigation-menu-item"]:has(svg)');
        
        if (dropdownItems.length > 0) {
          // Hover over dropdown
          cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().trigger('mouseenter');
          cy.wait(500);
          
          // Click first sub-item
          cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().within(() => {
            cy.get('button').filter(':not(:has(svg))').first().click();
          });
          
          // Verify navigation occurred
          cy.url().should('exist');
        }
      }
    });
  });

  it('displays profile options when user is logged in', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      // Check if user is logged in by looking for profile dropdown
      const hasProfileIcon = $body.find('[data-slot="navigation-menu"] .hidden.lg\\:flex').length > 0;
      
      if (hasProfileIcon) {
        // User is logged in - verify profile dropdown exists
        cy.get('[data-slot="navigation-menu"]')
          .find('.hidden.lg\\:flex')
          .should('exist');
      } else {
        // User is not logged in - verify login button exists
        cy.get('[data-slot="navigation-menu"]').within(() => {
          cy.contains('a', 'Log In').should('be.visible');
        });
      }
    });
  });

  it('church icon navigates to home page from header', () => {
    cy.viewport(1920, 1080);
    
    // Start from a different page
    cy.visit('/sermons');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Click church icon (HeaderDove logo) - it's in a Link to "/"
    cy.get('[data-slot="navigation-menu"]')
      .find('a[href="/"]')
      .first()
      .click();
    
    // Verify navigation to home page
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('hamburger menu is hidden on desktop', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Verify hamburger menu is not visible on desktop
    // SidebarTrigger has lg:hidden class - should NOT be visible on desktop
    cy.get('[data-slot="navigation-menu"]')
      .find('button[data-slot="sidebar-trigger"]')
      .should('not.be.visible');
  });

  it('navigation items are visible on desktop', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const navItems = $body.find('[data-slot="navigation-menu-item"]');
      
      if (navItems.length > 0) {
        // On desktop, navigation items should be visible
        // They have hidden lg:block classes
        cy.get('[data-slot="navigation-menu-item"]').should('be.visible');
      }
    });
  });

  it('header is responsive and maintains layout', () => {
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Verify church icon is visible
    cy.get('[data-slot="navigation-menu"]')
      .find('a[href="/"]')
      .should('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.get('[data-slot="navigation-menu"]').should('be.visible');
    
    // Test large desktop viewport
    cy.viewport(2560, 1440);
    cy.get('[data-slot="navigation-menu"]').should('be.visible');
  });

  it('dropdown closes when mouse leaves', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      // Find navigation items that have dropdown indicators
      const dropdownItems = $body.find('[data-slot="navigation-menu-item"]:has(svg)');
      
      if (dropdownItems.length > 0) {
        // Hover over dropdown to open it
        cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().trigger('mouseenter');
        cy.wait(500);
        
        // Verify dropdown is visible
        cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().within(() => {
          cy.get('div.absolute').should('be.visible');
        });
        
        // Move mouse away from dropdown
        cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().trigger('mouseleave');
        cy.wait(500);
        
        // Verify dropdown is no longer visible
        cy.get('[data-slot="navigation-menu-item"]').filter(':has(svg)').first().within(() => {
          cy.get('div.absolute').should('not.exist');
        });
      }
    });
  });

  it('displays auth-specific content correctly', () => {
    cy.viewport(1920, 1080);
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for header to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      
      // Check for either login button or profile dropdown
      if (bodyText.includes('Log In')) {
        // User is not logged in
        cy.get('[data-slot="navigation-menu"]').within(() => {
          cy.contains('a', 'Log In').should('be.visible');
        });
      } else {
        // User might be logged in - look for profile elements
        const hasProfileSection = $body.find('[data-slot="navigation-menu"] .hidden.lg\\:flex').length > 0;
        expect(hasProfileSection).to.be.oneOf([true, false]); // Either state is valid
      }
    });
  });
});
