// cypress/e2e/admin/webbuilder_with_page_fixture.cy.ts
describe('Web Builder parity using page.json mock', function () {
    beforeEach(function () {
        cy.loginWithBearer();
        cy.readFile('cypress/assets/page.json').then(function (page) {
            var _a;
            var slug = encodeURIComponent(page.slug || 'thingy');
            // Allow admin routes to render by granting permissions
            cy.intercept('GET', '**/api/v1/users/permissions', {
                statusCode: 200,
                body: {
                    success: true,
                    permissions: {
                        admin: true,
                        permissions_management: true,
                        web_builder_management: true,
                        mobile_ui_management: true,
                        event_editing: true,
                        media_management: true,
                        sermon_editing: true,
                        bulletin_editing: true,
                        finance: true,
                        ministries_management: true,
                        forms_management: true,
                        bible_plan_management: true,
                        notification_management: true,
                    },
                },
            }).as('getPermissions');
            // No staging → force preview path
            // For public preview (?staging=1) we should return the staging page
            cy.intercept('GET', "**/api/v1/pages/staging/".concat(slug), { statusCode: 200, body: page }).as('getStaging');
            // Preview and live both return the same full page JSON
            cy.intercept('GET', "**/api/v1/pages/preview/".concat(slug), { statusCode: 200, body: page }).as('getPreview');
            cy.intercept('GET', "**/api/v1/pages/slug/".concat(slug), { statusCode: 200, body: page }).as('getLive');
            // Save/publish (builder autosave + publish button)
            cy.intercept('PUT', "**/api/v1/pages/staging/".concat(slug), {
                statusCode: 200,
                body: { upserted: false, modified: 1 },
            }).as('saveStaging');
            cy.intercept('POST', "**/api/v1/pages/publish/".concat(slug), {
                statusCode: 200,
                body: { published: true },
            }).as('publish');
            // Admin list (so /admin/webbuilder can render)
            cy.intercept('GET', "**/api/v1/pages/", {
                statusCode: 200,
                body: [
                    {
                        _id: ((_a = page._id) === null || _a === void 0 ? void 0 : _a.$oid) || 'fixture-id',
                        title: page.title,
                        slug: page.slug,
                        visible: page.visible !== false,
                        locked: false,
                    },
                ],
            }).as('getPages');
            // Minimal header/footer (editor may fetch these)
            cy.intercept('GET', '**/api/v1/header/items', { statusCode: 200, body: { items: [] } });
            cy.intercept('GET', '**/api/v1/footer/items', { statusCode: 200, body: { items: [] } });
        });
    });
    it('preview renders key content from page.json', function () {
        cy.readFile('cypress/assets/page.json').then(function (page) {
            // Public preview URL uses ?staging=1
            cy.visit("/".concat(page.slug, "?staging=1"));
            cy.assertNoClientErrors();
            // Simple string presence checks
            cy.contains('WELCOME HOME').scrollIntoView().should('be.visible');
            cy.contains('A Place to Gather, Grow, and Go.').scrollIntoView().should('be.visible');
            cy.contains("We'd love to see you this Sunday!").scrollIntoView().should('be.visible');
            cy.contains('Explore').scrollIntoView().should('be.visible');
            cy.contains('Our Location').scrollIntoView().should('be.visible');
            cy.contains('Give Online').scrollIntoView().should('be.visible');
            cy.contains('hello@yourchurch.org').scrollIntoView().should('be.visible');
            cy.contains(/^Plan Your Visit$/).scrollIntoView().should('exist');
            cy.contains(/Get Directions/i).scrollIntoView().should('exist');
        });
    });
    it('builder renders the same key content', function () {
        cy.readFile('cypress/assets/page.json').then(function (page) {
            cy.visit("/web-editor/".concat(page.slug));
            cy.assertNoClientErrors();
            // Simple string presence checks
            cy.contains('WELCOME HOME').scrollIntoView().should('be.visible');
            cy.contains('A Place to Gather, Grow, and Go.').scrollIntoView().should('be.visible');
            cy.contains("We'd love to see you this Sunday!").scrollIntoView().should('be.visible');
            cy.contains('Explore').scrollIntoView().should('be.visible');
            cy.contains('Our Location').scrollIntoView().should('be.visible');
            cy.contains('Give Online').scrollIntoView().should('be.visible');
            cy.contains('hello@yourchurch.org').scrollIntoView().should('be.visible');
            cy.contains(/^Plan Your Visit$/).scrollIntoView().should('exist');
            cy.contains(/Get Directions/i).scrollIntoView().should('exist');
        });
    });
});
