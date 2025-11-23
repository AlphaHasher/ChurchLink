describe('Admin Login for Forms', () => {
  it('logs in as admin using adminlogin command and navigates to admin dashboard and forms page', () => {
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
    
    // Click on "Manage Forms" under "Forms" in the sidebar
    // Forms should be expanded by default, so we can click Manage Forms directly
    // Find the sidebar content using data-testid
    cy.get('[data-testid="admin-dashboard-sidebar-content"]', { timeout: 5000 }).within(() => {
      cy.contains('a', 'Manage Forms').scrollIntoView();
      cy.contains('a', 'Manage Forms').should('be.visible');
      cy.contains('a', 'Manage Forms').click();
    });
    
    // Verify we're on the Forms page
    cy.url().should('include', '/admin/forms/manage-forms');
    
    // Wait for the AG Grid table to be visible and loaded
    cy.get('.ag-theme-quartz', { timeout: 10000 }).should('be.visible');
    
    // Wait for at least one row to be present (table is loaded)
    cy.get('.ag-row', { timeout: 10000 }).should('have.length.at.least', 0);
    
    // Click the "New Form" button - break up the chain to avoid detachment issues
    cy.contains('button', 'New Form', { timeout: 10000 }).should('be.visible');
    cy.contains('button', 'New Form').click();
    
    // Wait for navigation to complete before verifying
    cy.url({ timeout: 10000 }).should('satisfy', (url) => {
      return url.includes('/admin/forms/form-builder') && url.includes('new=1');
    });
    
    // Wait for the form builder to load - look for Palette or Canvas instead of "Forms" text
    cy.contains('Palette', { timeout: 10000 }).should('be.visible');
    
    // Click all buttons in the Palette to add all form elements
    // Order matches Palette.tsx exactly: Static Text, Text, Textarea, Checkbox, Phone, Email, URL, Date, Number, Select, Radio, Switch, Time, Price (for label)
    const paletteFieldTypes = [
      'Static Text',
      'Text',
      'Textarea',
      'Checkbox',
      'Phone',
      'Email',
      'URL',
      'Date',
      'Number',
      'Select',
      'Radio',
      'Switch',
      'Time',
      'Price (for label purpose)'
    ];
    
    // Click each field type button in the Palette
    // Scroll buttons into view to avoid overflow clipping issues
    paletteFieldTypes.forEach((fieldType) => {
      // Find the button by exact text match to avoid partial matches (e.g., "Text" matching "Static Text")
      cy.get('button').then(($buttons) => {
        // Filter to exact text match
        const exactMatch = Array.from($buttons).find(btn => {
          return Cypress.$(btn).text().trim() === fieldType;
        });
        expect(exactMatch, `Button with exact text "${fieldType}" should exist`).to.exist;
        cy.wrap(exactMatch).scrollIntoView().should('be.visible').click();
      });
      // Wait a bit between clicks to allow the form to update
    });
    
    // Wait for fields to be added to Canvas - use data-testid
    cy.get('[data-testid="form-canvas"]', { timeout: 10000 }).should('exist');
    cy.get('[data-testid^="field-item-static-"]', { timeout: 10000 }).should('exist');
    
    // Edit the first field (Static Text) - use data-testid
    // Scroll into view to handle overflow clipping
    cy.get('[data-testid="edit-field-static-0"]', { timeout: 5000 })
      .scrollIntoView()
      .should('exist')
      .click({ force: true });
    
    // Wait for the side sheet (Edit Field dialog) to open
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    
    // Fill in "Test Form" in the text content field - use data-testid
    cy.get('[data-testid="static-text-content-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('Test Form');
    
    // Pick a random color using the color input - use data-testid
    // Generate a random hex color
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    cy.get('[data-testid="static-text-color-input"]', { timeout: 5000 })
      .should('be.visible')
      .then(($input) => {
        // For color inputs, we need to set the value property directly and trigger events
        const input = $input[0] as HTMLInputElement;
        input.value = randomColor;
        // Trigger both input and change events to ensure React picks it up
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    
    // Click Bold button (B) - use data-testid
    cy.get('[data-testid="static-text-bold-button"]', { timeout: 5000 })
      .should('be.visible')
      .click();
    
    // Click Underline button (U) - use data-testid
    cy.get('[data-testid="static-text-underline-button"]', { timeout: 5000 })
      .should('be.visible')
      .click();
    
    
    // Close the edit sheet by clicking the close button
    cy.get('[data-testid="sheet-close-button"]', { timeout: 5000 })
      .should('be.visible')
      .click();
    
    // Wait for sheet to close
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    
    // Edit the second field (Text Field) - use data-testid
    cy.get('[data-testid="edit-field-text-1"]', { timeout: 5000 })
      .scrollIntoView()
      .should('exist')
      .click({ force: true });
    
    // Wait for the side sheet (Edit Field dialog) to open
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    
    // Fill in label "Email" - use data-testid
    cy.get('[data-testid="field-label-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('Email');
    
    // Fill in placeholder "Enter your email" - use data-testid
    cy.get('[data-testid="field-placeholder-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('Enter your email');
    
    // Add email regex pattern - use data-testid
    // Use a simpler email regex pattern to avoid escaping issues
    // Pattern: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
    const emailRegex = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
    cy.get('[data-testid="field-pattern-input"]', { timeout: 5000 })
      .should('be.visible')
      .invoke('val', emailRegex)
      .trigger('input')
      .trigger('change');
    
    // Wait a bit for changes to be applied
    cy.wait(100);
    
    // Close the edit sheet
    cy.get('[data-testid="sheet-close-button"]', { timeout: 5000 })
      .should('be.visible')
      .click();
    
    // Wait for sheet to close
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    
    // Edit the third field (Textarea) - use data-testid
    cy.get('[data-testid="edit-field-textarea-2"]', { timeout: 5000 })
      .scrollIntoView()
      .should('exist')
      .click({ force: true });
    
    // Wait for the side sheet (Edit Field dialog) to open
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    
    // Fill in label "Comments" - use data-testid
    cy.get('[data-testid="field-label-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('Comments');
    
    // Fill in placeholder "Enter your comments here" - use data-testid
    cy.get('[data-testid="field-placeholder-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('Enter your comments here');
    
    // Set min length to 10 - use data-testid
    cy.get('[data-testid="field-min-length-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('10');
    
    // Set max length to 500 - use data-testid
    cy.get('[data-testid="field-max-length-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('500');
    
    // Wait a bit for changes to be applied
    cy.wait(100);
    
    // Close the edit sheet
    cy.get('[data-testid="sheet-close-button"]', { timeout: 5000 })
      .should('be.visible')
      .click();
    
    // Wait for sheet to close
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    
    // Edit the fourth field (Checkbox) - use data-testid
    cy.get('[data-testid="edit-field-checkbox-3"]', { timeout: 5000 })
      .scrollIntoView()
      .should('exist')
      .click({ force: true });
    
    // Wait for the side sheet (Edit Field dialog) to open
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    
    // Fill in label "Subscribe to Newsletter" - use data-testid
    cy.get('[data-testid="field-label-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('Subscribe to Newsletter');
    
    // Set price when selected to 5.00 - use data-testid
    cy.get('[data-testid="field-price-when-selected-input"]', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type('5.00');
    
    cy.wait(100);
    
    // Close and edit Phone field (index 4)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-tel-4"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Phone Number');
    cy.get('[data-testid="field-placeholder-input"]').clear().type('Enter your phone number');
    cy.wait(100);
    
    // Close and edit URL field (index 6) - skip Email (index 5) as it's already done
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-url-6"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Website URL');
    cy.get('[data-testid="field-placeholder-input"]').clear().type('https://example.com');
    cy.wait(100);
    
    // Close and edit Date field (index 7)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-date-7"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Event Date');
    cy.get('[data-testid="field-date-min-input"]').invoke('val', '2040-01-01').trigger('input').trigger('change');
    cy.get('[data-testid="field-date-max-input"]').invoke('val', '2040-12-31').trigger('input').trigger('change');
    cy.wait(100);
    
    // Close and edit Number field (index 8)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-number-8"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Age');
    cy.get('[data-testid="field-placeholder-input"]').clear().type('Enter your age');
    cy.get('[data-testid="field-number-min-input"]').clear().type('18');
    cy.get('[data-testid="field-number-max-input"]').clear().type('100');
    cy.wait(100);
    
    // Close and edit Select field (index 9)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-select-9"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Select Option');
    // Add options
    cy.contains('button', 'Add option', { timeout: 5000 }).click();
    cy.wait(200);
    cy.contains('button', 'Add option').click();
    cy.wait(200);
    // Edit the first option
    cy.get('table').within(() => {
      cy.get('input[placeholder="Label"]').first().clear().type('Option 1');
      cy.get('input[placeholder="Value"]').first().clear().type('opt1');
      cy.get('input[placeholder="Label"]').eq(1).clear().type('Option 2');
      cy.get('input[placeholder="Value"]').eq(1).clear().type('opt2');
    });
    cy.wait(100);
    
    // Close and edit Radio field (index 10)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-radio-10"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Choose One');
    // Add options
    cy.contains('button', 'Add option', { timeout: 5000 }).click();
    cy.wait(200);
    cy.contains('button', 'Add option').click();
    cy.wait(200);
    cy.get('table').within(() => {
      cy.get('input[placeholder="Label"]').first().clear().type('Yes');
      cy.get('input[placeholder="Value"]').first().clear().type('yes');
      cy.get('input[placeholder="Label"]').eq(1).clear().type('No');
      cy.get('input[placeholder="Value"]').eq(1).clear().type('no');
    });
    cy.wait(100);
    
    // Close and edit Switch field (index 11)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-switch-11"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Enable Notifications');
    cy.get('[data-testid="field-price-when-selected-input"]').clear().type('2.50');
    cy.get('[data-testid="field-switch-on-text-input"]').clear().type('Enabled');
    cy.get('[data-testid="field-switch-off-text-input"]').clear().type('Disabled');
    cy.wait(100);
    
    // Close and edit Time field (index 12)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-time-12"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-label-input"]').clear().type('Preferred Time');
    cy.get('[data-testid="field-time-min-input"]').invoke('val', '09:00').trigger('input').trigger('change');
    cy.get('[data-testid="field-time-max-input"]').invoke('val', '17:00').trigger('input').trigger('change');
    cy.wait(100);
    
    // Close and edit Price Label field (index 13)
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-pricelabel-13"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="field-pricelabel-amount-input"]').clear().type('25.00');
    cy.wait(100);
    
    // Close and edit Payment Method field (index 14) - uncheck PayPal
    cy.get('[data-testid="sheet-close-button"]').click();
    cy.get('[data-testid="edit-field-sheet"]').should('not.exist');
    cy.wait(100);
    cy.get('[data-testid="edit-field-price-14"]').scrollIntoView().should('exist').click({ force: true });
    cy.get('[data-testid="edit-field-sheet"]', { timeout: 5000 }).should('be.visible');
    // Uncheck Allow PayPal Payment
    cy.get('[data-testid="payment-method-allow-paypal-checkbox"]', { timeout: 5000 })
      .should('be.visible')
      .uncheck();
    cy.wait(100);
  });
});

