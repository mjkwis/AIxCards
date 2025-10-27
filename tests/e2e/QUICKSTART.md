# E2E Tests - Quick Start Guide

Szybki przewodnik jak uruchomić testy E2E dla AIxCards w 5 minut.

## ⚡ Szybki start

### 1. Instalacja (jednorazowo)

```bash
# Zainstaluj zależności (jeśli jeszcze nie)
npm install

# Zainstaluj przeglądarki Playwright
npm run playwright:install
```

### 2. Konfiguracja środowiska testowego

#### Opcja A: Używając istniejącej bazy danych (dla szybkich testów lokalnych)

Skopiuj `.env` do `.env.test`:

```bash
cp .env .env.test
```

Edytuj `.env.test` i dodaj test user credentials:

```env
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123!
```

**Utwórz test usera w Supabase:**
1. Otwórz Supabase Dashboard
2. Authentication → Users → Add User
3. Email: `test@example.com`, Password: `TestPassword123!`

#### Opcja B: Dedykowana baza testowa (zalecane dla CI/CD)

1. Utwórz nowy projekt Supabase dla testów
2. Uruchom migracje na test database
3. Stwórz `.env.test`:

```env
BASE_URL=http://localhost:3000
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_KEY=your-test-anon-key
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123!
OPENROUTER_API_KEY=mock-key
```

4. Utwórz test usera w test Supabase

### 3. Uruchom aplikację

```bash
npm run dev
```

Poczekaj aż aplikacja wystartuje na `http://localhost:4321`

### 4. Uruchom testy

```bash
# Wszystkie testy (headless)
npm run test:e2e

# Lub w trybie UI (interaktywny)
npm run test:e2e:ui
```

## 🎯 Uruchamianie konkretnych testów

```bash
# Tylko testy autentykacji
npx playwright test auth

# Tylko testy generowania fiszek
npx playwright test generation

# Tylko testy zarządzania fiszkami
npx playwright test flashcards

# Tylko testy sesji nauki
npx playwright test study-session

# Tylko testy dostępności
npx playwright test accessibility
```

## 🔍 Debugowanie testów

### Tryb debug (krok po kroku)

```bash
npm run test:e2e:debug
```

### Tryb headed (z widoczną przeglądarką)

```bash
npm run test:e2e:headed
```

### UI Mode (interaktywny przegląd)

```bash
npm run test:e2e:ui
```

## 📊 Przeglądanie raportów

Po uruchomieniu testów:

```bash
npx playwright show-report
```

Raport zawiera:
- ✅/❌ Status wszystkich testów
- 📸 Screenshots z błędów
- 🎥 Videos z nieudanych testów
- 📜 Szczegółowe logi

## 🐛 Szybkie rozwiązywanie problemów

### Test nie znajduje elementu

Użyj Playwright Inspector:

```bash
npm run test:e2e:debug
```

1. Ustaw breakpoint przed problematyczną linią
2. Sprawdź DOM w inspectorze
3. Przetestuj selektor w konsoli

### Timeout errors

Zwiększ timeout dla konkretnego testu:

```typescript
test("long running test", async ({ page }) => {
  test.setTimeout(60000); // 60 sekund
  // ...
});
```

### Mock API nie działa

Upewnij się że mock jest setupowany PRZED navigation:

```typescript
// ✅ Poprawnie
await mockOpenRouterAPI(page);
await page.goto("/dashboard/generate");

// ❌ Źle
await page.goto("/dashboard/generate");
await mockOpenRouterAPI(page); // Za późno!
```

### Test user nie istnieje

```bash
# Sprawdź czy user jest utworzony w Supabase
# Authentication → Users → szukaj: test@example.com

# Jeśli nie ma, utwórz manualnie lub przez SQL:
```

```sql
-- W Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'test@example.com',
  crypt('TestPassword123!', gen_salt('bf')),
  now()
);
```

## 📝 Często używane komendy

```bash
# Uruchom wszystkie testy
npm run test:e2e

# Uruchom w trybie UI
npm run test:e2e:ui

# Uruchom z widoczną przeglądarką
npm run test:e2e:headed

# Debug konkretnego testu
npx playwright test auth --debug

# Uruchom tylko w Chrome
npx playwright test --project=chromium

# Uruchom konkretny plik
npx playwright test tests/e2e/auth.spec.ts

# Uruchom konkretny test po nazwie
npx playwright test -g "should successfully register"

# Zobacz raport
npx playwright show-report

# Zobacz trace z nieudanego testu
npx playwright show-trace playwright-report/traces/trace.zip
```

## 🎨 Przykładowy test

```typescript
import { test, expect } from "./fixtures/auth";

test.describe("My Feature", () => {
  test("should do something", async ({ authenticatedPage: page }) => {
    // authenticatedPage jest już zalogowany!
    
    // Navigate
    await page.goto("/dashboard/flashcards");
    
    // Interact
    await page.click('[data-testid="add-btn"]');
    await page.fill('input[name="front"]', "Question");
    await page.fill('input[name="back"]', "Answer");
    await page.click('button[type="submit"]');
    
    // Assert
    await expect(page.locator("text=Question")).toBeVisible();
  });
});
```

## 📚 Następne kroki

1. Przeczytaj [README.md](./README.md) dla pełnej dokumentacji
2. Zobacz przykłady w `example.spec.ts`
3. Sprawdź istniejące testy jako template
4. Dodaj własne testy dla nowych feature'ów

## 🆘 Potrzebujesz pomocy?

1. Sprawdź [README.md](./README.md) - szczegółowa dokumentacja
2. Zobacz [Playwright Docs](https://playwright.dev)
3. Uruchom test w debug mode: `npm run test:e2e:debug`
4. Sprawdź trace viewer dla nieudanych testów

## ✅ Checklist przed commitem

- [ ] Wszystkie testy przechodzą lokalnie
- [ ] Dodane nowe testy dla nowych feature'ów
- [ ] Testy są deterministyczne (nie failują losowo)
- [ ] Używane są odpowiednie selektory (data-testid preferowane)
- [ ] Dokumentacja zaktualizowana jeśli potrzeba

---

**Gotowe do testowania! 🚀**

