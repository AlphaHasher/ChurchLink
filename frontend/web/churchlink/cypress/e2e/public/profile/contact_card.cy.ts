const CONTACT_CARD_HEADING = 'Contact Information';

const openEditDialog = () => {
    cy.contains('button', 'Update Contact Info').click();
    cy.get('#contact-phone').should('be.visible');
};

const captureContactSnapshot = () => {
    const snapshot: { phone?: string; addressLine1?: string } = {};

    cy.contains('dt', 'Phone')
        .parent()
        .within(() => {
            cy.get('dd')
                .invoke('text')
                .then((text) => {
                    snapshot.phone = text.trim();
                });
        });

    cy.contains('dt', 'Address')
        .parent()
        .within(() => {
            cy.get('dd')
                .invoke('text')
                .then((text) => {
                    snapshot.addressLine1 = text.trim();
                });
        });

    return cy.wrap(snapshot);
};

describe('Profile / Contact Info', () => {
    beforeEach(() => {
        // Cache the login session so we don’t fully log in before every single test
        cy.session('user-login', () => {
            cy.login();
        });

        cy.visit('/profile');

        // Make sure the Contact Information card is present
        cy.contains('h2', CONTACT_CARD_HEADING).should('be.visible');
    });

    it('shows an error and does not change the card when phone is invalid', () => {
        // Capture current values from the ContactCard
        captureContactSnapshot().then((initial) => {
            openEditDialog();

            // Clearly invalid phone
            cy.get('#contact-phone').clear().type('12345');

            // Keep address fields valid / simple
            cy.get('#addr-line1').clear().type('123 Bad Phone St');
            cy.get('#addr-city').clear().type('Testville');
            cy.get('#addr-state').clear().type('TS');
            cy.get('#addr-country').clear().type('US');
            cy.get('#addr-postal').clear().type('99999');

            cy.contains('button', 'Save changes').click();

            // The dialog shows error text via error state and role="alert"
            cy.get('[role="alert"]')
                .should('be.visible')
                .and('contain.text', 'valid phone');

            // Contact card should still show the original phone and address line 1
            cy.contains('dt', 'Phone')
                .parent()
                .within(() => {
                    cy.get('dd')
                        .invoke('text')
                        .then((text) => {
                            expect(text.trim()).to.eq(initial.phone);
                        });
                });

            cy.contains('dt', 'Address')
                .parent()
                .within(() => {
                    cy.get('dd')
                        .invoke('text')
                        .then((text) => {
                            expect(text.trim()).to.eq(initial.addressLine1);
                        });
                });
        });
    });

    it('successfully updates phone and address with valid values', () => {
        openEditDialog();

        const validPhoneInput = '+1 (555) 111-2222';
        const newAddressLine1 = '123 Cypress Way';
        const newSuite = 'Suite 42';
        const newCity = 'Specville';
        const newState = 'SP';
        const newCountry = 'United States';
        const newPostal = '42424';

        cy.get('#contact-phone').clear().type(validPhoneInput);
        cy.get('#addr-line1').clear().type(newAddressLine1);
        cy.get('#addr-suite').clear().type(newSuite);
        cy.get('#addr-city').clear().type(newCity);
        cy.get('#addr-state').clear().type(newState);
        cy.get('#addr-country').clear().type(newCountry);
        cy.get('#addr-postal').clear().type(newPostal);

        // Clear any previous error
        cy.get('[role="alert"]').should('not.exist');

        cy.contains('button', 'Save changes').click();

        // On success, the dialog closes and no error is shown
        cy.get('[role="alert"]').should('not.exist');
        cy.contains('button', 'Update Contact Info').should('be.visible');

        // Phone row should now show the new phone (backend may strip spaces, so assert loosely)
        cy.contains('dt', 'Phone')
            .parent()
            .within(() => {
                cy.get('dd')
                    .invoke('text')
                    .then((text) => {
                        const trimmed = text.replace(/\s+/g, '');
                        expect(trimmed).to.include('555');
                        expect(trimmed).to.include('111');
                    });
            });

        // Address rows should reflect the new address
        cy.contains('dt', 'Address')
            .parent()
            .within(() => {
                cy.get('dd').should('contain.text', newAddressLine1);
            });

        cy.contains('dt', 'City / State')
            .parent()
            .within(() => {
                cy.get('dd')
                    .should('contain.text', newCity)
                    .and('contain.text', newState);
            });

        cy.contains('dt', 'Country / Postal')
            .parent()
            .within(() => {
                cy.get('dd')
                    .should('contain.text', newCountry)
                    .and('contain.text', newPostal);
            });
    });

    it('allows clearing the phone number and shows "—" in the card', () => {
        openEditDialog();

        // Clear phone entirely, keep address as-is
        cy.get('#contact-phone').clear();

        cy.contains('button', 'Save changes').click();

        // No error, dialog closes
        cy.get('[role="alert"]').should('not.exist');
        cy.contains('button', 'Update Contact Info').should('be.visible');

        // ContactCard uses "—" as the fallback when phone is null/empty
        cy.contains('dt', 'Phone')
            .parent()
            .within(() => {
                cy.get('dd')
                    .invoke('text')
                    .then((text) => {
                        const trimmed = text.trim();
                        expect(trimmed).to.eq('—');
                    });
            });
    });
});
