# Troubleshooting - Playwright E2E Tests

## Najczęstsze problemy i rozwiązania

### 1. Test timeout - element nie został znaleziony

**Objaw:**
```
Error: locator.click: Timeout 30000ms exceeded.
```

**Przyczyny i rozwiązania:**

#### a) Niewłaściwy selektor

```typescript
// ❌ ŹLE - selektor nie pasuje do elementu
await page.getByRole("button", { name: "Submit" }).click();

// ✅ DOBRZE - użyj regex dla flexibility
await page.getByRole("button", { name: /submit/i }).click();
```

#### b) Element nie jest jeszcze gotowy

```typescript
// ❌ ŹLE - brak czekania na walidację
await page.getByLabel("Email").fill(email);
await page.getByRole("button", { name: "Submit" }).click();

// ✅ DOBRZE - czekaj na stan ready
await page.getByLabel("Email").fill(email);
await expect(page.getByText("✓ Valid")).toBeVisible();
await page.getByRole("button", { name: "Submit" }).click();
```

#### c) Element jest zakryty przez inny element

```typescript
// ✅ DOBRZE - poczekaj na modal/overlay
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "Click me" }).click();
```

### 2. Formularz nie jest wysyłany

**Objaw:**
Dane pozostają w URL jako query parameters lub strona się nie zmienia.

**Przyczyny:**

1. **Kliknięcie w niewłaściwy przycisk**
```typescript
// ❌ ŹLE - może kliknąć w "Show password" button
await page.locator('button').click();

// ✅ DOBRZE - specyficzny selektor
await page.getByRole("button", { name: "Register" }).click();
```

2. **Walidacja blokuje submit**
```typescript
// ✅ DOBRZE - sprawdź, czy nie ma błędów walidacji
await expect(page.getByText(/error/i)).not.toBeVisible();
await page.getByRole("button", { name: "Submit" }).click();
```

3. **JavaScript nie załadowany**
```typescript
// ✅ DOBRRE - poczekaj na hydration
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Submit" }).click();
```

### 3. Nawigacja nie następuje po submit

**Objaw:**
```
Error: expect(page).toHaveURL(expected) failed
```

**Rozwiązania:**

```typescript
// ❌ ŹLE - za krótki timeout
await expect(page).toHaveURL(/\/dashboard/, { timeout: 1000 });

// ✅ DOBRZE - dłuższy timeout dla API calls
await page.waitForURL(/\/dashboard/, { timeout: 10000 });

// ✅ DOBRZE - czekaj na network idle
await page.waitForLoadState("networkidle");
await expect(page).toHaveURL(/\/dashboard/);
```

### 4. Błąd walidacji nie jest widoczny

**Objaw:**
Test nie widzi komunikatu błędu, który jest widoczny w UI.

**Rozwiązania:**

```typescript
// ❌ ŹLE - za krótki timeout lub niewłaściwy selektor
await expect(page.locator("text=Error")).toBeVisible();

// ✅ DOBRZE - regex + timeout
await expect(page.getByText(/error/i)).toBeVisible({ timeout: 5000 });

// ✅ DOBRZE - sprawdź toast notifications
await expect(page.getByRole("alert")).toBeVisible({ timeout: 5000 });
```

### 5. Element nie jest klikowalny

**Objaw:**
```
Error: Element is not visible
Error: Element is outside of the viewport
```

**Rozwiązania:**

```typescript
// ✅ DOBRZE - scroll do elementu
await page.getByRole("button", { name: "Submit" }).scrollIntoViewIfNeeded();
await page.getByRole("button", { name: "Submit" }).click();

// ✅ DOBRZE - czekaj na animacje
await page.waitForTimeout(300); // Tylko jeśli absolutnie konieczne!
await page.getByRole("button", { name: "Submit" }).click();

// ✅ LEPIEJ - czekaj na konkretny stan
await page.waitForFunction(() => {
  const button = document.querySelector('[role="button"]');
  return button && !button.hasAttribute('disabled');
});
```

### 6. Dropdown/Modal nie otwiera się

**Objaw:**
Test nie widzi opcji w dropdown po kliknięciu trigger.

**Rozwiązania:**

```typescript
// ✅ DOBRZE - czekaj na pojawienie się menu
await page.getByRole("button", { name: "User menu" }).click();
await page.getByRole("menu").waitFor({ state: "visible" });
await page.getByRole("menuitem", { name: "Logout" }).click();

// ✅ DOBRZE - użyj force click jeśli potrzeba
await page.getByRole("button", { name: "User menu" }).click({ force: true });
```

### 7. Test działa lokalnie, ale failuje w CI

**Przyczyny:**

