# E2E Tests - AIxCards

Ten katalog zawiera testy End-to-End (E2E) dla aplikacji AIxCards przy użyciu Playwright.

## 📋 Spis treści

- [Struktura testów](#struktura-testów)
- [Konfiguracja](#konfiguracja)
- [Uruchamianie testów](#uruchamianie-testów)
- [Scenariusze testowe](#scenariusze-testowe)
- [Fixtures i helpery](#fixtures-i-helpery)
- [Mockowanie API](#mockowanie-api)
- [Debugowanie](#debugowanie)
- [CI/CD](#cicd)

## 📁 Struktura testów

```
tests/e2e/
├── auth.spec.ts              # Testy autentykacji (rejestracja, logowanie, reset hasła)
├── generation.spec.ts        # Testy generowania fiszek AI
├── flashcards.spec.ts        # Testy zarządzania fiszkami (CRUD)
├── study-session.spec.ts     # Testy sesji nauki
├── accessibility.spec.ts     # Testy dostępności (WCAG)
├── example.spec.ts           # Przykładowe testy
├── fixtures/
│   └── auth.ts              # Fixtures do autentykacji
└── helpers/
    ├── accessibility.ts     # Helpery do testów dostępności
    └── mock-openrouter.ts   # Mockowanie OpenRouter API
```

## ⚙️ Konfiguracja

### 1. Zmienne środowiskowe

Stwórz plik `.env.test` w głównym katalogu projektu:

```bash
# Base URL dla aplikacji
BASE_URL=http://localhost:3000

# Supabase Test Instance (osobny projekt dla testów)
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_KEY=your-test-anon-key

# Test User Credentials
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123!

# OpenRouter API (zostanie zamockowany w testach)
OPENROUTER_API_KEY=mock-api-key
```

### 2. Instalacja przeglądarek

```bash
npm run playwright:install
```

### 3. Przygotowanie środowiska testowego

Przed uruchomieniem testów:

1. **Supabase Test Database**: Utwórz osobny projekt Supabase dla testów
2. **Test User**: Utwórz użytkownika testowego w Supabase Auth z credentials z `.env.test`
3. **Migracje**: Uruchom migracje na test database

## 🚀 Uruchamianie testów

### Wszystkie testy

```bash
# Uruchom wszystkie testy E2E
npm run test:e2e

# Uruchom w trybie UI (interactive)
npm run test:e2e:ui

# Uruchom z widocznymi przeglądarkami (headed mode)
npm run test:e2e:headed

# Uruchom w trybie debug
npm run test:e2e:debug
```

### Poszczególne pliki testowe

```bash
# Tylko testy autentykacji
npx playwright test auth

# Tylko testy generowania
npx playwright test generation

# Tylko testy fiszek
npx playwright test flashcards

# Tylko testy sesji nauki
npx playwright test study-session

# Tylko testy dostępności
npx playwright test accessibility
```

### Konkretne przeglądarki

```bash
# Tylko Chrome
npx playwright test --project=chromium

# Tylko Firefox
npx playwright test --project=firefox

# Tylko Safari
npx playwright test --project=webkit

# Mobile Chrome
npx playwright test --project="Mobile Chrome"

# Mobile Safari
npx playwright test --project="Mobile Safari"
```

## 📝 Scenariusze testowe

### Autentykacja (auth.spec.ts)

**Rejestracja:**
- ✅ Poprawna rejestracja z przekierowaniem do dashboardu
- ✅ Walidacja błędnego emaila
- ✅ Walidacja za krótkiego hasła
- ✅ Błąd gdy hasła się nie zgadzają
- ✅ Błąd gdy email już istnieje

**Logowanie:**
- ✅ Poprawne logowanie
- ✅ Błąd nieprawidłowego emaila/hasła
- ✅ Przekierowanie na login przy próbie dostępu do chronionej trasy
- ✅ Przywrócenie docelowej trasy po zalogowaniu (redirect parameter)

**Wylogowanie:**
- ✅ Wylogowanie i przekierowanie na homepage
- ✅ Brak dostępu do dashboardu po wylogowaniu

**Reset hasła:**
- ✅ Formularz żądania resetu hasła
- ✅ Walidacja emaila
- ✅ Wyświetlenie komunikatu sukcesu
- ✅ Formularz zmiany hasła

**Usuwanie konta:**
- ✅ Pomyślne usunięcie konta
- ✅ Brak możliwości logowania po usunięciu

**Zarządzanie sesją:**
- ✅ Utrzymanie sesji przy nawigacji
- ✅ Przekierowanie zalogowanego użytkownika z /login na dashboard

### Generowanie fiszek (generation.spec.ts)

**Happy Path:**
- ✅ Pomyślne wygenerowanie fiszek z validnego tekstu
- ✅ Wyświetlenie fiszek w statusie pending_review
- ✅ Loader podczas generowania

**Walidacja formularza:**
- ✅ Błąd przy pustym tekście
- ✅ Błąd przy tekście za krótkim (<1000 znaków)
- ✅ Błąd przy tekście za długim (>10000 znaków)
- ✅ Licznik znaków

**Zarządzanie wygenerowanymi fiszkami:**
- ✅ Akceptacja pojedynczej fiszki
- ✅ Odrzucenie pojedynczej fiszki
- ✅ Edycja przed akceptacją
- ✅ Batch approve wielu fiszek

**Historia generowania:**
- ✅ Wyświetlenie historii żądań
- ✅ Szczegóły pojedynczego żądania

**Rate Limiting:**
- ✅ Komunikat o przekroczeniu limitu (429)
- ✅ Countdown timer
- ✅ Zablokowanie przycisku submit

**Obsługa błędów:**
- ✅ Błąd API (500)
- ✅ Możliwość retry
- ✅ Pusta odpowiedź z API
- ✅ Timeout

### Zarządzanie fiszkami (flashcards.spec.ts)

**Lista fiszek:**
- ✅ Wyświetlenie listy
- ✅ Empty state gdy brak fiszek

**Tworzenie ręczne:**
- ✅ Otwarcie modalu tworzenia
- ✅ Pomyślne utworzenie fiszki
- ✅ Walidacja pustych pól
- ✅ Zamknięcie bez zapisywania

**Edycja:**
- ✅ Otwarcie modalu edycji
- ✅ Pomyślna aktualizacja

**Usuwanie:**
- ✅ Dialog potwierdzenia
- ✅ Pomyślne usunięcie
- ✅ Anulowanie usunięcia

**Filtrowanie:**
- ✅ Po statusie (active, pending, rejected)
- ✅ Po źródle (manual, AI generated)
- ✅ Wyświetlenie wszystkich

**Sortowanie:**
- ✅ Po dacie utworzenia (newest/oldest)
- ✅ Po dacie następnego review

**Paginacja:**
- ✅ Nawigacja między stronami
- ✅ Wyświetlenie numerów stron

**Wyszukiwanie:**
- ✅ Wyszukiwanie po zawartości

### Sesja nauki (study-session.spec.ts)

**Start sesji:**
- ✅ Wyświetlenie strony sesji
- ✅ Empty state gdy brak fiszek do nauki
- ✅ Wyświetlenie pierwszej fiszki
- ✅ Progress indicator

**Interakcja z fiszką:**
- ✅ Flip karty (pokazanie tyłu)
- ✅ Wyświetlenie przycisków oceny po flip

**Oceny jakości:**
- ✅ Wysłanie oceny i przejście do następnej fiszki
- ✅ Wszystkie poziomy jakości (0-5)

**Zakończenie sesji:**
- ✅ Ekran podsumowania po przeglądzie wszystkich kart
- ✅ Statystyki sesji
- ✅ Opcja rozpoczęcia nowej sesji

**Śledzenie postępu:**
- ✅ Aktualizacja progress bar
- ✅ Licznik pozostałych fiszek

**Nawigacja klawiaturą:**
- ✅ Spacebar do flip
- ✅ Klawisze numeryczne (0-5) do oceny

**Edge cases:**
- ✅ Sesja z jedną fiszką
- ✅ Utrzymanie stanu po odświeżeniu strony

### Dostępność (accessibility.spec.ts)

- ✅ Homepage bez naruszeń WCAG
- ✅ Login page bez naruszeń
- ✅ Register page bez naruszeń
- ✅ Dashboard bez naruszeń (wymaga auth)

## 🔧 Fixtures i helpery

### Auth Fixture (`fixtures/auth.ts`)

```typescript
import { test, expect } from "./fixtures/auth";

test("test with authenticated user", async ({ authenticatedPage }) => {
  // authenticatedPage jest już zalogowany
  await authenticatedPage.goto("/dashboard/flashcards");
  // ...
});
```

**Dostępne funkcje:**
- `loginUser(page, email?, password?)` - logowanie
- `registerUser(page, email?, password?)` - rejestracja
- `logoutUser(page)` - wylogowanie
- `generateTestUser()` - generowanie unikalnych credentials

### Mock OpenRouter (`helpers/mock-openrouter.ts`)

```typescript
import { mockOpenRouterAPI } from "./helpers/mock-openrouter";

test("test with mocked AI", async ({ page }) => {
  await mockOpenRouterAPI(page);
  // API calls będą zwracać mock data
});
```

**Dostępne funkcje:**
- `mockOpenRouterAPI(page)` - standardowa odpowiedź
- `mockOpenRouterAPIWithResponse(page, response)` - custom odpowiedź
- `mockOpenRouterAPIError(page, statusCode)` - symulacja błędu
- `mockOpenRouterAPIRateLimit(page)` - symulacja rate limit (429)
- `mockOpenRouterAPITimeout(page)` - symulacja timeout

### Mock Data (`tests/helpers/mock-data.ts`)

```typescript
import { sampleGenerationText, generateMockFlashcardsFromAI } from "../helpers/mock-data";

// Przykładowy tekst do generowania (1000-10000 znaków)
await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);

// Generowanie mock fiszek
const flashcards = generateMockFlashcardsFromAI(userId, requestId, 5);
```

## 🐛 Debugowanie

### Playwright Inspector

```bash
npm run test:e2e:debug
```

W trybie debug możesz:
- Krokować przez testy
- Oglądać DOM w czasie rzeczywistym
- Sprawdzać selektory
- Zobacz console logs

### UI Mode

```bash
npm run test:e2e:ui
```

UI Mode oferuje:
- Interaktywny przegląd testów
- Timeline z każdym krokiem
- Network logs
- Screenshots i videos

### Screenshots i Videos

Po nieudanych testach:
- **Screenshots**: `playwright-report/screenshots/`
- **Videos**: `playwright-report/videos/`
- **Traces**: `playwright-report/traces/`

### Trace Viewer

```bash
npx playwright show-trace path/to/trace.zip
```

## 📊 Raporty

Po uruchomieniu testów, raport HTML jest generowany automatycznie:

```bash
npx playwright show-report
```

Raport zawiera:
- Wyniki wszystkich testów
- Screenshots z błędów
- Videos z nieudanych testów
- Szczegółowe logi

## 🔄 CI/CD

Testy E2E są uruchamiane automatycznie w GitHub Actions przy każdym PR i push do main.

Konfiguracja w `.github/workflows/e2e-tests.yml`:

```yaml
- name: Run E2E tests
  run: npm run test:e2e
```

W CI:
- Testy uruchamiane są w trybie headless
- Retry: 2 próby dla nieudanych testów
- Workers: 1 (sekwencyjne dla stabilności)
- Artifacts: screenshots, videos, traces

## 📝 Best Practices

### Selektory

1. **Preferuj data-testid:**
   ```typescript
   await page.click('[data-testid="add-flashcard-btn"]');
   ```

2. **Semantic selectors:**
   ```typescript
   await page.getByRole('button', { name: /add/i });
   await page.getByLabel(/email/i);
   ```

3. **Unikaj CSS selectors zależnych od stylu:**
   ```typescript
   // ❌ Złe
   await page.click('.btn-primary.mt-4');
   
   // ✅ Dobre
   await page.click('[data-testid="submit-btn"]');
   ```

### Waiters

Używaj odpowiednich waiters:

```typescript
// Czekaj na URL
await page.waitForURL('/dashboard/**');

// Czekaj na element
await page.locator('[data-testid="flashcard"]').waitFor();

// Czekaj na response
await page.waitForResponse('**/api/flashcards');

// Czekaj na state
await page.waitForLoadState('networkidle');
```

### Izolacja testów

Każdy test powinien być niezależny:

```typescript
test("should create flashcard", async ({ authenticatedPage: page }) => {
  // Utwórz dane testowe w teście
  const uniqueText = `Test ${Date.now()}`;
  
  // Wykonaj test
  // ...
  
  // Opcjonalnie: cleanup (lub polegaj na izolacji bazy testowej)
});
```

### Error handling

Obsługuj przypadki gdy elementy mogą nie istnieć:

```typescript
const element = page.locator('[data-testid="optional"]');

if (await element.isVisible()) {
  await element.click();
} else {
  // Fallback lub skip
}
```

## 🆘 Troubleshooting

### Testy timeoutują

1. Zwiększ timeout w `playwright.config.ts`:
   ```typescript
   timeout: 60000, // 60 sekund
   ```

2. Sprawdź czy aplikacja jest uruchomiona:
   ```bash
   npm run dev
   ```

3. Sprawdź czy test user istnieje w Supabase

### Testy failują na CI ale przechodzą lokalnie

1. Sprawdź zmienne środowiskowe w CI
2. Upewnij się że test database jest dostępna
3. Zwiększ retry count dla CI
4. Sprawdź logi i traces z CI artifacts

### Element nie jest znaleziony

1. Sprawdź czy używasz poprawnych selektorów
2. Dodaj wait przed akcją:
   ```typescript
   await page.locator('[data-testid="element"]').waitFor();
   ```
3. Użyj Playwright Inspector do debugowania

### Mock API nie działa

1. Sprawdź czy route pattern jest poprawny
2. Upewnij się że mock jest setupowany PRZED navigation
3. Sprawdź network tab w Playwright trace viewer

## 📚 Dodatkowe zasoby

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## 🤝 Contributing

Przy dodawaniu nowych testów:

1. Umieść test w odpowiednim pliku spec
2. Używaj opisowych nazw testów
3. Dodaj komentarze dla skomplikowanych scenariuszy
4. Aktualizuj ten README jeśli dodajesz nowe helpery
5. Sprawdź czy testy przechodzą lokalnie przed PR

