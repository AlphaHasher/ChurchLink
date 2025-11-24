describe('Admin Login for Builder', () => {
  it('logs in as admin using adminlogin command and navigates to admin dashboard, creates a new page, adds sections, publishes the page, and deletes the page', () => {
    cy.adminlogin();

    // Verify we're logged in and redirected
    cy.url().should('not.include', '/auth/login');

    // Login form should be gone
    cy.contains('Sign In').should('not.exist');

    // Click on the profile dropdown (Avatar button)
    // The Avatar button is in the navbar and has a rounded-full class
    cy.get('nav button[class*="rounded-full"]').should('be.visible').click();

    // Wait for dropdown menu to appear and click on "Admin Panel" link
    cy.contains('a', 'Admin Panel', { timeout: 5000 }).should('be.visible').click();

    // Verify we're on the admin dashboard
    cy.url().should('include', '/admin');

    // Click on "Pages" under "Web Builder" in the sidebar
    // Web Builder should be expanded by default, so we can click Pages directly
    // Find the sidebar content using data-testid
    cy.get('[data-testid="admin-dashboard-sidebar-content"]', { timeout: 5000 }).within(() => {
      cy.contains('a', 'Pages').should('be.visible').click();
    });

    // Verify we're on the Web Builder Pages page
    cy.url().should('include', '/admin/webbuilder');

    // Wait for the AG Grid table to be visible and loaded
    cy.get('.ag-theme-quartz', { timeout: 10000 }).should('be.visible');

    // Wait for at least one row to be present (table is loaded)
    cy.get('.ag-row', { timeout: 10000 }).should('have.length.at.least', 1);

    // Set up window.confirm stub to automatically accept confirmations
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });

    // Check if "thingy" page already exists and delete it if it does
    // Use a function that properly handles the async Cypress commands
    cy.get('.ag-row').then(($rows) => {
      // Check if any row contains "thingy"
      const thingyRow = Array.from($rows).find(row =>
        Cypress.$(row).text().includes('thingy')
      );

      if (thingyRow) {
        // Found "thingy", delete it
        cy.wrap(thingyRow).within(() => {
          cy.get('button[title="Delete page"]').should('be.visible').click();
        });

        // Wait for "thingy" to disappear from the table before proceeding
        cy.get('.ag-row', { timeout: 5000 }).should(($allRows) => {
          const hasThingy = Array.from($allRows).some(row =>
            Cypress.$(row).text().includes('thingy')
          );
          expect(hasThingy, 'thingy should be deleted').to.be.false;
        });
      }
    });

    // Click the "+ Add Page" button
    cy.contains('button', '+ Add Page').should('be.visible').click();

    // Wait for the dialog to appear
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Add Page').should('be.visible');

    // Fill in the Title input with "thingy"
    cy.get('[role="dialog"]').within(() => {
      // Find the Title input field by its placeholder
      cy.get('input[placeholder="Home, About, Contact..."]')
        .should('be.visible')
        .clear()
        .type('thingy');

      // Click the Save button
      cy.contains('button', 'Save').should('be.visible').click();
    });

    // Wait for the dialog to close (page should be created)
    cy.get('[role="dialog"]').should('not.exist');

    // Wait for the table to refresh and show the new "thingy" row
    cy.get('.ag-row', { timeout: 5000 }).should(($rows) => {
      const hasThingy = Array.from($rows).some(row =>
        Cypress.$(row).text().includes('thingy')
      );
      expect(hasThingy, 'thingy page should be created').to.be.true;
    });

    // Find the "thingy" row and click the edit button
    cy.get('.ag-row').then(($rows) => {
      // Find the row containing "thingy"
      const thingyRow = Array.from($rows).find(row =>
        Cypress.$(row).text().includes('thingy')
      );

      expect(thingyRow, 'thingy row should exist').to.exist;

      // Click the edit button in that row
      cy.wrap(thingyRow).within(() => {
        cy.get('button[title="Edit page"]').should('be.visible').click();
      });
    });

    // Verify we're navigated to the page builder
    cy.url({ timeout: 10000 }).should('satisfy', (url) => {
      return url.includes('/web-editor/thingy') || url.includes('/admin/webbuilder/edit/thingy');
    });

    // Wait for the web editor to load - look for the top bar with Clear Page button
    cy.contains('button', 'Clear Page', { timeout: 10000 }).should('be.visible');

    // Click the "Clear Page" button at the top
    cy.contains('button', 'Clear Page').should('be.visible').click();

    // Wait for the confirmation modal to appear
    cy.contains('Clear entire page?', { timeout: 5000 }).should('be.visible');

    // Confirm by clicking "Clear Page" button in the modal
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Clear Page').should('be.visible').click();
    });

    // Wait for the modal to close
    cy.contains('Clear entire page?').should('not.exist');

    // Wait a bit for the page to be cleared
    cy.wait(500);

    // Wait for the web editor sidebar to be ready
    cy.get('[data-slot="sidebar"]', { timeout: 10000 }).should('exist');

    // Get the sidebar container and keep mouse over it to keep it expanded
    cy.get('[data-slot="sidebar-container"]', { timeout: 10000 })
      .should('be.visible')
      .then(($sidebar) => {
        // Hover over the sidebar to expand it (sidebar is collapsible="icon" and expands on hover)
        cy.wrap($sidebar).trigger('mouseenter');

        // Wait for sidebar to expand and show section presets
        cy.contains('Sections', { timeout: 5000 }).should('be.visible');

        // Add all sections in order: hero, events, map, paypal, serviceTimes, menu, contactInfo
        const sections = [
          'Hero',
          'Events',
          'Map Section',
          'PayPal (locked layout)',
          'Service Times',
          'Menu',
          'Contact Info'
        ];

        // Keep mouse over sidebar while clicking sections
        sections.forEach((sectionLabel, index) => {
          // Re-hover on sidebar container before each click to keep it expanded
          cy.wrap($sidebar).trigger('mouseenter');

          // Wait a moment for sidebar to expand
          cy.wait(400);

          // Find and click the section button
          // Use a more specific selector that works even if sidebar is animating
          // Look within the sidebar content area for buttons containing the section label
          cy.get('[data-slot="sidebar-content"]')
            .find('button')
            .contains(sectionLabel)
            .should('exist')
            .click({ force: true });

          // Wait a bit for the section to be added before clicking the next one
          if (index < sections.length - 1) {
            cy.wait(500);
          }
        });
      });

    // Click the Publish button
    cy.contains('button', 'Publish', { timeout: 10000 })
      .should('be.visible')
      .click();

    // Wait for the page to publish and check for the green "Live" indicator
    // The Live badge appears when liveVisible && inSyncWithLive is true
    cy.contains('span', 'Live', { timeout: 10000 })
      .should('be.visible')
      .should(($span) => {
        // Check that it has green text color classes (light or dark mode)
        const classes = $span.attr('class') || '';
        expect(
          classes.includes('text-green-600') ||
          classes.includes('dark:text-green-900') ||
          classes.includes('text-green-700')
        ).to.be.true;

        // Check that it has green background classes
        expect(
          classes.includes('bg-green-500/20') ||
          classes.includes('dark:bg-green-400') ||
          classes.includes('bg-green-50')
        ).to.be.true;
      });

    // Navigate to the published "thingy" page to view it
    cy.visit('/thingy');

    // Verify we're on the published page
    cy.url().should('include', '/thingy');

    // Verify all sections are present by checking for elements with IDs containing section types
    // Section IDs are in format: section-content-{timestamp}-{random}-{sectionType}
    // The ID is on a div/component inside a <section> element
    const expectedSections = [
      { type: 'hero', name: 'Hero' },
      { type: 'events', name: 'Events' },
      { type: 'map', name: 'Map' },
      { type: 'paypal', name: 'PayPal' },
      { type: 'service', name: 'Service Times' }, // serviceTimes becomes "service" in ID
      { type: 'menu', name: 'Menu' },
      { type: 'contact', name: 'Contact Info' } // contactInfo becomes "contact" in ID
    ];

    expectedSections.forEach((section) => {
      // Find element with ID starting with "section-content-" and containing the section type
      // The ID format is: section-content-{timestamp}-{random}-{sectionType}
      // Example: section-content-1763868311011-f9jodm-events
      cy.get(`[id^="section-content-"][id*="-${section.type}"]`, { timeout: 5000 })
        .should('exist')
        .should('be.visible');
    });

    // Navigate back to the builder (web editor for thingy)
    cy.visit('/web-editor/thingy');

    // Wait for the web editor to load
    cy.contains('button', 'Clear Page', { timeout: 10000 }).should('be.visible');

    // Click the "Clear Page" button again
    cy.contains('button', 'Clear Page').should('be.visible').click();

    // Wait for the confirmation modal to appear
    cy.contains('Clear entire page?', { timeout: 5000 }).should('be.visible');

    // Confirm by clicking "Clear Page" button in the modal
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Clear Page').should('be.visible').click();
    });

    // Wait for the modal to close
    cy.contains('Clear entire page?').should('not.exist');

    // Navigate back to admin pages
    cy.visit('/admin/webbuilder');

    // Wait for the pages table to load
    cy.get('.ag-theme-quartz', { timeout: 10000 }).should('be.visible');
    cy.get('.ag-row', { timeout: 10000 }).should('have.length.at.least', 1);

    // Find the "thingy" row and delete it
    cy.get('.ag-row').then(($rows) => {
      // Find the row containing "thingy"
      const thingyRow = Array.from($rows).find(row =>
        Cypress.$(row).text().includes('thingy')
      );

      expect(thingyRow, 'thingy row should exist').to.exist;

      // Click the delete button in that row
      cy.wrap(thingyRow).within(() => {
        cy.get('button[title="Delete page"]').should('be.visible').click();
      });
    });

    // Wait for "thingy" to be removed from the table
    cy.get('.ag-row', { timeout: 5000 }).should(($rows) => {
      const hasThingy = Array.from($rows).some(row =>
        Cypress.$(row).text().includes('thingy')
      );
      expect(hasThingy, 'thingy should be deleted').to.be.false;
    });
  });
});