1. **Wolniejsze wykonanie w CI**
```typescript
// ✅ DOBRRE - zwiększ timeouty w CI
const timeout = process.env.CI ? 10000 : 5000;
await expect(page.getByText("Success")).toBeVisible({ timeout });
```

2. **Różne rozmiary viewport**
```typescript
// ✅ DOBRZE - ustaw viewport w playwright.config.ts
use: {
  viewport: { width: 1280, height: 720 },
}
```

3. **Race conditions**
```typescript
// ✅ DOBRZE - czekaj na network idle
await page.waitForLoadState("networkidle");
await page.waitForURL(/\/dashboard/);
```

### 8. Problemy z autentykacją między testami

**Objaw:**
Testy failują gdy są uruchamiane razem, ale przechodzą pojedynczo.

**Rozwiązania:**

```typescript
// ✅ DOBRZE - izoluj storage między testami
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.clearPermissions();
});

// ✅ DOBRRE - użyj fixtures dla clean state
test.use({ storageState: { cookies: [], origins: [] } });
```

### 9. Flaky tests - raz przechodzi, raz nie

**Typowe przyczyny:**

1. **Hard-coded waits**
```typescript
// ❌ ŹLE
await page.waitForTimeout(1000);

// ✅ DOBRZE
await page.waitForLoadState("networkidle");
```

2. **Race conditions w async operations**
```typescript
// ❌ ŹLE - może być za szybko
await page.click('button');
await expect(page).toHaveURL(/success/);

// ✅ DOBRZE - czekaj na loading state
await page.click('button');
await page.getByText(/loading/i).waitFor({ state: "hidden" });
await expect(page).toHaveURL(/success/);
```

3. **Niezawodne selektory**
```typescript
// ❌ ŹLE - zależy od kolejności
await page.locator('button').nth(1).click();

// ✅ DOBRZE - semantyczny selektor
await page.getByRole("button", { name: "Submit" }).click();
```

## Debugowanie

### 1. UI Mode (najlepsze dla developmentu)

```bash
npx playwright test --ui
```

Pozwala na:
- Krok po kroku wykonanie
- Inspekcję DOM
- Podgląd screenshots
- Time travel debugging

### 2. Debug Mode

```bash
npx playwright test --debug
```

Otwiera Playwright Inspector z:
- Pause/resume execution
- Step over/into
- Console logs
- Network activity

### 3. Headed Mode (zobacz przeglądarkę)

```bash
npx playwright test --headed
```

### 4. Screenshots i traces

```typescript
// W teście
await page.screenshot({ path: 'debug.png' });

// W playwright.config.ts
use: {
  screenshot: 'only-on-failure',
  trace: 'on-first-retry',
}
```

### 5. Console logs

```typescript
// Wyświetl console.log z przeglądarki
page.on('console', msg => console.log('PAGE LOG:', msg.text()));

// Wyświetl błędy z przeglądarki
page.on('pageerror', error => console.log('PAGE ERROR:', error));
```

## Przydatne komendy

```bash
# Uruchom konkretny test
npx playwright test tests/e2e/auth.spec.ts:10

# Uruchom testy dla konkretnej przeglądarki
npx playwright test --project=chromium

# Uruchom z verbose output
npx playwright test --reporter=list

# Wygeneruj trace
npx playwright test --trace on

# Otwórz trace viewer
npx playwright show-trace trace.zip

# Update snapshots
npx playwright test --update-snapshots
```

## Kiedy szukać pomocy

1. ✅ **Sprawdź dokumentację** - [playwright.dev/docs](https://playwright.dev/docs)
2. ✅ **Przeczytaj PLAYWRIGHT-BEST-PRACTICES.md** - wiele odpowiedzi jest tam
3. ✅ **Użyj UI Mode** - często problemy są oczywiste w time travel debugger
4. ✅ **Sprawdź traces** - zobacz co dokładnie się stało
5. ✅ **GitHub Issues** - [github.com/microsoft/playwright/issues](https://github.com/microsoft/playwright/issues)

## Quick checklist dla failującego testu

- [ ] Czy używam accessible selectors (role/label)?
- [ ] Czy czekam na walidację przed submittem?
- [ ] Czy dodałem timeouty do asercji?
- [ ] Czy test działa w UI mode?
- [ ] Czy selektor jest poprawny? (sprawdź w Playwright Inspector)
- [ ] Czy element jest visible/enabled?
- [ ] Czy czekam na network idle po nawigacji?
- [ ] Czy test jest izolowany (nie zależy od innych testów)?

---

**Pro tip:** Większość problemów można rozwiązać przez:
1. Użycie accessible selectors
2. Dodanie explicit timeouts
3. Czekanie na proper states (visible, networkidle, etc.)

