var PROFILE_PATH = '/profile';
var FAMILY_HEADING = 'Family Members';
/**
 * Wait until any modal scroll lock is released.
 * This guards against body[data-scroll-locked][style*="pointer-events: none"].
 */
function waitForScrollUnlock() {
    cy.get('body').should(function ($body) {
        var pe = $body.css('pointer-events');
        expect(pe, 'body pointer-events not locked').to.not.eq('none');
    });
}
/**
 * Open the "Add Family Member" dialog and ensure inputs are visible.
 */
function openAddFamilyMemberDialog() {
    cy.contains('button', 'Add Family Member').click();
    cy.get('#create-firstName').should('be.visible');
}
/**
 * Robustly select a gender from the shadcn Select.
 * We scope the click to the SelectContent (class z-600 max-h-60).
 */
function selectGenderInOpenSelect(label) {
    cy.get('.z-600.max-h-60,[class*="z-600"]').within(function () {
        cy.contains('div,button,[role="option"]', label).click();
    });
}
/**
 * Fills the AddPersonDialog form and creates a family member.
 * Returns the full name used, so callers can locate the tile.
 */
function createFamilyMemberViaUI(options) {
    var _a, _b, _c, _d, _e, _f;
    var now = Date.now();
    var firstName = (_a = options === null || options === void 0 ? void 0 : options.firstName) !== null && _a !== void 0 ? _a : "CypressFM".concat(now);
    var lastName = (_b = options === null || options === void 0 ? void 0 : options.lastName) !== null && _b !== void 0 ? _b : 'User';
    var mm = (_c = options === null || options === void 0 ? void 0 : options.mm) !== null && _c !== void 0 ? _c : '03';
    var dd = (_d = options === null || options === void 0 ? void 0 : options.dd) !== null && _d !== void 0 ? _d : '15';
    var yyyy = (_e = options === null || options === void 0 ? void 0 : options.yyyy) !== null && _e !== void 0 ? _e : '2010';
    var gender = (_f = options === null || options === void 0 ? void 0 : options.gender) !== null && _f !== void 0 ? _f : 'Male';
    var fullName = "".concat(firstName, " ").concat(lastName);
    openAddFamilyMemberDialog();
    // Name fields (PersonInfoInput with idPrefix="create")
    cy.get('#create-firstName').clear().type(firstName);
    cy.get('#create-lastName').clear().type(lastName);
    // DOB fields
    cy.get('#create-dob-mm').clear().type(mm);
    cy.get('#create-dob-dd').clear().type(dd);
    cy.get('#create-dob-yyyy').clear().type(yyyy);
    // Gender select (#create-gender trigger + SelectContent)
    cy.get('#create-gender').click();
    selectGenderInOpenSelect(gender);
    // Assert the trigger now shows the selected gender text
    cy.get('#create-gender').should('contain.text', gender);
    // Create button (disabled until isValid is true in AddPersonDialog)
    cy.contains('button', 'Create').should('not.be.disabled').click();
    // Dialog should close; inputs disappear, and scroll lock released
    cy.get('#create-firstName').should('not.exist');
    cy.get('[role="dialog"]').should('not.exist');
    waitForScrollUnlock();
    // New PersonTile should appear with the name we just used
    cy.contains('li', fullName, { timeout: 10000 }).should('exist');
    return fullName;
}
describe('Profile / Family Members', function () {
    beforeEach(function () {
        // Cache login session once, then just restore it per test
        cy.session('user-login', function () {
            cy.login(); // custom command from commands.js
        });
        cy.visit(PROFILE_PATH);
        // Make sure the PersonRail card is visible
        cy.contains('h3', FAMILY_HEADING).should('be.visible');
    });
    it('1) validates and creates a new family member', function () {
        openAddFamilyMemberDialog();
        // Initially, Create should be disabled because form is empty
        cy.contains('button', 'Create').should('be.disabled');
        // Fill only first + last name -> still disabled (DOB + gender required)
        cy.get('#create-firstName').type('Alpha');
        cy.get('#create-lastName').type('Tester');
        cy.contains('button', 'Create').should('be.disabled');
        // Fill a valid DOB
        cy.get('#create-dob-mm').type('02');
        cy.get('#create-dob-dd').type('10');
        cy.get('#create-dob-yyyy').type('2011');
        // Still missing gender -> disabled
        cy.contains('button', 'Create').should('be.disabled');
        // Select gender via robust helper
        cy.get('#create-gender').click();
        selectGenderInOpenSelect('Male');
        cy.get('#create-gender').should('contain.text', 'Male');
        // Now the form is valid
        cy.contains('button', 'Create').should('not.be.disabled').click();
        // Dialog closes and scroll lock is removed
        cy.get('#create-firstName').should('not.exist');
        cy.get('[role="dialog"]').should('not.exist');
        waitForScrollUnlock();
        // And the new tile appears with name + DOB + gender text
        cy.contains('li', 'Alpha Tester', { timeout: 10000 })
            .should('exist')
            .within(function () {
            cy.contains('Date of Birth').should('contain.text', '02/10/2011');
            cy.contains('Gender').should('contain.text', 'Male');
        });
    });
    it('2) edits an existing family member (name + gender)', function () {
        // Create a member to edit in this test
        var originalName = createFamilyMemberViaUI({
            firstName: 'EditMe',
            lastName: 'Original',
            mm: '04',
            dd: '20',
            yyyy: '2012',
            gender: 'Male',
        });
        var updatedFirst = 'Edited';
        var updatedLast = 'Person';
        var updatedFullName = "".concat(updatedFirst, " ").concat(updatedLast);
        // Open the Edit dialog for that specific tile
        cy.contains('li', originalName)
            .should('exist')
            .within(function () {
            cy.get('button[title="Edit person"]').click();
        });
        // In the edit dialog, PersonInfoInput uses idPrefix="edit-<id>".
        // We just target the visible first/last name inputs.
        cy.get('input[id$="-firstName"]:visible')
            .clear()
            .type(updatedFirst);
        cy.get('input[id$="-lastName"]:visible')
            .clear()
            .type(updatedLast);
        // Flip gender to Female using the visible gender trigger
        cy.get('button[id$="-gender"]:visible').click();
        selectGenderInOpenSelect('Female');
        cy.get('button[id$="-gender"]:visible').should('contain.text', 'Female');
        // Save changes (EditPersonDialog "Save changes" button)
        cy.contains('button', 'Save changes').click();
        // Wait for dialog and scroll lock to go away
        cy.contains('button', 'Save changes').should('not.exist');
        cy.get('[role="dialog"]').should('not.exist');
        waitForScrollUnlock();
        // And the tile should show the updated name and gender text
        cy.contains('li', updatedFullName, { timeout: 10000 })
            .should('exist')
            .within(function () {
            cy.contains('Gender').should('contain.text', 'Female');
        });
    });
    it('3) deletes a family member with full-name confirmation', function () {
        // Create a member to delete in this test
        var fullName = createFamilyMemberViaUI({
            firstName: 'DeleteMe',
            lastName: 'Now',
            mm: '05',
            dd: '25',
            yyyy: '2013',
            gender: 'Female',
        });
        // Open delete dialog for that member
        cy.contains('li', fullName)
            .should('exist')
            .within(function () {
            cy.get('button[title="Delete person"]').click();
        });
        // Delete dialog should show the confirmation input and disabled "Confirm Delete"
        cy.get('#confirm-delete').should('be.visible').and('have.value', '');
        cy.contains('button', 'Confirm Delete').should('be.disabled');
        // Typing an incorrect name keeps it disabled
        cy.get('#confirm-delete').type(fullName.slice(0, -1));
        cy.contains('button', 'Confirm Delete').should('be.disabled');
        // Typing the exact full name enables deletion
        cy.get('#confirm-delete').clear().type(fullName);
        cy.contains('button', 'Confirm Delete').should('not.be.disabled').click();
        // Dialog closes; scroll lock removed
        cy.contains('button', 'Confirm Delete').should('not.exist');
        cy.get('[role="dialog"]').should('not.exist');
        waitForScrollUnlock();
        // The tile should be gone from the PersonRail list
        cy.contains('li', fullName).should('not.exist');
    });
});
