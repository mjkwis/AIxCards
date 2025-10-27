# Poprawki testów E2E - Authentication

## Problem

Testy E2E kończyły się błędem podczas rejestracji użytkownika:

```
Error: expect(page).toHaveURL(expected) failed
Expected pattern: /\/dashboard\/generate/
Received string: "http://localhost:3000/register?email=...&password=...&confirmPassword=..."
```

### Główna przyczyna

Formularz rejestracji nie był wysyłany - dane pozostawały w URL jako query parameters zamiast być przesłane jako POST request. Problem wynikał z:

1. **Niespecyficznych selektorów** - użycie `button[type="submit"]` mogło klikać w niewłaściwy przycisk
2. **Brak synchronizacji z walidacją** - test nie czekał na zakończenie walidacji formularza przed kliknięciem submit
3. **Niestosowanie się do Playwright best practices** - używanie selektorów CSS zamiast accessible selectors

## Rozwiązanie

### 1. Przejście na Playwright Best Practices

Zgodnie z [oficjalną dokumentacją Playwright](https://playwright.dev/docs/locators#quick-guide), zaleca się używanie:

#### **Role-based selectors** (najlepsze)
```typescript
// ✅ DOBRZE - użycie role i accessible name
await page.getByRole("button", { name: "Zarejestruj się" }).click();
await page.getByRole("button", { name: /zaloguj/i }).click();
```

#### **Label-based selectors** (dla inputs)
```typescript
// ✅ DOBRZE - użycie labeli (accessibility)
await page.getByLabel("Email").fill(email);
await page.getByLabel("Hasło", { exact: true }).fill(password);
await page.getByLabel("Powtórz hasło").fill(confirmPassword);
```

#### **Test ID selectors** (jako fallback)
```typescript
// ✅ DOBRZE - fallback z data-testid
const userDropdown = page
  .locator('[data-testid="user-dropdown-trigger"]')
  .or(page.getByRole("button", { name: /email/i }));
```

#### ❌ Czego unikać:
```typescript
// ❌ ŹLE - selektory CSS są kruche i nie accessibility-aware
await page.fill('input[name="email"]', email);
await page.click('button[type="submit"]');
```

### 2. Synchronizacja z walidacją formularza

W formularzu rejestracji dodano czekanie na spełnienie wymagań hasła:

```typescript
// Poczekaj, aż wszystkie wymagania hasła zostaną spełnione
await expect(page.locator('text="✓ Co najmniej 8 znaków"')).toBeVisible();
await expect(page.locator('text="✓ Jedna wielka litera"')).toBeVisible();
await expect(page.locator('text="✓ Jedna cyfra"')).toBeVisible();
```

To zapewnia, że:
- Walidacja `onChange` się zakończyła
- Formularz jest w stanie valid
- React hook form nie zablokuje submitu

### 3. Użycie `waitForURL` zamiast `expect(page).toHaveURL`

```typescript
// ✅ DOBRZE - czeka na nawigację przed asercją
await page.waitForURL(/\/dashboard\/generate/, { timeout: 10000 });

// vs.

// ❌ Starszy styl (nadal działa, ale waitForURL jest bardziej explicit)
await expect(page).toHaveURL(/\/dashboard\/generate/, { timeout: 10000 });
```

### 4. Lepsze asercje dla komunikatów błędów

```typescript
// ✅ DOBRZE - sprawdza polskie komunikaty z timeout
await expect(page.getByText(/nieprawidłowy.*adres.*email/i)).toBeVisible({ timeout: 5000 });

// ✅ DOBRZE - fallback dla różnych wariantów komunikatów
await expect(
  page.getByText(/już.*zarejestrowany/i).or(page.getByText(/adres.*email.*istnieje/i))
).toBeVisible({ timeout: 10000 });
```

## Zmiany w plikach

### `tests/e2e/auth.spec.ts`

Zaktualizowane wszystkie testy w następujących sekcjach:
- ✅ Authentication - Registration (5 testów)
- ✅ Authentication - Login (5 testów)
- ✅ Authentication - Password Reset (4 testy)
- ✅ Authentication - Account Deletion (1 test)

### `tests/e2e/fixtures/auth.ts`

Zaktualizowane helper functions:
- ✅ `loginUser()` - używa `getByLabel` i `getByRole`
- ✅ `registerUser()` - czeka na walidację hasła, używa accessible selectors
- ✅ `logoutUser()` - używa `getByRole` z fallbackiem na testid

## Korzyści

### 1. **Lepsze accessibility testing**
Testy teraz weryfikują, czy aplikacja jest dostępna dla screen readerów i assistive technologies, ponieważ używają tych samych selektorów co użytkownicy z niepełnosprawnościami.

### 2. **Większa odporność na zmiany**
Selektory role-based i label-based są bardziej stabilne niż CSS selectors:
- Zmiana class name → test nadal działa
- Zmiana struktury HTML → test nadal działa
- Zmiana tylko tekstu labela → łatwo znaleźć i zaktualizować

### 3. **Zgodność z best practices**
Testy są zgodne z oficjalnymi rekomendacjami Playwright i Web Accessibility Guidelines.

### 4. **Lepsza diagnostyka**
Gdy test failuje, komunikaty błędów są bardziej czytelne:
```
Error: locator.getByRole('button', { name: 'Zarejestruj się' })
```
vs.
```
Error: locator.locator('button[type="submit"]')
```

## Weryfikacja

Aby upewnić się, że testy działają poprawnie:

```bash
# Uruchom testy E2E
npm run test:e2e

# Uruchom tylko testy autentykacji
npx playwright test tests/e2e/auth.spec.ts

# Uruchom w trybie debug
npx playwright test tests/e2e/auth.spec.ts --debug

# Uruchom z UI mode (zalecane)
npx playwright test tests/e2e/auth.spec.ts --ui
```

## Dalsze kroki

### Zalecenia dla pozostałych testów

1. Zaktualizuj pozostałe testy E2E według tego samego wzorca
2. Dodaj `data-testid` do kluczowych elementów UI jako fallback
3. Rozważ utworzenie Page Object Model dla powtarzalnych interakcji

### Sugerowane data-testid do dodania

```typescript
// W komponentach navigation/UserDropdown.tsx
<DropdownMenuTrigger data-testid="user-dropdown-trigger">
<DropdownMenuItem data-testid="logout-button">
<DropdownMenuItem data-testid="delete-account-button">

// W komponentach auth/LoginForm.tsx i RegisterForm.tsx
<form data-testid="login-form">
<form data-testid="register-form">
```

## Przypisy

- [Playwright Locators Best Practices](https://playwright.dev/docs/locators)
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [ARIA Roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)

