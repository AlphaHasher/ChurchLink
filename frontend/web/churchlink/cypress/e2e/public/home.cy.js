describe('Public – Home Page', function () {
    beforeEach(function () {
        // SPY on API calls
        cy.intercept('GET', '**/api/v1/pages/slug/*').as('getPage');
        cy.intercept('GET', '**/api/v1/header').as('getHeader');
    });
    afterEach(function () {
        // Wait 0.5 seconds after each test before starting the next one
        cy.wait(500);
    });
    it('loads home page and renders content or construction message', function () {
        cy.visit('/');
        // Wait for page data
        cy.wait('@getPage', { timeout: 15000 });
        // Wait for page to fully render
        cy.get('body', { timeout: 10000 }).should('be.visible');
        // Page should show EITHER dynamic content OR construction message
        cy.get('body').then(function ($body) {
            var hasNavigation = $body.find('[role="navigation"], nav, header').length > 0;
            var hasSections = $body.find('section, [data-testid*="section"], [class*="section"]').length > 0;
            var hasHeadings = $body.find('h1, h2, h3').length > 0;
            var hasConstruction = $body.text().includes('construction') || $body.text().includes('coming soon');
            expect(hasNavigation || hasSections || hasHeadings || hasConstruction, 'Page must show navigation, sections, headings, OR construction message').to.be.true;
        });
        // Verify interactive elements (buttons/links) are present - confirms page rendered successfully
        cy.get('button, a[role="button"], a[href]').should('exist').and('be.visible');
    });
    it('verifies navigation is present', function () {
        cy.visit('/');
        cy.wait('@getHeader');
        // Navigation should exist
        cy.get('[role="navigation"], nav, header').should('exist');
        // Verify navigation has links/buttons - confirms functional nav
        cy.get('[role="navigation"], nav, header').within(function () {
            cy.get('a, button').should('have.length.greaterThan', 0);
        });
    });
    it('handles page data from backend properly', function () {
        cy.visit('/');
        cy.wait('@getPage').then(function (interception) {
            var _a;
            var pageData = (_a = interception.response) === null || _a === void 0 ? void 0 : _a.body;
            if ((pageData === null || pageData === void 0 ? void 0 : pageData.visible) === false) {
                // Should show construction or not available
                cy.get('body').should('contain.text', /construction|coming soon|not available/i);
            }
            else if ((pageData === null || pageData === void 0 ? void 0 : pageData.sections) && pageData.sections.length > 0) {
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
    it('page is responsive', function () {
        cy.visit('/');
        cy.wait('@getPage');
        // Mobile
        cy.viewport('iphone-x');
        cy.get('body').should('be.visible');
        cy.get('button, a[href]').should('exist');
        // Tablet
        cy.viewport('ipad-2');
        cy.get('body').should('be.visible');
        cy.get('button, a[href]').should('exist');
        // Desktop
        cy.viewport(1920, 1080);
        cy.get('body').should('be.visible');
        cy.get('button, a[href]').should('exist').and('be.visible');
    });
});
