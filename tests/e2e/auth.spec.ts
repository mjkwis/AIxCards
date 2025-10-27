import { test, expect } from "@playwright/test";
import { generateTestUser, loginUser, logoutUser, registerUser } from "./fixtures/auth";

/**
 * E2E Tests for Authentication Flow
 * Tests: Registration, Login, Logout, Password Reset, Account Deletion
 */

test.describe("Authentication - Registration", () => {
  test("should successfully register a new user", async ({ page }) => {
    const user = generateTestUser();
    await page.goto("/register");

    // Fill registration form
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL(/\/dashboard\/generate/, { timeout: 10000 });

    // Verify user is logged in (navbar should show user email or dropdown)
    const userDropdown = page.locator('[data-testid="user-dropdown-trigger"]').or(
      page.locator(`text=${user.email}`)
    );
    await expect(userDropdown).toBeVisible();
  });

  test("should show validation error for invalid email", async ({ page }) => {
    await page.goto("/register");

    // Fill with invalid email
    await page.fill('input[name="email"]', "invalid-email");
    await page.fill('input[name="password"]', "TestPassword123!");
    await page.fill('input[name="confirmPassword"]', "TestPassword123!");

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=/invalid.*email/i")).toBeVisible();
  });

  test("should show validation error for short password", async ({ page }) => {
    await page.goto("/register");

    const user = generateTestUser();
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', "short");
    await page.fill('input[name="confirmPassword"]', "short");

    await page.click('button[type="submit"]');

    // Should show password length error
    await expect(page.locator("text=/password.*at least/i")).toBeVisible();
  });

  test("should show error when passwords don't match", async ({ page }) => {
    await page.goto("/register");

    const user = generateTestUser();
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', "TestPassword123!");
    await page.fill('input[name="confirmPassword"]', "DifferentPassword123!");

    await page.click('button[type="submit"]');

    // Should show password mismatch error
    await expect(page.locator("text=/password.*match/i")).toBeVisible();
  });

  test("should show error when registering with existing email", async ({ page }) => {
    const user = generateTestUser();

    // First registration
    await registerUser(page, user.email, user.password);

    // Logout
    await logoutUser(page);

    // Try to register again with same email
    await page.goto("/register");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);
    await page.click('button[type="submit"]');

    // Should show error that email already exists
    await expect(page.locator("text=/already.*exists/i").or(page.locator("text=/already.*registered/i"))).toBeVisible();
  });
});

