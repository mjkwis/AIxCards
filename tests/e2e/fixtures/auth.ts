import { test as base, Page, expect } from "@playwright/test";

/**
 * Test user credentials from environment variables
 */
const TEST_USER = {
  email: process.env.E2E_USERNAME || "test@example.com",
  password: process.env.E2E_PASSWORD || "TestPassword123!",
};

/**
 * Generate unique test user credentials
 */
export function generateTestUser() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: "TestPassword123!",
  };
}

/**
 * Login helper function
 */
export async function loginUser(page: Page, email?: string, password?: string) {
  await page.goto("/login");

  const credentials = {
    email: email || TEST_USER.email,
    password: password || TEST_USER.password,
  };

  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL("/dashboard/**", { timeout: 10000 });

  return credentials;
}

/**
 * Register helper function
 */
export async function registerUser(page: Page, email?: string, password?: string) {
  await page.goto("/register");

  const credentials = {
    email: email || generateTestUser().email,
    password: password || "TestPassword123!",
  };

  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);
  await page.fill('input[name="confirmPassword"]', credentials.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard (auto-login after registration)
  await page.waitForURL("/dashboard/**", { timeout: 10000 });

  return credentials;
}

/**
 * Logout helper function
 */
export async function logoutUser(page: Page) {
  // Open user dropdown
  await page.click('[data-testid="user-dropdown-trigger"]').catch(() => {
    // Fallback if data-testid not available
    return page.click("button:has-text('test@example.com')");
  });

  // Click logout
  await page.click('[data-testid="logout-button"]').catch(() => {
    return page.click("button:has-text('Wyloguj')");
  });

  // Wait for navigation to homepage
  await page.waitForURL("/", { timeout: 5000 });
}

/**
 * Extend Playwright test with authentication fixtures
 */
export const test = base.extend<{
  authenticatedPage: Page;
  testUser: { email: string; password: string };
}>({
  // Fixture for authenticated page using existing test user
  authenticatedPage: async ({ page }, use) => {
    await loginUser(page);
    await use(page);
  },

  // Fixture providing test user credentials
  testUser: async ({}, use) => {
    await use(TEST_USER);
  },
});

export { expect };

