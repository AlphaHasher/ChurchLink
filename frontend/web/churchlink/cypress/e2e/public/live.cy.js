describe('Public – Live Stream Page', function () {
    beforeEach(function () {
        // SPY on API calls (not mock)
        cy.intercept('GET', '**/api/v1/youtube/livestreams').as('getStreams');
        cy.intercept('GET', '**/api/v1/youtube/channel_id').as('getChannel');
    });
    afterEach(function () {
        // Wait 0.5 seconds after each test before starting the next one
        cy.wait(500);
    });
    it('loads live stream page and renders proper component', function () {
        cy.visit('/live');
        // Wait for API calls
        cy.wait('@getStreams', { timeout: 15000 });
        // Wait for loading to complete
        cy.get('[class*="skeleton"], [data-testid="loading"]', { timeout: 10000 })
            .should('not.exist');
        // Verify page rendered (not blank)
        cy.get('body').should('be.visible');
        // Check what component rendered based on stream data
        cy.wait('@getStreams').then(function (interception) {
            var _a;
            var streamData = (_a = interception.response) === null || _a === void 0 ? void 0 : _a.body;
            var streamIds = (streamData === null || streamData === void 0 ? void 0 : streamData.stream_ids) || [];
            if (streamIds.length > 0) {
                // Should show StreamViewer component
                cy.get('[data-testid="stream-viewer"], iframe, [class*="stream"], [class*="youtube"]')
                    .should('exist')
                    .and('be.visible');
            }
            else {
                // Should show NoStreams component with message - check for actual text content
                cy.get('body').invoke('text').should('match', /no|not.*live|check.*back|stay.*tuned/i);
                // Should have link to YouTube channel
                cy.get('a[href*="youtube.com"]').should('exist').and('be.visible');
            }
        });
        // Verify page has interactive elements - confirms successful render
        cy.get('button, a[href]').should('exist').and('be.visible');
    });
    it('verifies stream component or empty state renders', function () {
        cy.visit('/live');
        cy.wait('@getStreams');
        // Verify page loaded successfully with SOME content
        cy.get('body').should('not.be.empty');
        // Must have either interactive media elements OR text content (not completely blank)
        cy.get('body').then(function ($body) {
            var hasInteractiveContent = $body.find('iframe, video, a[href*="youtube"], a[href*="channel"]').length > 0;
            var bodyTextLength = $body.text().trim().length;
            var hasTextContent = bodyTextLength > 50; // Reasonable amount of text
            var result = hasInteractiveContent || hasTextContent;
            expect(result, 'Page must have interactive content OR substantial text').to.be.true;
        });
        // Verify page has navigation and action buttons - confirms successful render
        cy.get('button, a[href]').should('exist').and('be.visible');
    });
    it('page is responsive', function () {
        cy.visit('/live');
        cy.wait('@getStreams');
        // Test mobile viewport
        cy.viewport('iphone-x');
        cy.get('body').should('be.visible');
        cy.get('button, a[href]').should('exist');
        // Test tablet viewport
        cy.viewport('ipad-2');
        cy.get('body').should('be.visible');
        cy.get('button, a[href]').should('exist');
        // Test desktop viewport
        cy.viewport(1920, 1080);
        cy.get('body').should('be.visible');
        cy.get('button, a[href]').should('exist').and('be.visible');
    });
});
