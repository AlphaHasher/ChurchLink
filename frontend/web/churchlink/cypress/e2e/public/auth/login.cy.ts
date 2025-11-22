const LOGIN_PATH = '/auth/login';
const REDIRECT_AFTER_LOGIN = '/';

// Pull from Cypress env (CYPRESS_USER_EMAIL, etc)
const USER_EMAIL: string = Cypress.env('USER_EMAIL') || 'noadmin@testing.com';
const AUTH_PASSWORD: string | undefined = Cypress.env('AUTH_PASSWORD');

// Fail fast if password is missing, so it’s obvious why tests break
if (!AUTH_PASSWORD) {
    throw new Error(
        'Missing AUTH_PASSWORD. Make sure CYPRESS_AUTH_PASSWORD is set in your environment or cypress.env.json.'
    );
}

describe('Login page', () => {
    beforeEach(() => {
        // Hit login with a redirectTo so we can assert redirect behavior later
        cy.visit(`${LOGIN_PATH}?redirectTo=${encodeURIComponent(REDIRECT_AFTER_LOGIN)}`);
    });

    it('shows an error when logging in with bad credentials', () => {
        // Type known email but wrong password
        cy.get('input[placeholder="Enter email address"]')
            .clear()
            .type(USER_EMAIL);

        cy.get('input[placeholder="Enter password"]')
            .clear()
            .type(`wrong-${AUTH_PASSWORD}`, { log: false });

        cy.contains('button', 'Sign In').click();

        // Error banner (from the <div className="bg-red-50 ..."> in Login.tsx)
        cy.get('.bg-red-50')
            .should('be.visible');

        // Should still be on the login page (no redirect)
        cy.url().should('include', LOGIN_PATH);
    });

    it('allows the user to request a password reset via the "Forgot your password?" flow', () => {
        // Stub timers so we can test the 2s auto-close behavior of the reset modal
        cy.clock();

        // Pre-fill email so the reset modal gets pre-populated (setResetEmail(email))
        cy.get('input[placeholder="Enter email address"]')
            .clear()
            .type(USER_EMAIL);

        cy.contains('button', 'Forgot your password?').click();

        // Modal should be open with the correct title
        cy.contains('Reset Your Password').should('be.visible');

        // Reset email input should be pre-filled from the login form
        cy.get('input[placeholder="Enter your email address"]')
            .should('have.value', USER_EMAIL);

        // Click "Send Reset Email"
        cy.contains('button', 'Send Reset Email').click();

        // Success message from resetEmailSent state
        cy.contains('Password reset email sent! Please check your inbox.')
            .should('be.visible');

        // Button should be disabled after success (disabled={resetLoading || resetEmailSent})
        cy.contains('button', 'Send Reset Email')
            .should('be.disabled');

        // After 2 seconds, the modal should auto-close (setTimeout in handlePasswordReset)
        cy.tick(2000);
        cy.contains('Reset Your Password').should('not.exist');
    });

    it('logs in successfully with valid credentials and redirects to the requested page', () => {
        cy.get('input[placeholder="Enter email address"]')
            .clear()
            .type(USER_EMAIL);

        cy.get('input[placeholder="Enter password"]')
            .clear()
            .type(AUTH_PASSWORD as string, { log: false });

        cy.contains('button', 'Sign In').click();

        // Should land on the page requested in ?redirectTo=
        cy.url().should('include', REDIRECT_AFTER_LOGIN);

        // Login form should be gone
        cy.contains('Sign In').should('not.exist');
    });
});
