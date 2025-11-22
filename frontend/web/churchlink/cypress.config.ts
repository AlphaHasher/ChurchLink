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
    env: {
      USER_EMAIL: process.env.CYPRESS_USER_EMAIL,
      ADMIN_EMAIL: process.env.CYPRESS_ADMIN_EMAIL,
      AUTH_PASSWORD: process.env.CYPRESS_AUTH_PASSWORD,
    },
    testIsolation: true
  },
});


