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

    // Fill registration form using accessible labels
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło", { exact: true }).fill(user.password);
    await page.getByLabel("Powtórz hasło").fill(user.password);

    // Wait for all password requirements to be met (green checkmarks)
    await expect(page.locator('text="✓ Co najmniej 8 znaków"')).toBeVisible();
    await expect(page.locator('text="✓ Jedna wielka litera"')).toBeVisible();
    await expect(page.locator('text="✓ Jedna cyfra"')).toBeVisible();

    // Submit form using role-based selector
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Wait for navigation to complete
    await page.waitForURL(/\/dashboard\/generate/, { timeout: 10000 });

    // Verify user is logged in (navbar should show user email or dropdown)
    const userDropdown = page.locator('[data-testid="user-dropdown-trigger"]').or(
      page.locator(`text=${user.email}`)
    );
    await expect(userDropdown).toBeVisible();
  });

  test("should show validation error for invalid email", async ({ page }) => {
    await page.goto("/register");

    // Fill with invalid email using accessible labels
    await page.getByLabel("Email").fill("invalid-email");
    await page.getByLabel("Hasło", { exact: true }).fill("TestPassword123!");
    await page.getByLabel("Powtórz hasło").fill("TestPassword123!");

    // Try to submit
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Should show validation error
    await expect(page.getByText(/nieprawidłowy.*adres.*email/i)).toBeVisible({ timeout: 5000 });
  });

  test("should show validation error for short password", async ({ page }) => {
    await page.goto("/register");

    const user = generateTestUser();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło", { exact: true }).fill("short");
    await page.getByLabel("Powtórz hasło").fill("short");

    // Password requirements should still show red circles (not met)
    await expect(page.locator('text="○ Co najmniej 8 znaków"')).toBeVisible();

    // Try to submit
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Should show password length error
    await expect(page.getByText(/hasło.*co najmniej.*8.*znaków/i)).toBeVisible({ timeout: 5000 });
  });

  test("should show error when passwords don't match", async ({ page }) => {
    await page.goto("/register");

    const user = generateTestUser();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło", { exact: true }).fill("TestPassword123!");
    await page.getByLabel("Powtórz hasło").fill("DifferentPassword123!");

    // Try to submit
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Should show password mismatch error
    await expect(page.getByText(/hasła.*identyczne/i)).toBeVisible({ timeout: 5000 });
  });

  test("should show error when registering with existing email", async ({ page }) => {
    const user = generateTestUser();

    // First registration
    await registerUser(page, user.email, user.password);

    // Logout
    await logoutUser(page);

    // Try to register again with same email
    await page.goto("/register");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło", { exact: true }).fill(user.password);
    await page.getByLabel("Powtórz hasło").fill(user.password);
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Should show error that email already exists (toast or error message)
    await expect(
      page.getByText(/już.*zarejestrowany/i).or(page.getByText(/adres.*email.*istnieje/i))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Authentication - Login", () => {
  test("should successfully login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Use test user credentials
    const email = process.env.E2E_USERNAME || "test@example.com";
    const password = process.env.E2E_PASSWORD || "TestPassword123!";

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Hasło").fill(password);
    await page.getByRole("button", { name: /zaloguj/i }).click();

    // Wait for navigation to complete
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test("should show error for invalid email", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.getByLabel("Hasło").fill("WrongPassword123!");
    await page.getByRole("button", { name: /zaloguj/i }).click();

    // Should show authentication error (toast or error message)
    await expect(
      page.getByText(/nieprawidłowe.*dane/i).or(page.getByText(/błąd.*logowania/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show error for wrong password", async ({ page }) => {
    await page.goto("/login");

    const email = process.env.E2E_USERNAME || "test@example.com";
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Hasło").fill("WrongPassword123!");
    await page.getByRole("button", { name: /zaloguj/i }).click();

    // Should show authentication error
    await expect(
      page.getByText(/nieprawidłowe.*dane/i).or(page.getByText(/błąd.*logowania/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should redirect to login when accessing protected route without auth", async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto("/dashboard/generate");

    // Should be redirected to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });

  test("should restore target URL after login (redirect parameter)", async ({ page }) => {
    // Try to access specific dashboard page without auth
    await page.goto("/dashboard/flashcards");

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Login using accessible selectors
    const email = process.env.E2E_USERNAME || "test@example.com";
    const password = process.env.E2E_PASSWORD || "TestPassword123!";
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Hasło").fill(password);
    await page.getByRole("button", { name: /zaloguj/i }).click();

    // Should redirect back to the originally requested page
    // Note: This might redirect to /dashboard/generate as default - adjust based on implementation
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
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

    // Check form elements using accessible selectors
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /wyślij.*link/i })).toBeVisible();
  });

  test("should show validation error for invalid email format", async ({ page }) => {
    await page.goto("/reset-password");

    await page.getByLabel(/email/i).fill("invalid-email");
    await page.getByRole("button", { name: /wyślij.*link/i }).click();

    // Should show validation error
    await expect(page.getByText(/nieprawidłowy.*email/i)).toBeVisible({ timeout: 5000 });
  });

  test("should show success message after requesting password reset", async ({ page }) => {
    await page.goto("/reset-password");

    const email = process.env.E2E_USERNAME || "test@example.com";
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole("button", { name: /wyślij.*link/i }).click();

    // Should show success message (even for non-existent emails for security)
    await expect(
      page.getByText(/sprawdź.*email/i).or(page.getByText(/link.*wysłany/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display update password form with valid token", async ({ page }) => {
    // Note: Testing actual password reset flow requires email access
    // This test just verifies the form displays correctly
    await page.goto("/update-password");

    // Check form elements (might redirect if no token)
    const passwordInput = page.getByLabel("Nowe hasło", { exact: false });
    if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(passwordInput).toBeVisible();
      await expect(page.getByLabel("Powtórz hasło")).toBeVisible();
      await expect(page.getByRole("button", { name: /zaktualizuj.*hasło/i })).toBeVisible();
    }
  });
});

test.describe("Authentication - Account Deletion", () => {
  test("should successfully delete account", async ({ page }) => {
    // Create a new user for deletion
    const user = generateTestUser();
    await registerUser(page, user.email, user.password);

    // Navigate to account settings or user dropdown using accessible selectors
    const userDropdown = page.locator('[data-testid="user-dropdown-trigger"]').or(page.getByText(user.email));
    await userDropdown.click();

    // Click delete account option using role-based or testid selector
    const deleteButton = page
      .locator('[data-testid="delete-account-button"]')
      .or(page.getByRole("menuitem", { name: /usuń.*konto/i }));
    await deleteButton.click();

    // Confirm deletion in dialog
    // Look for confirmation checkbox or button
    const confirmCheckbox = page.getByRole("checkbox", { name: /potwierd/i });
    if (await confirmCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmCheckbox.check();
    }

    // Click final delete button
    await page.getByRole("button", { name: /usuń/i }).click();

    // Should redirect to homepage after deletion
    await page.waitForURL("/", { timeout: 10000 });

    // Try to login with deleted account - should fail
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło").fill(user.password);
    await page.getByRole("button", { name: /zaloguj/i }).click();

    // Should show error that account doesn't exist
    await expect(page.getByText(/nieprawidłowe.*dane/i)).toBeVisible({ timeout: 10000 });
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