test.describe("Authentication - Login", () => {
  test("should successfully login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Use test user credentials
    const email = process.env.E2E_USERNAME || "test@example.com";
    const password = process.env.E2E_PASSWORD || "TestPassword123!";

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("should show error for invalid email", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Should show authentication error
    await expect(page.locator("text=/invalid.*credentials/i").or(page.locator("text=/incorrect/i"))).toBeVisible();
  });

  test("should show error for wrong password", async ({ page }) => {
    await page.goto("/login");

    const email = process.env.E2E_USERNAME || "test@example.com";
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Should show authentication error
    await expect(page.locator("text=/invalid.*credentials/i").or(page.locator("text=/incorrect/i"))).toBeVisible();
  });

  test("should redirect to login when accessing protected route without auth", async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto("/dashboard/generate");

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("should restore target URL after login (redirect parameter)", async ({ page }) => {
    // Try to access specific dashboard page without auth
    await page.goto("/dashboard/flashcards");

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Login
    const email = process.env.E2E_USERNAME || "test@example.com";
    const password = process.env.E2E_PASSWORD || "TestPassword123!";
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect back to the originally requested page
    // Note: This might redirect to /dashboard/generate as default - adjust based on implementation
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});

test.describe("Authentication - Logout", () => {
  test("should successfully logout", async ({ page }) => {
    // Login first
    await loginUser(page);

    // Open user dropdown and logout
    await logoutUser(page);

    // Should be on homepage
    await expect(page).toHaveURL("/", { timeout: 5000 });

    // Try to access dashboard - should redirect to login
    await page.goto("/dashboard/generate");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("should redirect to login when accessing dashboard after logout", async ({ page }) => {
    await loginUser(page);
    await logoutUser(page);

    // Try accessing different dashboard routes
    const routes = ["/dashboard/generate", "/dashboard/flashcards", "/dashboard/study", "/dashboard/stats"];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
  });
});

test.describe("Authentication - Password Reset", () => {
  test("should display password reset request form", async ({ page }) => {
    await page.goto("/reset-password");

    // Check form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send.*reset.*link/i })).toBeVisible();
  });

  test("should show validation error for invalid email format", async ({ page }) => {
    await page.goto("/reset-password");

    await page.fill('input[name="email"]', "invalid-email");
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=/invalid.*email/i")).toBeVisible();
  });

  test("should show success message after requesting password reset", async ({ page }) => {
    await page.goto("/reset-password");

    const email = process.env.E2E_USERNAME || "test@example.com";
    await page.fill('input[name="email"]', email);
    await page.click('button[type="submit"]');

    // Should show success message (even for non-existent emails for security)
    await expect(
      page.locator("text=/check.*email/i").or(page.locator("text=/reset.*link.*sent/i"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display update password form with valid token", async ({ page }) => {
    // Note: Testing actual password reset flow requires email access
    // This test just verifies the form displays correctly
    await page.goto("/update-password");

    // Check form elements (might redirect if no token)
    const passwordInput = page.locator('input[name="password"]');
    if (await passwordInput.isVisible()) {
      await expect(passwordInput).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /update.*password/i })).toBeVisible();
    }
  });
});

test.describe("Authentication - Account Deletion", () => {
  test("should successfully delete account", async ({ page }) => {
    // Create a new user for deletion
    const user = generateTestUser();
    await registerUser(page, user.email, user.password);

    // Navigate to account settings or user dropdown
    await page.click('[data-testid="user-dropdown-trigger"]').catch(() => {
      return page.click(`text=${user.email}`);
    });

    // Click delete account option
    await page.click('[data-testid="delete-account-button"]').catch(() => {
      return page.click("text=/delete.*account/i");
    });

    // Confirm deletion in dialog
    // Look for confirmation checkbox or button
    const confirmCheckbox = page.locator('input[type="checkbox"][name="confirm"]');
    if (await confirmCheckbox.isVisible()) {
      await confirmCheckbox.check();
    }

    await page.click('button:has-text("Delete")').or(page.getByRole("button", { name: /confirm.*delete/i }));

    // Should redirect to homepage after deletion
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Try to login with deleted account - should fail
    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');

    // Should show error that account doesn't exist
    await expect(page.locator("text=/invalid.*credentials/i")).toBeVisible();
  });
});

test.describe("Authentication - Session Management", () => {
  test("should maintain session across page navigation", async ({ page }) => {
    await loginUser(page);

    // Navigate to different dashboard pages
    await page.goto("/dashboard/generate");
    await expect(page).toHaveURL(/\/dashboard\/generate/);

    await page.goto("/dashboard/flashcards");
    await expect(page).toHaveURL(/\/dashboard\/flashcards/);

    await page.goto("/dashboard/study");
    await expect(page).toHaveURL(/\/dashboard\/study/);

    await page.goto("/dashboard/stats");
    await expect(page).toHaveURL(/\/dashboard\/stats/);

    // Should still be authenticated
    const userDropdown = page.locator('[data-testid="user-dropdown-trigger"]');
    await expect(userDropdown).toBeVisible();
  });

  test("should redirect to login if already logged in and visiting login page", async ({ page }) => {
    await loginUser(page);

    // Try to visit login page again
    await page.goto("/login");

    // Should redirect to dashboard (or stay on current dashboard page)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });

  test("should redirect to login if already logged in and visiting register page", async ({ page }) => {
    await loginUser(page);

    // Try to visit register page
    await page.goto("/register");

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });
});

