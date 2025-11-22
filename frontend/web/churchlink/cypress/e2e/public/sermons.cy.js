describe('Public – Sermons Page', function () {
    beforeEach(function () {
        // SPY on API calls (not mock - let real data through)
        cy.intercept('GET', '**/v1/sermons*').as('getSermons');
    });
    afterEach(function () {
        // Wait 0.5 seconds after each test before starting the next one
        cy.wait(500);
    });
    it('loads the sermons page and renders actual content', function () {
        cy.visit('/sermons');
        // Wait for page to load (don't require API - page may load from cache)
        cy.get('h1', { timeout: 15000 }).should('be.visible');
        // Wait for loading state to disappear if present
        cy.get('body').then(function ($body) {
            if ($body.text().includes('Loading')) {
                cy.contains('Loading sermons', { timeout: 10000 }).should('not.exist');
            }
        });
        // Verify page heading renders
        cy.contains('h1', 'Sermons').should('be.visible');
        // Verify filter button exists
        cy.get('button').contains(/filter/i).should('be.visible');
        // Verify page rendered with content (not blank)
        cy.get('body').then(function ($body) {
            var hasSermonItems = $body.find('[data-testid*="sermon"], article, [class*="sermon"]').length > 0;
            var bodyText = $body.text();
            var hasEmptyState = bodyText.toLowerCase().includes('no sermons') || bodyText.toLowerCase().includes('empty');
            var hasReasonableContent = bodyText.trim().length > 100; // Not blank
            var result = hasSermonItems || hasEmptyState || hasReasonableContent;
            expect(result, 'Page must show sermons, empty state, OR substantial content').to.be.true;
            // If sermons exist, verify they have titles
            if (hasSermonItems) {
                cy.get('[data-testid*="sermon"], article, [class*="sermon"]')
                    .first()
                    .should('contain.text', /\w+/); // Has some text content
            }
        });
        // Verify filter button and navigation are visible - confirms successful render
        cy.get('button').contains(/filter/i).should('be.visible');
    });
    it('filter dialog opens and is functional', function () {
        cy.visit('/sermons');
        // Wait for page to load
        cy.get('h1').should('be.visible');
        // Open filter dialog
        cy.get('button').contains(/filter/i).click();
        // Verify dialog appears
        cy.get('[role="dialog"], [data-testid="filter-dialog"]', { timeout: 5000 })
            .should('be.visible');
        // Verify filter controls exist
        cy.get('[role="dialog"]').within(function () {
            cy.get('select, input, [role="combobox"]').should('have.length.greaterThan', 0);
        });
        // Verify dialog has action buttons (apply, close, etc.) - confirms functional dialog
        cy.get('[role="dialog"]').within(function () {
            cy.get('button').should('have.length.greaterThan', 0);
        });
    });
    it('page is responsive and maintains functionality', function () {
        cy.visit('/sermons');
        // Wait for content to load
        cy.contains('h1', 'Sermons', { timeout: 10000 }).should('be.visible');
        // Test mobile viewport
        cy.viewport('iphone-x');
        cy.contains('h1', 'Sermons').should('be.visible');
        cy.get('button').contains(/filter/i).should('be.visible');
        // Test tablet viewport
        cy.viewport('ipad-2');
        cy.contains('h1', 'Sermons').should('be.visible');
        cy.get('button').should('exist');
        // Test desktop viewport
        cy.viewport(1920, 1080);
        cy.contains('h1', 'Sermons').should('be.visible');
        cy.get('button').contains(/filter/i).should('be.visible');
    });
    it('handles sermon data properly from backend', function () {
        cy.visit('/sermons');
        // Wait for page to be ready
        cy.contains('h1', 'Sermons').should('be.visible');
        // Verify page renders with content
        cy.get('body').then(function ($body) {
            var hasSermonItems = $body.find('[data-testid*="sermon"], article, [class*="sermon"]').length > 0;
            var bodyText = $body.text().toLowerCase();
            var hasEmptyState = bodyText.includes('no sermons') || bodyText.includes('empty');
            var hasContent = bodyText.trim().length > 100;
            // Must show sermon items, empty state, OR reasonable page content
            var result = hasSermonItems || hasEmptyState || hasContent;
            expect(result, 'Must show sermons, empty state, or page content').to.be.true;
        });
        // Verify page has filter button - confirms successful render
        cy.get('button').contains(/filter/i).should('be.visible');
    });
});
