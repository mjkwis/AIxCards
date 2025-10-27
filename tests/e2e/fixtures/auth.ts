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

  // Use accessible selectors following Playwright best practices
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Hasło").fill(credentials.password);
  await page.getByRole("button", { name: /zaloguj/i }).click();

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

  // Use accessible selectors following Playwright best practices
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Hasło", { exact: true }).fill(credentials.password);
  await page.getByLabel("Powtórz hasło").fill(credentials.password);

  // Wait for password validation to complete
  await expect(page.locator('text="✓ Co najmniej 8 znaków"')).toBeVisible();
  await expect(page.locator('text="✓ Jedna wielka litera"')).toBeVisible();
  await expect(page.locator('text="✓ Jedna cyfra"')).toBeVisible();

  await page.getByRole("button", { name: "Zarejestruj się" }).click();

  // Wait for navigation to dashboard (auto-login after registration)
  await page.waitForURL("/dashboard/**", { timeout: 10000 });

  return credentials;
}

/**
 * Logout helper function
 */
export async function logoutUser(page: Page) {
  // Open user dropdown - use testid or fallback to accessible selector
  const userDropdown = page
    .locator('[data-testid="user-dropdown-trigger"]')
    .or(page.getByRole("button", { name: /test@example\.com/i }));
  await userDropdown.click();

  // Click logout using testid or accessible selector
  const logoutButton = page
    .locator('[data-testid="logout-button"]')
    .or(page.getByRole("menuitem", { name: /wyloguj/i }));
  await logoutButton.click();

  // Wait for navigation to homepage or login page
  await page.waitForURL(/\/(login)?$/, { timeout: 5000 });
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

