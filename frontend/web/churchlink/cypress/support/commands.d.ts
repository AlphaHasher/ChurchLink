/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Spy on console.error before the app loads.
     */
    prepareConsoleErrorSpy(): Chainable<any>;

    /**
     * Mark app as running in E2E test mode (localStorage flag etc).
     */
    loginWithBearer(): Chainable<any>;

    /**
     * Assert that no console errors or Vite error overlay were shown.
     */
    assertNoClientErrors(): Chainable<any>;

    /**
     * Clears all auth state and lands on /auth/login.
     */
    logout(): Chainable<any>;

    /**
     * Logs in with the standard user credentials:
     * USER_EMAIL + AUTH_PASSWORD from Cypress.env.
     */
    login(): Chainable<any>;

    /**
     * Logs in with the admin credentials:
     * ADMIN_EMAIL + AUTH_PASSWORD from Cypress.env.
     */
    adminlogin(): Chainable<any>;

    /**
     * Creates three test ministries:
     * "Youth Ministry", "Bible Studies", and "Community Outreach".
     */
    createTestMinistries(): Chainable<any>;

    /**
     * Deletes the test ministries created by createTestMinistries(),
     * if they exist.
     */
    deleteTestMinistries(): Chainable<any>;

    /**
     * Uploads test images (wolf.jpg, octopus.avif, orangutan.jpg)
     * into the root of the media library.
     */
    createTestImages(): Chainable<any>;

    /**
     * Deletes the test images created by createTestImages(),
     * if they exist.
     */
    deleteTestImages(): Chainable<any>;
  }
}
