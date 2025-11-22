// Helper: pick a clearly-over-13 birthday (01/01/(currentYear - 20))
var getAdultDob = function () {
    var year = new Date().getFullYear() - 20;
    return { mm: '01', dd: '01', yyyy: String(year) };
};
// Helper: pick a clearly-under-13 birthday (01/01/(currentYear - 5))
var getUnderageDob = function () {
    var year = new Date().getFullYear() - 5;
    return { mm: '01', dd: '01', yyyy: String(year) };
};
describe('Profile / Edit Profile', function () {
    beforeEach(function () {
        cy.session('user-login', function () {
            cy.login();
        });
        cy.visit('/profile');
        // Wait for profile to load and edit button to appear
        cy.contains('button', 'Update My Information').should('be.visible');
    });
    var openEditDialog = function () {
        cy.contains('button', 'Update My Information').click();
        cy.get('#self-firstName').should('be.visible');
    };
    var setDob = function (mm, dd, yyyy) {
        cy.get('#self-dob-mm').clear().type(mm);
        cy.get('#self-dob-dd').clear().type(dd);
        cy.get('#self-dob-yyyy').clear().type(yyyy);
    };
    var ensureValidGenderSelected = function () {
        // If the gender trigger already shows Male or Female, we’re fine.
        // If something goes weird, we explicitly pick Female.
        cy.get('#self-gender')
            .then(function ($btn) {
            var txt = $btn.text();
            if (!/Male|Female/i.test(txt)) {
                cy.wrap($btn).click();
                cy.contains('[role="option"]', 'Female').click();
            }
        });
    };
    it('shows an error for invalid first name', function () {
        openEditDialog();
        // First make sure DOB + gender are valid so the only error is the name
        var adult = getAdultDob();
        setDob(adult.mm, adult.dd, adult.yyyy);
        ensureValidGenderSelected();
        // Invalid first name according to backend NAME_RE (e.g. "1234")
        cy.get('#self-firstName').clear().type('1234');
        var alertStub = cy.stub();
        cy.on('window:alert', alertStub);
        cy.contains('button', 'Save changes').click().then(function () {
            expect(alertStub).to.have.been.called;
            var msg = alertStub.getCall(0).args[0];
            expect(msg).to.include('Please enter valid name inputs');
        });
        // Keep dialog open for next test or close if you prefer
        cy.contains('Update information').should('exist');
    });
    it('shows an error when birthday is missing', function () {
        openEditDialog();
        // Valid names so backend focuses on birthday
        cy.get('#self-firstName').clear().type('Cypress');
        cy.get('#self-lastName').clear().type('Tester');
        // Clear DOB completely so it becomes null on the backend
        cy.get('#self-dob-mm').clear();
        cy.get('#self-dob-dd').clear();
        cy.get('#self-dob-yyyy').clear();
        ensureValidGenderSelected();
        var alertStub = cy.stub();
        cy.on('window:alert', alertStub);
        cy.contains('button', 'Save changes').click().then(function () {
            expect(alertStub).to.have.been.called;
            var msg = alertStub.getCall(0).args[0];
            expect(msg).to.include('13 years or older');
        });
    });
    it('shows an error when birthday is under 13 years old', function () {
        openEditDialog();
        cy.get('#self-firstName').clear().type('Cypress');
        cy.get('#self-lastName').clear().type('Tester');
        var underage = getUnderageDob();
        setDob(underage.mm, underage.dd, underage.yyyy);
        ensureValidGenderSelected();
        var alertStub = cy.stub();
        cy.on('window:alert', alertStub);
        cy.contains('button', 'Save changes').click().then(function () {
            expect(alertStub).to.have.been.called;
            var msg = alertStub.getCall(0).args[0];
            expect(msg).to.include('13 years or older');
        });
    });
    // Note: the UI only allows valid genders (Male/Female) to be selected,
    // so we can’t actually hit the “invalid gender” backend branch from here.
    // Instead, we verify that we can change gender and save successfully.
    it('successfully updates name, DOB, and gender with valid inputs', function () {
        openEditDialog();
        var newFirst = 'CypressValid';
        var newLast = 'UserValid';
        var adult = getAdultDob();
        cy.get('#self-firstName').clear().type(newFirst);
        cy.get('#self-lastName').clear().type(newLast);
        setDob(adult.mm, adult.dd, adult.yyyy);
        // Toggle gender explicitly to Female
        cy.get('#self-gender').click();
        cy.contains('[role="option"]', 'Female').click();
        cy.get('#self-gender').should('contain.text', 'Female');
        var alertStub = cy.stub();
        cy.on('window:alert', alertStub);
        cy.contains('button', 'Save changes').click();
        // We expect NO alert for a happy path save
        cy.wrap(alertStub).should('not.have.been.called');
        // Dialog should close
        cy.contains('Update information').should('not.exist');
        // Profile card should reflect the updated name
        // "Account name" row should show "CypressValid UserValid"
        cy.contains('dt', 'Account name')
            .parent()
            .within(function () {
            cy.contains("".concat(newFirst, " ").concat(newLast)).should('be.visible');
        });
        // Gender row should now display localized "Female"
        cy.contains('dt', 'Gender')
            .parent()
            .within(function () {
            cy.contains(/Female/i).should('be.visible');
        });
    });
});
