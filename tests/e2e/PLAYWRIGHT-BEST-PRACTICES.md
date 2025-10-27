# Playwright Best Practices - Quick Reference

## Hierarchia selektorów (od najlepszych do najgorszych)

### 1️⃣ Role-based selectors (Najlepsze) ✅

Używaj dla wszystkich interaktywnych elementów:

```typescript
// Przyciski
await page.getByRole("button", { name: "Zaloguj się" }).click();
await page.getByRole("button", { name: /wyślij/i }).click(); // regex dla flexibility

// Linki
await page.getByRole("link", { name: "Strona główna" }).click();

// Menu items
await page.getByRole("menuitem", { name: /usuń konto/i }).click();

// Checkboxy
await page.getByRole("checkbox", { name: "Akceptuję regulamin" }).check();
```

### 2️⃣ Label-based selectors (Dla inputów) ✅

Używaj dla wszystkich pól formularza:

```typescript
// Input fields
await page.getByLabel("Email").fill("user@example.com");
await page.getByLabel("Hasło").fill("password123");
await page.getByLabel(/numer.*telefonu/i).fill("123456789");

// Z opcją exact dla unikania konfuzji
await page.getByLabel("Hasło", { exact: true }).fill("pass"); // Nie dopasuje "Powtórz hasło"
```

### 3️⃣ Test ID selectors (Fallback) ⚠️

Używaj gdy role/label nie są wystarczające:

```typescript
// Dodaj data-testid w komponencie
<div data-testid="user-dropdown">...</div>

// W teście
await page.locator('[data-testid="user-dropdown"]').click();

// Lub lepiej: kombinacja z accessible selector
const dropdown = page
  .locator('[data-testid="user-dropdown-trigger"]')
  .or(page.getByRole("button", { name: /user/i }));
```

### 4️⃣ Text-based selectors (Tylko dla statycznego contentu) ⚠️

```typescript
// OK dla nagłówków i statycznego tekstu
await expect(page.getByText("Witaj w aplikacji")).toBeVisible();

// OK z regex dla flexibility
await expect(page.getByText(/błąd.*logowania/i)).toBeVisible();
```

### 5️⃣ CSS/XPath selectors (Ostateczność) ❌

Unikaj! Są kruche i nieaccessible:

```typescript
// ❌ ŹLE - łatwo się psują
await page.locator('.btn-primary').click();
await page.locator('div > button:nth-child(2)').click();
await page.fill('input[name="email"]', 'test@example.com');
```

## Czekanie na elementy

### Używaj auto-waiting

Playwright automatycznie czeka na elementy przed interakcją:

```typescript
// ✅ DOBRZE - auto-waiting
await page.getByRole("button", { name: "Submit" }).click();

// ❌ ŹLE - niepotrzebne ręczne czekanie
await page.waitForSelector('button');
await page.click('button');
```

### Explicit waits (gdy potrzebne)

```typescript
// Czekaj na nawigację
await page.waitForURL(/\/dashboard/, { timeout: 10000 });

// Czekaj na stan elementu
await expect(page.getByText("Sukces")).toBeVisible({ timeout: 5000 });

// Czekaj na custom condition
await page.waitForFunction(() => document.querySelectorAll('.item').length > 10);
```

## Asercje

### Visibility checks

```typescript
// ✅ DOBRZE - explicit timeout
await expect(page.getByText("Error message")).toBeVisible({ timeout: 5000 });

// ✅ DOBRZE - sprawdź niewidoczność
await expect(page.getByRole("dialog")).not.toBeVisible();
```

### URL checks

```typescript
// ✅ DOBRZE - waitForURL (preferowane)
await page.waitForURL(/\/dashboard/, { timeout: 10000 });

// ✅ DOBRZE - expect (starszy styl, nadal OK)
await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
```

### Text content

```typescript
// ✅ DOBRZE - z regex
await expect(page.getByRole("heading")).toHaveText(/welcome/i);

// ✅ DOBRZE - exact match
await expect(page.getByLabel("Email")).toHaveValue("test@example.com");
```

## Wypełnianie formularzy

### Podstawowy flow

