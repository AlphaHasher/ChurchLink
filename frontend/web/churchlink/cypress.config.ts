import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: true,
    retries: { runMode: 2, openMode: 0 }, // mild flake control
    screenshotOnRunFailure: true,
    viewportWidth: 1280, // Set viewport to "lg" breakpoint for Tailwind (1024px+)
    viewportHeight: 720,
    testIsolation: true,
    env: {
      API_URL: 'http://localhost:8000',
      E2E_TEST_MODE: 'true',
      ADMIN_UID: 'test-admin-uid-e2e',
      USER_UID: 'test-user-uid-e2e'
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here
      return config;
    },
  },
});


