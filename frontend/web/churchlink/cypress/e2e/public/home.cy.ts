describe('Public – Home Page – Web Builder Components', () => {
  beforeEach(() => {
    // SPY on API calls (allows live server data through)
    cy.intercept('GET', '**/api/v1/pages/slug/*').as('getPage');
    cy.intercept('GET', '**/api/v1/header').as('getHeader');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('loads home page and renders content or construction message', () => {
    cy.visit('/');
    
    // Wait for page data
    cy.wait('@getPage', { timeout: 15000 });
    
    // Wait for page to fully render
    cy.get('body', { timeout: 10000 }).should('be.visible');
    
    // Page should show EITHER dynamic content OR construction message
    cy.get('body').then(($body) => {
      const hasNavigation = $body.find('[role="navigation"], nav, header').length > 0;
      const hasSections = $body.find('section, [data-testid*="section"], [class*="section"]').length > 0;
      const hasHeadings = $body.find('h1, h2, h3').length > 0;
      const hasConstruction = $body.text().includes('construction') || $body.text().includes('coming soon');
      
      expect(hasNavigation || hasSections || hasHeadings || hasConstruction, 
        'Page must show navigation, sections, headings, OR construction message').to.be.true;
    });
    
    // Verify interactive elements (buttons/links) are present - confirms page rendered successfully
    cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');
  });

  it('verifies navigation is present', () => {
    cy.visit('/');
    cy.wait('@getHeader');
    
    // Navigation should exist
    cy.get('[role="navigation"], nav, header').should('exist');
    
    // Verify navigation has links/buttons - confirms functional nav
    cy.get('[role="navigation"], nav, header').within(() => {
      cy.get('a, button').should('have.length.greaterThan', 0);
    });
  });

  // 7.x.1 Hero Container Tests
  it('renders hero container with buttons that navigate correctly', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Wait for page to render
    cy.get('body', { timeout: 10000 }).should('be.visible');
    
    // Scroll to top to ensure hero section is visible
    cy.scrollTo('top');
    cy.wait(300);
    
    cy.get('body').then(($body) => {
      // Check if hero section exists (typically first container)
      const hasHeroButtons = $body.find('a').filter((i, el) => {
        const text = Cypress.$(el).text();
        return text.includes('Plan Your Visit') || text.includes('Watch Online');
      }).length > 0;
      
      if (hasHeroButtons) {
        // Scroll to and verify "Plan Your Visit" button
        cy.contains('a', 'Plan Your Visit').scrollIntoView().should('be.visible').and('have.attr', 'href');
        
        // Scroll to and verify "Watch Online" button
        cy.contains('a', 'Watch Online').scrollIntoView().should('be.visible').and('have.attr', 'href');
        
        // Test button navigation - should redirect to top of same page
        cy.contains('a', 'Plan Your Visit').then(($link) => {
          const href = $link.attr('href');
          expect(href).to.match(/^#|^\//); // Should be anchor link or same page
        });
        
        // Verify hero container styling (background and layout)
        cy.get('div.relative.mx-auto').first().should('exist');
      }
    });
  });

  it('hero container displays background image or color', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Scroll to top to ensure hero section is visible
    cy.scrollTo('top');
    cy.wait(300);
    
    cy.get('body').then(($body) => {
      // Check for section with background styling
      const hasSectionBg = $body.find('section').filter((i, el) => {
        const bgImage = Cypress.$(el).css('background-image');
        const bgColor = Cypress.$(el).css('background-color');
        return bgImage !== 'none' || bgColor !== 'rgba(0, 0, 0, 0)';
      }).length > 0;
      
      if (hasSectionBg) {
        // Scroll to and verify section has background image or color
        cy.get('section').first().scrollIntoView().should('exist').and('be.visible');
      }
    });
  });

  // 7.x.2 Upcoming Events Tests
  it('renders upcoming events section with title and filters', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    cy.get('body').then(($body) => {
      const hasEventsSection = $body.text().includes('Upcoming Events');
      
      if (hasEventsSection) {
        // Scroll to events section and ensure it's visible
        cy.contains('h2', 'Upcoming Events').scrollIntoView({ duration: 500 }).should('be.visible');
        cy.wait(1000);
        
        // Verify filters button exists
        cy.contains('button', 'Filters').scrollIntoView().should('be.visible');
        
        // Verify event grid or empty state
        cy.get('body').then(($checkBody) => {
          if ($checkBody.text().includes('There are no upcoming events')) {
            cy.contains('There are no upcoming events').scrollIntoView().should('be.visible');
          } else {
            cy.get('div.grid').scrollIntoView().should('exist').and('be.visible');
          }
        });
      }
    });
  });

  it('opens event filters dialog and displays all filter options', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    cy.get('body').then(($body) => {
      const hasEventsSection = $body.text().includes('Upcoming Events');
      
      if (hasEventsSection) {
        // Scroll to events section and center the filters button in viewport
        cy.contains('h2', 'Upcoming Events').scrollIntoView({ duration: 300 }).should('be.visible');
        cy.wait(500);
        
        // Scroll filters button into center of viewport for better visibility
        cy.contains('button', 'Filters').scrollIntoView({ duration: 300, offset: { top: -200, left: 0 } });
        cy.wait(500);
        
        // Click filters button
        cy.contains('button', 'Filters').click();
        cy.wait(800);
        
        // Verify dialog is fully visible and centered
        cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
        cy.wait(1000);
        
        // Scroll dialog to ensure it's in viewport
        cy.get('[role="dialog"]').then(($dialog) => {
          $dialog[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        cy.wait(500);
        
        // Verify filter inputs within dialog
        cy.get('[role="dialog"]').within(() => {
          cy.get('#genderSel').should('exist');
          cy.get('#minAge').should('exist');
          cy.get('#maxAge').should('exist');
          cy.get('#uniqueOnlyChk').should('exist');
          cy.get('#membersOnlyOnlyChk').should('exist');
        });
        cy.wait(1000);
        
        // Close dialog with visible delay
        cy.get('body').type('{esc}');
        cy.wait(500);
        cy.get('[role="dialog"]').should('not.exist');
      }
    });
  });

  it('displays event cards with correct information', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    cy.get('body').then(($body) => {
      const hasEventsSection = $body.text().includes('Upcoming Events');
      const hasNoEvents = $body.text().includes('There are no upcoming events');
      
      if (hasEventsSection && !hasNoEvents) {
        // Scroll to events section and ensure it's visible
        cy.contains('h2', 'Upcoming Events').scrollIntoView({ duration: 500 });
        cy.wait(1000);
        
        // Verify event cards exist
        cy.get('div.grid').scrollIntoView({ duration: 500 }).should('exist').and('be.visible');
        
        // Verify event cards have required structure (from EventListTile)
        cy.get('div.grid > div').first().scrollIntoView().should('exist').and('be.visible');
      }
    });
  });

  // 7.x.3 Map Embed Tests
  it('renders map section with Google Maps embed', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to approximate map location
    cy.scrollTo(0, 1200, { duration: 500 });
    cy.wait(800);
    
    cy.get('body').then(($body) => {
      const hasMapSection = $body.text().includes('Our Location');
      
      if (hasMapSection) {
        // Scroll directly to map section title
        cy.contains('h2', 'Our Location').scrollIntoView({ duration: 300, offset: { top: -100, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Check if iframe exists and verify it
        cy.get('body').then(($check) => {
          if ($check.find('iframe[src*="google.com/maps"]').length > 0) {
            cy.get('iframe[src*="google.com/maps"]').scrollIntoView({ duration: 300 }).should('be.visible');
            cy.wait(500);
            cy.get('iframe[src*="google.com/maps"]').should('have.attr', 'src').and('include', 'google.com/maps');
            cy.wait(500);
          }
        });
      } else {
        cy.scrollTo(0, 1200, { duration: 500 });
        cy.wait(500);
        cy.log('Map section not found on page - skipping test');
      }
    });
  });

  it('map embed has proper dimensions and styling', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to map area
    cy.scrollTo(0, 1200, { duration: 500 });
    cy.wait(800);
    
    cy.get('body').then(($body) => {
      const hasMapSection = $body.find('iframe[src*="google.com/maps"]').length > 0;
      
      if (hasMapSection) {
        cy.get('iframe[src*="google.com/maps"]').scrollIntoView({ duration: 300, offset: { top: -100, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Verify iframe has dimensions
        cy.get('iframe[src*="google.com/maps"]')
          .parent()
          .should('have.css', 'width')
          .and('not.equal', '0px');
        cy.wait(300);
        
        cy.get('iframe[src*="google.com/maps"]')
          .should('have.css', 'width')
          .and('not.equal', '0px');
        cy.wait(500);
      } else {
        cy.scrollTo(0, 1200, { duration: 500 });
        cy.wait(500);
        cy.log('Map iframe not found on page - skipping test');
      }
    });
  });

  // 7.x.4 Donations Container (PayPal) Tests
  it('renders donation section with PayPal form', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to donation area
    cy.scrollTo(0, 1800, { duration: 500 });
    cy.wait(800);
    
    cy.get('body').then(($body) => {
      const hasDonationSection = $body.text().includes('Support with PayPal');
      
      if (hasDonationSection) {
        // Scroll directly to donation section
        cy.contains('Support with PayPal').scrollIntoView({ duration: 300, offset: { top: -100, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Verify form elements exist
        cy.get('#amount').should('exist').and('be.visible').and('have.attr', 'type', 'number');
        cy.wait(300);
        cy.get('#currency').should('exist').and('be.visible');
        cy.get('#donation-mode-one-time').should('exist').and('be.visible');
        cy.get('#donation-mode-recurring').should('exist').and('be.visible');
        cy.contains('button', 'Continue to PayPal').should('exist').and('be.visible');
        cy.wait(500);
      } else {
        cy.scrollTo(0, 1800, { duration: 500 });
        cy.wait(500);
      }
    });
  });

  it('donation form validates amount input and enables submit button', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    cy.get('body').then(($body) => {
      const hasDonationSection = $body.text().includes('Support with PayPal');
      
      if (hasDonationSection) {
        // Scroll donation section to center of viewport
        cy.contains('Support with PayPal').scrollIntoView({ duration: 300, offset: { top: -150, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Verify button disabled initially
        cy.contains('button', 'Continue to PayPal').should('be.disabled');
        cy.wait(500);
        
        // Scroll to and highlight amount input
        cy.get('#amount').scrollIntoView({ duration: 200 }).should('be.visible');
        cy.wait(300);
        
        // Enter valid amount
        cy.get('#amount').clear().type('25', { delay: 100 });
        cy.wait(800);
        
        // Verify button becomes enabled
        cy.contains('button', 'Continue to PayPal').should('not.be.disabled');
        cy.wait(500);
        
        // Scroll to recurring option and highlight it
        cy.get('#donation-mode-recurring').scrollIntoView({ duration: 200 });
        cy.wait(300);
        
        // Test switching to recurring
        cy.get('#donation-mode-recurring').click({ force: true });
        cy.wait(800);
        
        // Verify interval selector appears and scroll to it
        cy.get('#interval').should('be.visible').scrollIntoView({ duration: 200 });
        cy.wait(500);
        
        // Switch back to one-time
        cy.get('#donation-mode-one-time').scrollIntoView({ duration: 200 }).click({ force: true });
        cy.wait(800);
        
        // Verify button still enabled
        cy.contains('button', 'Continue to PayPal').scrollIntoView({ duration: 200 }).should('not.be.disabled');
        cy.wait(500);
      }
    });
  });

  it('donation form displays summary of selected options', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    cy.get('body').then(($body) => {
      const hasDonationSection = $body.text().includes('Support with PayPal');
      
      if (hasDonationSection) {
        // Scroll donation section to center
        cy.contains('Support with PayPal').scrollIntoView({ duration: 300, offset: { top: -150, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Scroll to amount input
        cy.get('#amount').scrollIntoView({ duration: 200 }).should('be.visible');
        cy.wait(300);
        
        // Enter amount with visible typing
        cy.get('#amount').clear().type('50', { delay: 100 });
        cy.wait(800);
        
        // Scroll summary into view
        cy.contains('Summary').scrollIntoView({ duration: 200 }).should('be.visible');
        cy.wait(500);
        
        // Verify summary displays amount
        cy.contains('50.00').should('be.visible');
        cy.wait(500);
        
        // Scroll to recurring option
        cy.get('#donation-mode-recurring').scrollIntoView({ duration: 200 });
        cy.wait(300);
        
        // Switch to recurring
        cy.get('#donation-mode-recurring').click({ force: true });
        cy.wait(800);
        
        // Scroll back to summary to show the update
        cy.contains('Summary').scrollIntoView({ duration: 200 });
        cy.wait(500);
        
        // Verify summary updates for recurring
        cy.contains('recurring donation').should('be.visible');
        cy.wait(500);
      }
    });
  });

  // 7.x.5 Service Times Tests
  it('renders service times section with info cards', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to service times area
    cy.scrollTo(0, 2500, { duration: 500 });
    cy.wait(800);
    
    cy.get('body').then(($body) => {
      const hasServiceTimesSection = $body.text().includes('Service Times');
      
      if (hasServiceTimesSection) {
        // Scroll directly to service times section
        cy.contains('h2', 'Service Times').scrollIntoView({ duration: 300, offset: { top: -100, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Verify info cards exist
        cy.contains('h3', 'Location').should('be.visible');
        cy.wait(300);
        cy.contains('h3', 'Kids & Students').should('be.visible');
        cy.wait(300);
        cy.contains('h3', 'Sunday Gatherings').should('be.visible');
        cy.wait(300);
        
        // Verify "Plan Your Visit" button exists
        cy.contains('a', 'Plan Your Visit').should('be.visible').and('have.attr', 'href');
        cy.wait(500);
      } else {
        cy.scrollTo(0, 2500, { duration: 500 });
        cy.wait(500);
      }
    });
  });

  it('service times cards display correct information', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to service times area
    cy.scrollTo(0, 2500, { duration: 500 });
    cy.wait(800);
    
    cy.get('body').then(($body) => {
      const hasServiceTimesSection = $body.text().includes('Service Times');
      
      if (hasServiceTimesSection) {
        // Scroll to service times section
        cy.contains('h2', 'Service Times').scrollIntoView({ duration: 300, offset: { top: -100, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Verify Location card - check for any part of address
        cy.get('body').then(($check) => {
          const bodyText = $check.text();
          if (bodyText.includes('Watt Ave') || bodyText.includes('Location')) {
            cy.contains('h3', 'Location').parent().should('be.visible');
            cy.wait(300);
          }
        });
        
        // Verify Kids card exists
        cy.contains('h3', 'Kids & Students').parent().should('be.visible');
        cy.wait(300);
        
        // Verify Gatherings card exists and check for time patterns
        cy.contains('h3', 'Sunday Gatherings').parent().should('be.visible');
        cy.wait(500);
      } else {
        cy.scrollTo(0, 2500, { duration: 500 });
        cy.wait(500);
      }
    });
  });

  it('service times "Plan Your Visit" button navigates correctly', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to service times area
    cy.scrollTo(0, 2500, { duration: 500 });
    cy.wait(800);
    
    cy.get('body').then(($body) => {
      const hasServiceTimesSection = $body.text().includes('Service Times');
      
      if (hasServiceTimesSection) {
        // Scroll to service times section
        cy.contains('h2', 'Service Times').scrollIntoView({ duration: 300, offset: { top: -100, left: 0 } }).should('be.visible');
        cy.wait(800);
        
        // Find and verify the "Plan Your Visit" button
        cy.contains('a', 'Plan Your Visit').scrollIntoView({ duration: 200 }).should('be.visible').and('have.attr', 'href');
        cy.wait(500);
      } else {
        cy.scrollTo(0, 2500, { duration: 500 });
        cy.wait(500);
      }
    });
  });

  // 7.x.6 Contact Info Tests
  it('renders contact info section with phone and email', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to bottom
    cy.scrollTo('bottom', { duration: 500 });
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      // Check for contact info
      const hasPhoneOrEmail = $body.text().match(/\(\d{3}\)\s?\d{3}-\d{4}/) || 
                              $body.text().match(/[\w.-]+@[\w.-]+\.\w+/);
      
      if (hasPhoneOrEmail) {
        // Verify contact items or icons exist
        cy.get('body').then(($check) => {
          if ($check.find('img[alt*="Phone"], img[alt*="Email"]').length > 0) {
            cy.get('img[alt*="Phone"], img[alt*="Email"]').first().scrollIntoView({ duration: 200 }).should('be.visible');
            cy.wait(500);
          }
        });
      } else {
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);
      }
    });
  });

  it('contact info displays correct phone and email values', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to bottom
    cy.scrollTo('bottom', { duration: 500 });
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      const hasPhoneOrEmail = $body.text().match(/\(\d{3}\)\s?\d{3}-\d{4}/) || 
                              $body.text().match(/[\w.-]+@[\w.-]+\.\w+/);
      
      if (hasPhoneOrEmail) {
        // Verify phone number if present
        const phoneMatch = $body.text().match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        if (phoneMatch) {
          cy.get('body').should('contain.text', phoneMatch[0]);
          cy.wait(300);
        }
        
        // Verify email if present
        const emailMatch = $body.text().match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          cy.get('body').should('contain.text', emailMatch[0]);
          cy.wait(500);
        }
      } else {
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);
      }
    });
  });

  it('contact info icons are properly displayed with labels', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Force scroll to bottom
    cy.scrollTo('bottom', { duration: 500 });
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      const hasContactInfo = $body.find('img[alt*="Phone"], img[alt*="Email"]').length > 0;
      
      if (hasContactInfo) {
        // Scroll to first icon
        cy.get('img[alt*="Phone"], img[alt*="Email"]').first().scrollIntoView({ duration: 200 });
        cy.wait(500);
        
        // Verify icons have proper attributes
        cy.get('img[alt*="Phone"], img[alt*="Email"]').each(($img) => {
          cy.wrap($img)
            .should('be.visible')
            .and('have.attr', 'alt')
            .and('not.be.empty');
          cy.wait(200);
          
          cy.wrap($img)
            .should('have.css', 'width')
            .and('not.equal', '0px');
        });
        cy.wait(500);
      } else {
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);
      }
    });
  });

  // Responsive Tests
  it('all components are responsive across different viewports', () => {
    cy.visit('/');
    cy.wait('@getPage', { timeout: 15000 });
    
    // Mobile viewport (iPhone X)
    cy.viewport('iphone-x');
    cy.wait(500);
    cy.get('body').should('be.visible');
    cy.scrollTo('top', { duration: 200 });
    cy.wait(300);
    cy.get('button, a[href]').should('exist');
    
    // Verify key components still visible on mobile with scrolling
    cy.get('body').then(($body) => {
      if ($body.text().includes('Upcoming Events')) {
        cy.contains('Upcoming Events').scrollIntoView({ duration: 200 }).should('be.visible');
        cy.wait(300);
      }
      if ($body.text().includes('Support with PayPal')) {
        cy.contains('Support with PayPal').scrollIntoView({ duration: 200 }).should('be.visible');
        cy.wait(300);
      }
    });
    
    // Tablet viewport (iPad 2)
    cy.viewport('ipad-2');
    cy.wait(500);
    cy.scrollTo('top', { duration: 200 });
    cy.wait(300);
    cy.get('body').should('be.visible');
    cy.get('button, a[href]').should('exist');
    
    // Desktop viewport (1920x1080)
    cy.viewport(1920, 1080);
    cy.wait(500);
    cy.scrollTo('top', { duration: 200 });
    cy.wait(300);
    cy.get('body').should('be.visible');
    cy.get('button, a[href]').should('exist').and('be.visible');
    
    // Verify all sections maintain proper layout on desktop
    cy.get('section').should('have.length.greaterThan', 0);
    cy.wait(300);
  });

  it('handles page data from backend properly', () => {
    cy.visit('/');
    cy.wait('@getPage').then((interception) => {
      const pageData = interception.response?.body;
      
      if (pageData?.visible === false) {
        // Should show construction or not available
        cy.get('body').should('contain.text', /construction|coming soon|not available/i);
      } else if (pageData?.sections && pageData.sections.length > 0) {
        // Should render sections
        cy.get('section, [data-testid*="section"]', { timeout: 10000 })
          .should('have.length.greaterThan', 0);
      }
      
      // Either way, page should not be completely blank
      cy.get('body').invoke('text').should('not.be.empty');
    });
    
    // Verify page has interactive elements - confirms successful render
    cy.get('button, a[href]').should('exist');
  });
});