```typescript
test("should submit form", async ({ page }) => {
  await page.goto("/register");

  // 1. Wypełnij pola używając labels
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Hasło").fill("SecurePass123!");
  await page.getByLabel("Powtórz hasło").fill("SecurePass123!");

  // 2. Opcjonalnie: czekaj na walidację
  await expect(page.getByText("✓ Hasło spełnia wymagania")).toBeVisible();

  // 3. Submit używając role
  await page.getByRole("button", { name: "Zarejestruj się" }).click();

  // 4. Weryfikuj rezultat
  await page.waitForURL(/\/dashboard/);
});
```

### Obsługa błędów walidacji

```typescript
test("should show validation error", async ({ page }) => {
  await page.goto("/register");

  // Wypełnij z błędnymi danymi
  await page.getByLabel("Email").fill("invalid-email");
  await page.getByRole("button", { name: "Submit" }).click();

  // Sprawdź komunikat błędu z timeout
  await expect(page.getByText(/nieprawidłowy.*email/i)).toBeVisible({ timeout: 5000 });
});
```

## Logika warunkowa

### Sprawdzanie istnienia elementu

```typescript
// ✅ DOBRZE - z timeout i catch
const modal = page.getByRole("dialog");
if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
  await page.getByRole("button", { name: "Close" }).click();
}

// ❌ ŹLE - może rzucić błąd
if (await page.locator('.modal').isVisible()) { // Brak timeout
  // ...
}
```

### Fallback selectors

```typescript
// ✅ DOBRZE - chain z .or()
const submitButton = page
  .getByRole("button", { name: "Wyślij" })
  .or(page.getByRole("button", { name: "Submit" }));
await submitButton.click();

// ✅ DOBRZE - catch dla fallback logic
await page
  .getByTestId("user-menu")
  .click()
  .catch(() => page.getByRole("button", { name: /user/i }).click());
```

## Helper functions

### Tworzenie reusable helpers

```typescript
// fixtures/helpers.ts
export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Hasło").fill(password);
}

export async function submitForm(page: Page, buttonText = "Submit") {
  await page.getByRole("button", { name: new RegExp(buttonText, "i") }).click();
}

// W teście
await fillLoginForm(page, "user@example.com", "password");
await submitForm(page, "Zaloguj");
```

## Dobre praktyki

### ✅ DO

1. **Używaj accessible selectors** - role, label, text
2. **Dodawaj timeouts do asercji** - `{ timeout: 5000 }`
3. **Używaj regex dla flexibility** - `/zaloguj/i`
4. **Czekaj na walidację przed submittem** - sprawdź visual feedback
5. **Testuj accessibility** - jeśli test nie widzi elementu, screen reader też nie
6. **Grupuj testy logicznie** - `test.describe()`
7. **Używaj fixtures dla reusable logic** - login, setup, teardown
8. **Dodawaj komentarze** - wyjaśnij "dlaczego", nie "co"

### ❌ DON'T

1. **Nie używaj CSS selectors** - `.class`, `#id`, `div > button`
2. **Nie używaj XPath** - `//button[@class="submit"]`
3. **Nie używaj waitForTimeout** - `await page.waitForTimeout(1000)` (anti-pattern!)
4. **Nie używaj sleep/delay** - zawsze czekaj na konkretny stan
5. **Nie testuj implementacji** - testuj behavior, nie internal state
6. **Nie używaj nth-child** - kruche, zależne od struktury
7. **Nie zakładaj kolejności wykonania** - każdy test powinien być izolowany

## Debugging

### UI Mode (zalecane)

```bash
npx playwright test --ui
```

### Debug mode

```bash
npx playwright test --debug
```

### Screenshot on failure

```typescript
test("example test", async ({ page }) => {
  // Automatyczny screenshot przy failurze (w playwright.config.ts)
  // screenshot: "only-on-failure"
});
```

### Trace viewer

```bash
# Nagraj trace
npx playwright test --trace on

# Otwórz trace viewer
npx playwright show-trace trace.zip
```

## Przykłady z projektu

Zobacz zaktualizowane testy w:
- `tests/e2e/auth.spec.ts` - przykłady all best practices
- `tests/e2e/fixtures/auth.ts` - reusable helper functions
- `tests/e2e/E2E-TEST-IMPROVEMENTS.md` - szczegółowa dokumentacja

## Resources

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [ARIA Roles Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)

