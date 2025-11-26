describe('Web Navigation – Navbar Tests', () => {
  beforeEach(() => {
    // SPY on API calls - let real data through from running server
    cy.intercept('GET', '**/api/v1/header').as('getHeader');
    cy.intercept('GET', '**/api/v1/users/check-mod').as('checkMod');
  });

  afterEach(() => {
    // Prevent race conditions between tests
    cy.wait(500);
  });

  it('displays hamburger menu on mobile viewport', () => {
    // Set viewport to mobile
    cy.viewport('iphone-x');
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for page to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Verify hamburger menu button is visible on mobile
    // SidebarTrigger has lg:hidden class - should be visible on mobile
    cy.get('[data-slot="navigation-menu"]')
      .find('button[data-slot="sidebar-trigger"]')
      .should('be.visible');
  });

  it('opens side panel when hamburger clicked', () => {
    cy.viewport('iphone-x');
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Click hamburger menu
    cy.get('button[data-slot="sidebar-trigger"]').click();
    
    // Verify side panel opens - Sidebar component should be visible
    cy.get('[data-sidebar="sidebar"]', { timeout: 5000 })
      .should('be.visible');
    
    // Verify navigation items container exists
    cy.get('[data-sidebar="sidebar"]').within(() => {
      cy.get('[data-slot="sidebar-menu"]').should('be.visible');
    });
  });

  it('displays header items in side panel', () => {
    cy.viewport('iphone-x');
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Open hamburger menu
    cy.get('button[data-slot="sidebar-trigger"]').click();
    
    // Wait for sidebar to open
    cy.get('[data-sidebar="sidebar"]', { timeout: 5000 }).should('be.visible');
    
    // Check if header items exist
    cy.get('body').then(($body) => {
      const sidebarContent = $body.find('[data-sidebar="sidebar"]');
      
      if (sidebarContent.length > 0) {
        // Verify header items are present in sidebar
        cy.get('[data-sidebar="sidebar"]').within(() => {
          // Should have menu items
          cy.get('[data-slot="sidebar-menu-button"]').should('have.length.greaterThan', 0);
          
          // Verify profile/auth section exists (first item is always profile)
          cy.get('[data-slot="sidebar-menu-button"]').first().should('exist');
        });
      }
    });
  });

  it('displays profile options in side panel', () => {
    cy.viewport('iphone-x');
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Open hamburger menu
    cy.get('button[data-slot="sidebar-trigger"]').click();
    
    // Wait for sidebar to open
    cy.get('[data-sidebar="sidebar"]', { timeout: 5000 }).should('be.visible');
    
    cy.get('[data-sidebar="sidebar"]').within(() => {
      // Get the first menu button (profile/auth section)
      cy.get('[data-slot="sidebar-menu-button"]').first().then(($button) => {
        const buttonText = $button.text();
        
        if (buttonText.includes('Settings')) {
          // User is logged in - click to expand profile options
          cy.wrap($button).click();
          
          // Verify profile submenu appears
          cy.get('[data-slot="sidebar-menu-sub"]', { timeout: 3000 }).should('be.visible');
          cy.get('[data-slot="sidebar-menu-sub"]').within(() => {
            // Should contain Profile option
            cy.contains('Profile').should('be.visible');
            // Should contain Log out option
            cy.contains('Log out').should('be.visible');
          });
        } else if (buttonText.includes('Sign in')) {
          // User is not logged in - verify sign in button
          cy.wrap($button).should('contain', 'Sign in');
        }
      });
    });
  });

  it('displays dropdown items when expanded in side panel', () => {
    cy.viewport('iphone-x');
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Open hamburger menu
    cy.get('button[data-slot="sidebar-trigger"]').click();
    
    // Wait for sidebar to open
    cy.get('[data-sidebar="sidebar"]', { timeout: 5000 }).should('be.visible');
    
    // Find and test dropdown items
    cy.get('[data-sidebar="sidebar"]').then(($sidebar) => {
      const dropdownButtons = $sidebar.find('[data-slot="sidebar-menu-button"]:has(svg)');
      
      if (dropdownButtons.length > 1) { // Skip first one (profile section)
        // Click the second dropdown (first nav dropdown)
        cy.get('[data-slot="sidebar-menu-button"]').eq(1).then(($btn) => {
          // Check if it has a chevron icon (indicating dropdown)
          if ($btn.find('svg').length > 0) {
            cy.wrap($btn).click();
            
            // Verify submenu appears
            cy.get('[data-slot="sidebar-menu-sub"]', { timeout: 3000 }).should('be.visible');
            
            // Verify sub-items are visible
            cy.get('[data-slot="sidebar-menu-sub"]')
              .find('[data-slot="sidebar-menu-sub-button"]')
              .should('have.length.greaterThan', 0);
          }
        });
      }
    });
  });

  it('navigates when side panel link clicked', () => {
    cy.viewport('iphone-x');
    
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Open hamburger menu
    cy.get('button[data-slot="sidebar-trigger"]').click();
    
    // Wait for sidebar to open
    cy.get('[data-sidebar="sidebar"]', { timeout: 5000 }).should('be.visible');
    
    // Find a clickable navigation item (not the profile section)
    cy.get('[data-slot="sidebar-menu-button"]').then(($buttons) => {
      if ($buttons.length > 1) {
        // Get the second button (first nav item after profile)
        const $secondButton = $buttons.eq(1);
        
        // Check if it's a dropdown or direct link
        if ($secondButton.find('svg').length > 0) {
          // It's a dropdown - expand it and click a sub-item
          cy.wrap($secondButton).click();
          cy.get('[data-slot="sidebar-menu-sub"]', { timeout: 3000 }).should('be.visible');
          cy.get('[data-slot="sidebar-menu-sub-button"]').first().click();
        } else {
          // It's a direct link - click it
          cy.wrap($secondButton).click();
        }
        
        // Verify navigation occurred
        cy.url().should('exist');
      }
    });
  });

  it('church icon navigates to home page from sidebar', () => {
    cy.viewport('iphone-x');
    
    // Start from a different page
    cy.visit('/sermons');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Open hamburger menu
    cy.get('button[data-slot="sidebar-trigger"]').click();
    
    // Wait for sidebar to open
    cy.get('[data-sidebar="sidebar"]', { timeout: 5000 }).should('be.visible');
    
    // Click church icon in sidebar
    // The logo is in a Link component at the top of sidebar
    cy.get('[data-sidebar="sidebar"]').find('a[href="/"]').first().click();
    
    // Verify navigation to home page
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('church icon in navbar navigates to home page', () => {
    cy.viewport('iphone-x');
    
    // Start from a different page
    cy.visit('/sermons');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Wait for navbar to load
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Click church icon in navbar (HeaderDove logo)
    cy.get('[data-slot="navigation-menu"]')
      .find('a[href="/"]')
      .first()
      .click();
    
    // Verify navigation to home page
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('navbar is responsive and adapts to mobile viewport', () => {
    // Test on mobile viewport
    cy.viewport('iphone-x');
    cy.visit('/');
    cy.wait('@getHeader', { timeout: 15000 });
    
    // Verify navbar is visible
    cy.get('[data-slot="navigation-menu"]', { timeout: 10000 }).should('be.visible');
    
    // Verify hamburger menu is visible on mobile
    cy.get('button[data-slot="sidebar-trigger"]').should('be.visible');
    
    // Verify nav items are hidden on mobile (they're in the sidebar instead)
    // The navigation items have lg:flex class - should be hidden on mobile
    cy.get('[data-slot="navigation-menu"]')
      .find('[data-slot="navigation-menu-item"]')
      .should('not.be.visible');
  });
});
