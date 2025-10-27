# Plan testów – 10xCards

## 1. Wprowadzenie i cele testowania

### 1.1 Cel dokumentu
Niniejszy dokument przedstawia kompleksowy plan testów dla aplikacji 10xCards – systemu do tworzenia i zarządzania fiszkami edukacyjnymi z wykorzystaniem AI. Plan obejmuje testowanie wszystkich kluczowych funkcjonalności, ze szczególnym uwzględnieniem nowo zaimplementowanego systemu resetowania hasła.

### 1.2 Cele testowania
- **Weryfikacja funkcjonalna:** Potwierdzenie, że wszystkie funkcje działają zgodnie z wymaganiami PRD
- **Bezpieczeństwo:** Zapewnienie ochrony danych użytkowników i odporności na ataki
- **Wydajność:** Sprawdzenie responsywności i skalowalności systemu
- **Dostępność:** Weryfikacja zgodności z WCAG 2.1 AA
- **Integracja:** Potwierdzenie poprawnej komunikacji między komponentami (Astro, React, Supabase, OpenRouter)
- **Zgodność z RODO:** Weryfikacja przetwarzania danych osobowych

### 1.3 Zakres stosowania
Plan jest przeznaczony dla zespołu deweloperskiego, QA oraz DevOps odpowiedzialnych za rozwój i wdrożenie aplikacji 10xCards.

---

## 2. Zakres testów

### 2.1 Komponenty objęte testami

#### Backend API (Astro Endpoints)
- **Autentykacja:** `/api/auth/*` (login, register, logout, account, password/*)
- **Fiszki:** `/api/flashcards/*` (CRUD, approve/reject, batch operations)
- **Generowanie AI:** `/api/generation-requests/*`
- **Sesje nauki:** `/api/study-sessions/*`
- **Statystyki:** `/api/statistics/*`

#### Frontend (Astro + React)
- **Strony publiczne:** Landing (`/`), Login (`/login`), Register (`/register`), Reset Password (`/reset-password`), Update Password (`/update-password`)
- **Dashboard:** Generate (`/dashboard/generate`), Flashcards (`/dashboard/flashcards`), Study (`/dashboard/study`), Stats (`/dashboard/stats`)
- **Komponenty React:** Formularze (auth, generation, flashcards), karty fiszek, sesje nauki, statystyki

#### Serwisy i logika biznesowa
- **AuthService:** Rejestracja, logowanie, wylogowanie, usuwanie konta
- **FlashcardService:** Zarządzanie fiszkami
- **GenerationRequestService:** Obsługa generowania AI
- **StudySessionService:** Algorytm SM-2, sesje nauki
- **StatisticsService:** Zbieranie i agregacja danych
- **RateLimitService:** Ograniczanie częstotliwości requestów
- **OpenRouterService:** Integracja z API AI

#### Infrastruktura
- **Middleware:** Autoryzacja, rate limiting, CORS
- **Supabase:** Auth, Database, RLS policies
- **OpenRouter:** Komunikacja z modelami AI

### 2.2 Funkcjonalności priorytetowe

**Priorytet KRYTYCZNY:**
1. Autentykacja użytkowników (login, register, logout)
2. Resetowanie hasła (DEV i PROD mode)
3. Generowanie fiszek przez AI
4. Sesje nauki z algorytmem SM-2
5. Rate limiting dla API

**Priorytet WYSOKI:**
6. Zatwierdzanie/odrzucanie fiszek AI
7. Ręczne tworzenie fiszek
8. Edycja i usuwanie fiszek
9. Statystyki użytkownika
10. Middleware (auth, rate limit)

**Priorytet ŚREDNI:**
11. Responsywność UI (mobile, tablet, desktop)
12. Dostępność (WCAG 2.1 AA)
13. Obsługa błędów i walidacja
14. Batch operations (zatwierdzanie wielu fiszek)

**Priorytet NISKI:**
15. Optymalizacja wydajności
16. SEO
17. Analytics

### 2.3 Wyłączenia z zakresu testów
- Testy bezpieczeństwa penetracyjnego (pen-testing) – planowane na późniejszym etapie
- Testy obciążeniowe powyżej 100 użytkowników jednocześnie
- Testy kompatybilności z przeglądarkami starszymi niż 2 lata
- Testy integracji z zewnętrznymi systemami poza OpenRouter i Supabase

---

## 3. Typy testów

### 3.1 Testy jednostkowe (Unit Tests)
**Cel:** Weryfikacja poprawności pojedynczych funkcji i metod

**Narzędzia:** Vitest, Testing Library

**Zakres:**
- Serwisy (`AuthService`, `FlashcardService`, `StudySessionService`, etc.)
- Walidatory Zod (schemas w `lib/validation/*`)
- Helpery i utility functions (`lib/helpers/*`, `lib/utils.ts`)
- Algorytm SM-2 (spaced repetition)
- Rate limiting logic
- Error handlers

**Przykładowe testy:**
```typescript
// AuthService.test.ts
describe('AuthService', () => {
  it('should register new user with valid credentials', async () => {})
  it('should throw EmailAlreadyRegisteredError for duplicate email', async () => {})
  it('should login user with correct password', async () => {})
  it('should throw InvalidCredentialsError for wrong password', async () => {})
})

// StudySessionService.test.ts
describe('SM-2 Algorithm', () => {
  it('should increase interval for quality >= 3', async () => {})
  it('should reset interval for quality < 3', async () => {})
  it('should update ease_factor correctly', async () => {})
})

// RateLimitService.test.ts
describe('RateLimitService', () => {
  it('should allow requests within limit', async () => {})
  it('should throw RateLimitError when limit exceeded', async () => {})
  it('should reset counter after time window expires', async () => {})
})
```

**Pokrycie:** Minimum 80% code coverage dla serwisów biznesowych

---

### 3.2 Testy integracyjne (Integration Tests)
**Cel:** Weryfikacja współpracy między komponentami

**Narzędzia:** Vitest + Supabase Test Client, MSW (Mock Service Worker)

**Zakres:**
- API endpoints z rzeczywistą bazą danych (Supabase test instance)
- Middleware + API endpoints
- Serwisy + Supabase SDK
- Frontend components + API client
- OpenRouter integration (mocked)

**Przykładowe scenariusze:**
```typescript
// Auth API Integration
describe('POST /api/auth/login', () => {
  it('should return 200 and JWT token for valid credentials', async () => {})
  it('should return 401 for invalid credentials', async () => {})
  it('should set HttpOnly cookie with refresh token', async () => {})
})

// Flashcard Generation Flow
describe('AI Flashcard Generation', () => {
  it('should create generation_request and pending flashcards', async () => {})
  it('should respect rate limit (10 requests/hour)', async () => {})
  it('should handle OpenRouter API errors gracefully', async () => {})
})

// Password Reset Flow (DEV mode)
describe('Password Reset - DEV', () => {
  it('should generate mock token via /api/auth/password/mock-reset', async () => {})
  it('should update password via Admin API', async () => {})
  it('should allow login with new password', async () => {})
})
```

---

### 3.3 Testy E2E (End-to-End Tests)
**Cel:** Weryfikacja pełnych przepływów użytkownika

**Narzędzia:** Playwright

**Zakres:**
- Rejestracja → Logowanie → Generowanie fiszek → Sesja nauki
- Reset hasła (DEV i PROD flow)
- Zatwierdzanie/odrzucanie fiszek AI
- Ręczne tworzenie fiszek
- Edycja i usuwanie fiszek
- Wyświetlanie statystyk

**Przykładowe scenariusze:**
```typescript
// E2E: Complete User Journey
test('User can register, generate flashcards, and study', async ({ page }) => {
  // 1. Register
  await page.goto('/register')
  await page.fill('#email', 'test@example.com')
  await page.fill('#password', 'SecurePass123')
  await page.click('button[type="submit"]')
  
  // 2. Generate flashcards
  await page.goto('/dashboard/generate')
  await page.fill('#source_text', 'Long educational text...')
  await page.click('button:has-text("Generuj fiszki")')
  await page.waitForSelector('.flashcard-card')
  
  // 3. Approve flashcards
  await page.click('button:has-text("Zatwierdź wszystkie")')
  
  // 4. Start study session
  await page.goto('/dashboard/study')
  await page.click('button:has-text("Rozpocznij sesję")')
  
  // 5. Review flashcard
  await page.click('button:has-text("Pokaż odpowiedź")')
  await page.click('button:has-text("Łatwe")')
  
  // Assert session summary
  await expect(page.locator('.session-summary')).toBeVisible()
})

// E2E: Password Reset Flow (DEV)
test('User can reset password in DEV mode', async ({ page }) => {
  // 1. Go to reset-password page
  await page.goto('/reset-password')
  
  // 2. Use DEV test card
  await page.fill('#dev-email', 'test@example.com')
  await page.click('button:has-text("Wygeneruj link i przekieruj")')
  
  // 3. Redirected to update-password
  await expect(page).toHaveURL(/\/update-password/)
  
  // 4. Set new password
  await page.fill('#password', 'NewSecurePass456')
  await page.fill('#confirmPassword', 'NewSecurePass456')
  await page.click('button[type="submit"]')
  
  // 5. Redirected to login
  await expect(page).toHaveURL('/login')
  
  // 6. Login with new password
  await page.fill('#email', 'test@example.com')
  await page.fill('#password', 'NewSecurePass456')
  await page.click('button[type="submit"]')
  
  // Assert successful login
  await expect(page).toHaveURL(/\/dashboard/)
})
```

---

### 3.4 Testy wydajnościowe (Performance Tests)
**Cel:** Weryfikacja czasów odpowiedzi i użycia zasobów

**Narzędzia:** k6, Lighthouse, WebPageTest

**Metryki:**
- **API Response Time:** < 200ms dla prostych endpoint, < 2s dla AI generation
- **Page Load Time:** < 3s (FCP), < 5s (LCP)
- **Database Query Time:** < 100ms dla pojedynczych queries
- **Concurrent Users:** 50 użytkowników jednocześnie bez degradacji

**Scenariusze:**
```javascript
// k6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp-up
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],   // < 1% failures
  },
};

export default function () {
  // Login
  const loginRes = http.post('http://localhost:3000/api/auth/login', {
    email: 'test@example.com',
    password: 'SecurePass123',
  });
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'has access_token': (r) => JSON.parse(r.body).session.access_token,
  });
  
  sleep(1);
}
```

---

### 3.5 Testy bezpieczeństwa (Security Tests)
**Cel:** Identyfikacja luk bezpieczeństwa

**Narzędzia:** OWASP ZAP, npm audit, Snyk

**Zakres:**
- **SQL Injection:** Walidacja input, parametryzowane queries (Supabase ORM)
- **XSS (Cross-Site Scripting):** Sanitizacja output, CSP headers
- **CSRF:** SameSite cookies, CSRF tokens
- **Authentication:** JWT validation, session management
- **Authorization:** RLS policies, endpoint protection
- **Rate Limiting:** Ochrona przed brute-force, DoS
- **Dependencies:** Skanowanie vulnerabilities w npm packages

**Checklist:**
- [ ] JWT tokens są walidowane na każdym chronionym endpoincie
- [ ] RLS policies blokują dostęp do danych innych użytkowników
- [ ] Rate limiting aktywny dla login, register, password reset
- [ ] Hasła hashowane przez bcrypt (via Supabase)
- [ ] Environment variables (API keys) nie są eksponowane
- [ ] HTTPS enforced w produkcji
- [ ] HttpOnly cookies dla refresh tokens
- [ ] Input validation przez Zod na wszystkich endpointach

---

### 3.6 Testy dostępności (Accessibility Tests)
**Cel:** Weryfikacja zgodności z WCAG 2.1 AA

**Narzędzia:** axe-core, Lighthouse, NVDA/JAWS

**Kryteria:**
- **Kontrast:** Minimum 4.5:1 dla normalnego tekstu, 3:1 dla dużego
- **Nawigacja klawiaturą:** Wszystkie elementy interaktywne dostępne przez Tab
- **Focus indicators:** Widoczne obramowanie dla aktywnego elementu
- **ARIA:** Poprawne role, labels, states
- **Semantyka HTML:** Użycie `<main>`, `<nav>`, `<section>`, `<article>`, `<h1-h6>`
- **Alt text:** Wszystkie obrazy mają alternatywny tekst
- **Formularze:** Labels powiązane z inputs, błędy walidacji czytelne

**Testy manualne:**
- [ ] Nawigacja Tab przez wszystkie strony
- [ ] Screen reader (NVDA) odczytuje treść poprawnie
- [ ] Zoom 200% nie łamie layoutu
- [ ] High contrast mode działa poprawnie
- [ ] Keyboard shortcuts nie kolidują z przeglądarką

---

### 3.7 Testy responsywności (Responsive Tests)
**Cel:** Weryfikacja działania na różnych urządzeniach

**Breakpointy (Tailwind):**
- **Mobile:** < 640px (sm)
- **Tablet:** 640px - 1024px (md, lg)
- **Desktop:** > 1024px (xl, 2xl)

**Urządzenia testowe:**
- iPhone 12/13/14 (390x844)
- Samsung Galaxy S21 (360x800)
- iPad (768x1024)
- iPad Pro (1024x1366)
- Desktop 1920x1080
- Desktop 2560x1440

**Scenariusze:**
- [ ] Navbar przekształca się w mobile drawer na małych ekranach
- [ ] Formularze są czytelne i używalne na mobile
- [ ] Tabele danych są scrollowalne poziomo na mobile
- [ ] Przyciski mają min. 44x44px touch target
- [ ] Fiszki w sesji nauki skalują się poprawnie
- [ ] Statystyki/wykresy dostosowują się do rozmiaru ekranu

---

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1 Autentykacja użytkowników

#### TC-AUTH-001: Rejestracja nowego użytkownika
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, E2E

**Warunki wstępne:**
- Aplikacja uruchomiona
- Email nie jest zarejestrowany w systemie

**Kroki:**
1. Przejdź do `/register`
2. Wpisz email: `newuser@example.com`
3. Wpisz hasło: `SecurePass123` (spełnia wymagania)
4. Kliknij "Zarejestruj się"

**Oczekiwany rezultat:**
- Status 201 z `/api/auth/register`
- Użytkownik utworzony w `auth.users`
- JWT token zwrócony w odpowiedzi
- Przekierowanie do `/dashboard/generate`
- Toast: "Rejestracja pomyślna"

**Walidacja:**
- Hasło zahashowane w bazie (bcrypt)
- `created_at` ustawione na czas rejestracji
- Użytkownik może się zalogować

---

#### TC-AUTH-002: Logowanie z poprawnymi danymi
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, E2E

**Warunki wstępne:**
- Użytkownik zarejestrowany: `test@example.com` / `SecurePass123`

**Kroki:**
1. Przejdź do `/login`
2. Wpisz email: `test@example.com`
3. Wpisz hasło: `SecurePass123`
4. Kliknij "Zaloguj się"

**Oczekiwany rezultat:**
- Status 200 z `/api/auth/login`
- JWT `access_token` i `refresh_token` zwrócone
- Cookie `sb-access-token` ustawione (HttpOnly)
- Przekierowanie do `/dashboard/generate`
- Navbar pokazuje email użytkownika

---

#### TC-AUTH-003: Logowanie z nieprawidłowymi danymi
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, Bezpieczeństwo

**Kroki:**
1. Przejdź do `/login`
2. Wpisz email: `test@example.com`
3. Wpisz hasło: `WrongPassword123`
4. Kliknij "Zaloguj się"

**Oczekiwany rezultat:**
- Status 401 z `/api/auth/login`
- Komunikat: "Nieprawidłowy email lub hasło" (bez wskazania który parametr)
- Brak przekierowania
- Toast z błędem

---

#### TC-AUTH-004: Rate limiting dla logowania
**Priorytet:** Wysoki  
**Typ:** Bezpieczeństwo

**Kroki:**
1. Wykonaj 10 nieudanych prób logowania w ciągu 1 godziny (ten sam IP)
2. Spróbuj zalogować się po raz 11-ty

**Oczekiwany rezultat:**
- Status 429 (Too Many Requests)
- Komunikat: "Zbyt wiele prób. Spróbuj ponownie za X minut"
- Header `Retry-After` z czasem odblokowania
- Blokada na poziomie IP + email

---

### 4.2 Resetowanie hasła

#### TC-RESET-001: Reset hasła w trybie DEV (mock token)
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, E2E

**Warunki wstępne:**
- `import.meta.env.DEV = true`
- Użytkownik istnieje: `test@example.com`

**Kroki:**
1. Przejdź do `/reset-password`
2. W żółtej karcie "Tryb deweloperski" wpisz: `test@example.com`
3. Kliknij "Wygeneruj link i przekieruj"
4. Automatyczne przekierowanie na `/update-password#access_token=...`
5. Wpisz nowe hasło: `NewSecurePass456`
6. Wpisz potwierdzenie: `NewSecurePass456`
7. Kliknij "Ustaw nowe hasło"

**Oczekiwany rezultat:**
- Mock token wygenerowany przez `/api/auth/password/mock-reset`
- Redirect 302 na `/update-password`
- Status 200 z `/api/auth/password/update`
- Hasło zaktualizowane przez **Admin API** (`updateUserById`)
- Przekierowanie na `/login`
- Toast: "Hasło zmienione pomyślnie"

**Walidacja:**
- Logowanie starym hasłem zwraca 401
- Logowanie nowym hasłem zwraca 200
- Hasło zahashowane w `auth.users`

---

#### TC-RESET-002: Reset hasła w trybie PROD (prawdziwy email)
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, E2E

**Warunki wstępne:**
- `import.meta.env.DEV = false`
- Supabase SMTP skonfigurowany
- Użytkownik istnieje: `test@example.com`

**Kroki:**
1. Przejdź do `/reset-password`
2. Wpisz email: `test@example.com`
3. Kliknij "Wyślij link resetujący"
4. Sprawdź skrzynkę emailową
5. Kliknij link w emailu: `https://app.com/update-password#access_token=...`
6. Wpisz nowe hasło: `NewSecurePass789`
7. Kliknij "Ustaw nowe hasło"

**Oczekiwany rezultat:**
- Status 200 z `/api/auth/password/reset-request` (zawsze, nawet dla nieistniejącego emaila)
- Email wysłany przez Supabase z linkiem resetującym
- Token w URL jest valid (sprawdzony przez Supabase)
- Status 200 z `/api/auth/password/update`
- Hasło zaktualizowane przez `supabase.auth.updateUser()`
- **Wszystkie sesje wylogowane** (`signOut({ scope: 'global' })`)
- Przekierowanie na `/login`

**Walidacja:**
- Stare hasło nie działa
- Nowe hasło działa
- Token jest jednorazowy (drugi użycie → 401)

---

#### TC-RESET-003: Rate limiting dla resetu hasła
**Priorytet:** Wysoki  
**Typ:** Bezpieczeństwo

**Kroki:**
1. Wykonaj 3 requesty do `/api/auth/password/reset-request` z tym samym IP i emailem
2. Spróbuj wysłać 4-ty request

**Oczekiwany rezultat:**
- Pierwsze 3 requesty: Status 200
- 4-ty request: Status 429 (Too Many Requests)
- Komunikat: "Zbyt wiele prób. Spróbuj ponownie za 15 minut"
- Rate limit: 3 próby / 15 minut na IP + email

---

#### TC-RESET-004: Walidacja wygasłego tokenu resetującego
**Priorytet:** Wysoki  
**Typ:** Bezpieczeństwo

**Warunki wstępne:**
- Token resetujący wygenerowany > 1 godzina temu (default expiry)

**Kroki:**
1. Otwórz link resetujący z wygasłym tokenem
2. Spróbuj ustawić nowe hasło

**Oczekiwany rezultat:**
- `/update-password` pokazuje: "Link wygasł lub jest nieprawidłowy"
- Przycisk "Poproś o nowy link" → redirect na `/reset-password`
- Status 401 z `/api/auth/password/update`

---

#### TC-RESET-005: Ochrona przed enumeracją emaili
**Priorytet:** Krytyczny  
**Typ:** Bezpieczeństwo

**Kroki:**
1. Wyślij request do `/api/auth/password/reset-request` z emailem **nieistniejącym** w bazie
2. Sprawdź odpowiedź

**Oczekiwany rezultat:**
- Status 200 (sukces)
- Komunikat: "Jeśli email istnieje, wysłaliśmy link resetujący"
- **Brak różnicy** w odpowiedzi między istniejącym a nieistniejącym emailem
- Email nie jest wysyłany (Supabase ignoruje nieistniejące adresy)

---

#### TC-RESET-006: Mock endpoint wyłączony w produkcji
**Priorytet:** Krytyczny  
**Typ:** Bezpieczeństwo

**Warunki wstępne:**
- `import.meta.env.DEV = false`

**Kroki:**
1. Wyślij POST do `/api/auth/password/mock-reset`

**Oczekiwany rezultat:**
- Status 404 (Not Found)
- Komunikat: "Endpoint not found"
- Mock endpoint całkowicie nieaktywny w PROD

---

### 4.3 Generowanie fiszek przez AI

#### TC-GEN-001: Pomyślne generowanie fiszek z tekstu
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, Integracja

**Warunki wstępne:**
- Użytkownik zalogowany
- OpenRouter API key skonfigurowany
- Rate limit nie przekroczony (< 10 requestów/godz)

**Kroki:**
1. Przejdź do `/dashboard/generate`
2. Wklej tekst (1500 znaków): "Fotosynteza to proces..."
3. Kliknij "Generuj fiszki"

**Oczekiwany rezultat:**
- Status 201 z `/api/generation-requests`
- Request do OpenRouter z promptem zawierającym tekst
- Odpowiedź OpenRouter z fiszkami w formacie JSON
- `generation_request` utworzone w bazie z `status: 'completed'`
- 5-10 fiszek utworzonych z `status: 'pending'`, `source: 'ai_generated'`
- Lista wygenerowanych fiszek wyświetlona na stronie
- Toast: "Wygenerowano X fiszek"

**Walidacja:**
- Każda fiszka ma `front` i `back` niepuste
- `generation_request_id` poprawnie powiązany
- `user_id` ustawiony na zalogowanego użytkownika

---

#### TC-GEN-002: Rate limiting dla generowania AI
**Priorytet:** Wysoki  
**Typ:** Bezpieczeństwo, Wydajność

**Kroki:**
1. Wykonaj 10 requestów do `/api/generation-requests` w ciągu 1 godziny
2. Spróbuj wykonać 11-ty request

**Oczekiwany rezultat:**
- Pierwsze 10 requestów: Status 201
- 11-ty request: Status 429
- Komunikat: "Osiągnięto limit generowań (10/godzinę)"
- Header `X-RateLimit-Remaining: 0`
- Header `Retry-After` z czasem odblokowania

---

#### TC-GEN-003: Obsługa błędu OpenRouter API
**Priorytet:** Wysoki  
**Typ:** Integracja, Obsługa błędów

**Warunki wstępne:**
- OpenRouter API zwraca błąd (np. 500, timeout, invalid API key)

**Kroki:**
1. Skonfiguruj mock OpenRouter zwracający błąd
2. Wyślij tekst do generowania

**Oczekiwany rezultat:**
- Status 422 z `/api/generation-requests`
- `generation_request` utworzone z `status: 'failed'`
- `error_message` zapisane w bazie
- Komunikat użytkownikowi: "Nie udało się wygenerować fiszek. Spróbuj ponownie później"
- Brak utworzonych fiszek
- Toast z błędem

---

#### TC-GEN-004: Walidacja długości tekstu źródłowego
**Priorytet:** Średni  
**Typ:** Walidacja

**Scenariusze:**
1. Tekst < 1000 znaków
2. Tekst > 10000 znaków

**Oczekiwany rezultat:**
- Status 400 (Validation Error)
- Komunikat: "Tekst musi mieć 1000-10000 znaków"
- Błąd walidacji Zod

---

### 4.4 Sesje nauki (SM-2 Algorithm)

#### TC-STUDY-001: Rozpoczęcie sesji nauki
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, E2E

**Warunki wstępne:**
- Użytkownik ma min. 5 aktywnych fiszek
- Min. 3 fiszki są due today (`next_review_at <= NOW()`)

**Kroki:**
1. Przejdź do `/dashboard/study`
2. Kliknij "Rozpocznij sesję"

**Oczekiwany rezultat:**
- Request do `/api/study-sessions/current`
- Status 200 z listą fiszek do powtórki (sortowane: najstarsze `next_review_at` pierwsze)
- Wyświetlona pierwsza fiszka (tylko `front`)
- Przycisk "Pokaż odpowiedź"
- Progress bar: "1 / X"

---

#### TC-STUDY-002: Ocena fiszki - algorytm SM-2
**Priorytet:** Krytyczny  
**Typ:** Funkcjonalny, Algorytm

**Warunki wstępne:**
- Sesja nauki aktywna
- Fiszka wyświetlona:
  - `interval: 1` (dzień)
  - `ease_factor: 2.5`
  - `repetitions: 1`

**Kroki:**
1. Kliknij "Pokaż odpowiedź"
2. Oceń fiszkę jako "Łatwe" (quality: 5)

**Oczekiwany rezultat:**
- Request do `/api/study-sessions/review` z `flashcard_id` i `quality: 5`
- Algorytm SM-2 oblicza nowe wartości:
  - `interval: 6` (wzrost: 1 * 2.5 * 1.3 = ~6)
  - `ease_factor: 2.6` (wzrost: 2.5 + 0.1)
  - `repetitions: 2`
  - `next_review_at: NOW() + 6 days`
- Fiszka zaktualizowana w bazie
- Następna fiszka wyświetlona lub summary jeśli koniec sesji

**Walidacja:**
- Zapytanie do bazy: `SELECT interval, ease_factor, repetitions, next_review_at FROM flashcards WHERE id = ...`
- Wartości zgodne z algorytmem SM-2

---

#### TC-STUDY-003: Ocena fiszki - reset dla trudnej
**Priorytet:** Wysoki  
**Typ:** Funkcjonalny, Algorytm

**Warunki wstępne:**
- Fiszka: `interval: 7`, `repetitions: 3`

**Kroki:**
1. Oceń fiszkę jako "Trudne" (quality: 2)

**Oczekiwany rezultat:**
- `interval: 1` (reset do 1 dnia)
- `repetitions: 0` (reset)
- `ease_factor` zmniejszony (min. 1.3)
- `next_review_at: NOW() + 1 day`

---

#### TC-STUDY-004: Zakończenie sesji - podsumowanie
**Priorytet:** Średni  
**Typ:** Funkcjonalny, UI

**Warunki wstępne:**
- Sesja z 10 fiszkami ukończona

**Kroki:**
1. Oceń wszystkie fiszki w sesji
2. Sprawdź podsumowanie

**Oczekiwany rezultat:**
- Wyświetlone podsumowanie:
  - Łącznie fiszek: 10
  - Łatwe (5): X
  - Średnie (3-4): Y
  - Trudne (0-2): Z
  - Średnia ocena
- Przycisk "Zakończ sesję" → redirect do `/dashboard/study`
- Toast: "Sesja ukończona! Zrecenzowano 10 fiszek"

---

### 4.5 Zarządzanie fiszkami

#### TC-FLASH-001: Zatwierdzanie fiszki AI
**Priorytet:** Wysoki  
**Typ:** Funkcjonalny

**Warunki wstępne:**
- Użytkownik ma fiszkę z `status: 'pending'`, `source: 'ai_generated'`

**Kroki:**
1. Przejdź do `/dashboard/generate` lub `/dashboard/flashcards`
2. Kliknij "Zatwierdź" na fiszce pending

**Oczekiwany rezultat:**
- Request do `/api/flashcards/:id/approve`
- Status 200
- Fiszka zaktualizowana:
  - `status: 'active'`
  - `next_review_at: NOW()` (dostępna od razu)
  - `interval: 0`, `ease_factor: 2.5`, `repetitions: 0`
- Fiszka znika z listy pending, pojawia się w active
- Toast: "Fiszka zatwierdzona"

---

#### TC-FLASH-002: Odrzucanie fiszki AI
**Priorytet:** Wysoki  
**Typ:** Funkcjonalny

**Kroki:**
1. Kliknij "Odrzuć" na fiszce pending

**Oczekiwany rezultat:**
- Request do `/api/flashcards/:id/reject`
- Status 200
- Fiszka zaktualizowana: `status: 'rejected'`
- Fiszka znika z listy pending
- **Nie jest usuwana** (pozostaje w bazie dla statystyk)
- Toast: "Fiszka odrzucona"

---

#### TC-FLASH-003: Batch approval (zatwierdzanie wielu fiszek)
**Priorytet:** Średni  
**Typ:** Funkcjonalny

**Warunki wstępne:**
- Użytkownik ma 5 fiszek pending z tego samego `generation_request_id`

**Kroki:**
1. Zaznacz 3 fiszki (checkboxy)
2. Kliknij "Zatwierdź zaznaczone"

**Oczekiwany rezultat:**
- Request do `/api/flashcards/batch-approve` z `flashcard_ids: [id1, id2, id3]`
- Status 200
- Wszystkie 3 fiszki zmienione na `active`
- Toast: "Zatwierdzono 3 fiszki"

---

#### TC-FLASH-004: Ręczne tworzenie fiszki
**Priorytet:** Wysoki  
**Typ:** Funkcjonalny

**Kroki:**
1. Przejdź do `/dashboard/flashcards`
2. Kliknij "Dodaj fiszkę"
3. Wpisz front: "Stolica Polski?"
4. Wpisz back: "Warszawa"
5. Kliknij "Utwórz"

**Oczekiwany rezultat:**
- Request do `/api/flashcards` (POST)
- Status 201
- Fiszka utworzona:
  - `source: 'manual'`
  - `status: 'active'` (od razu aktywna)
  - `generation_request_id: null`
  - `next_review_at: NOW()`
- Fiszka pojawia się na liście
- Toast: "Fiszka utworzona"

---

#### TC-FLASH-005: Edycja fiszki
**Priorytet:** Średni  
**Typ:** Funkcjonalny

**Kroki:**
1. Kliknij "Edytuj" na fiszce
2. Zmień `front`: "Stolica Polski?" → "Jaka jest stolica Polski?"
3. Kliknij "Zapisz"

**Oczekiwany rezultat:**
- Request do `/api/flashcards/:id` (PATCH)
- Status 200
- Fiszka zaktualizowana w bazie
- Zmiana widoczna natychmiast
- Toast: "Fiszka zaktualizowana"

---

#### TC-FLASH-006: Usuwanie fiszki
**Priorytet:** Średni  
**Typ:** Funkcjonalny

**Kroki:**
1. Kliknij "Usuń" na fiszce
2. Potwierdź w dialogu

**Oczekiwany rezultat:**
- Request do `/api/flashcards/:id` (DELETE)
- Status 200
- Fiszka usunięta z bazy (hard delete)
- Fiszka znika z listy
- Toast: "Fiszka usunięta"

---

### 4.6 Statystyki

#### TC-STATS-001: Wyświetlanie statystyk overview
**Priorytet:** Średni  
**Typ:** Funkcjonalny

**Warunki wstępne:**
- Użytkownik ma:
  - 50 fiszek active
  - 10 fiszek pending
  - 5 fiszek rejected
  - 3 generation requests

**Kroki:**
1. Przejdź do `/dashboard/stats`

**Oczekiwany rezultat:**
- Request do `/api/statistics/overview`
- Status 200
- Wyświetlone statystyki:
  - Łącznie fiszek: 65
  - Aktywne: 50
  - Oczekujące: 10
  - Odrzucone: 5
  - Fiszki manualne: X
  - Fiszki AI: Y
  - Acceptance rate: (50 / (50+5)) * 100 = ~90.9%
  - Generowań AI: 3
  - Fiszki do powtórki dziś: Z

---

#### TC-STATS-002: Acceptance rate calculation
**Priorytet:** Średni  
**Typ:** Algorytm, Walidacja

**Warunki wstępne:**
- 20 fiszek approved (active)
- 5 fiszek rejected

**Kroki:**
1. Sprawdź `acceptance_rate` w `/api/statistics/overview`

**Oczekiwany rezultat:**
- Formuła: `(approved / (approved + rejected)) * 100`
- Wynik: `(20 / 25) * 100 = 80%`

---

### 4.7 Middleware i autoryzacja

#### TC-MW-001: Blokada dostępu do chronionych endpoint bez tokenu
**Priorytet:** Krytyczny  
**Typ:** Bezpieczeństwo

**Kroki:**
1. Wyślij GET `/api/flashcards` **bez** `Authorization` headera

**Oczekiwany rezultat:**
- Status 401 (Unauthorized)
- Komunikat: "Authentication required"
- Middleware blokuje request przed dotarciem do handlera

---

#### TC-MW-002: Walidacja JWT tokenu
**Priorytet:** Krytyczny  
**Typ:** Bezpieczeństwo

**Scenariusze:**
1. **Ważny token:** Status 200, dostęp przyznany
2. **Wygasły token:** Status 401, "Token expired"
3. **Nieprawidłowy token:** Status 401, "Invalid token"
4. **Brak signature:** Status 401, "Invalid token"

---

#### TC-MW-003: RLS (Row Level Security) - izolacja danych użytkowników
**Priorytet:** Krytyczny  
**Typ:** Bezpieczeństwo, Baza danych

**Warunki wstępne:**
- User A: ID `user-a`, ma fiszki `flashcard-a1`, `flashcard-a2`
- User B: ID `user-b`, ma fiszki `flashcard-b1`

**Kroki:**
1. Zaloguj się jako User A
2. Wyślij GET `/api/flashcards/:flashcard-b1` (fiszka User B)

**Oczekiwany rezultat:**
- Status 404 (Not Found) lub 403 (Forbidden)
- RLS policy w Supabase blokuje dostęp do `flashcard-b1`
- User A widzi tylko swoje fiszki

**Walidacja SQL:**
```sql
-- RLS policy dla flashcards
CREATE POLICY "Users can only see their own flashcards"
  ON flashcards
  FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 5. Środowisko testowe

### 5.1 Środowiska

#### Development (DEV)
- **URL:** `http://localhost:3000`
- **Baza danych:** Supabase Local (Docker)
- **AI:** OpenRouter z test API key
- **Email:** Mock endpoint (`/api/auth/password/mock-reset`)
- **Rate limiting:** In-memory (Map)

#### Staging (QA)
- **URL:** `https://staging.10xCards.com`
- **Baza danych:** Supabase Cloud (test project)
- **AI:** OpenRouter (ograniczony budget)
- **Email:** MailHog lub Supabase Email
- **Rate limiting:** Redis

#### Production (PROD)
- **URL:** `https://10xCards.com`
- **Baza danych:** Supabase Cloud (production project)
- **AI:** OpenRouter (production API key)
- **Email:** Supabase Email (SendGrid/AWS SES)
- **Rate limiting:** Redis
- **CDN:** DigitalOcean Spaces/Cloudflare
- **HTTPS:** Enforced, certyfikaty SSL

### 5.2 Dane testowe

#### Użytkownicy testowi (seeded)
```sql
-- DEV/Staging seed data
INSERT INTO auth.users (email, encrypted_password) VALUES
  ('test@example.com', 'hashed_SecurePass123'),
  ('admin@example.com', 'hashed_AdminPass456'),
  ('user1@example.com', 'hashed_UserPass789');
```

#### Fiszki testowe (fixtures)
- 100 active flashcards (różne interwały: 1, 3, 7, 14 dni)
- 20 pending flashcards (AI generated)
- 10 rejected flashcards
- 50 manual flashcards

#### Generation requests
- 5 completed requests
- 1 failed request
- 1 pending request

---

## 6. Narzędzia do testowania

### 6.1 Backend Testing
- **Vitest:** Unit i integration tests
- **Supertest:** API endpoint testing
- **MSW (Mock Service Worker):** Mockowanie OpenRouter API
- **@supabase/supabase-js:** Test client dla Supabase

### 6.2 Frontend Testing
- **Vitest + Testing Library:** Component tests
- **Playwright:** E2E tests
- **axe-core:** Accessibility testing
- **Storybook:** Component isolation i visual testing

### 6.3 Performance & Load Testing
- **k6:** Load testing, stress testing
- **Lighthouse CI:** Performance metrics (FCP, LCP, TTI)
- **WebPageTest:** Real-world performance

### 6.4 Security Testing
- **OWASP ZAP:** Vulnerability scanning
- **npm audit / Snyk:** Dependency vulnerability scanning
- **Semgrep:** Static code analysis

### 6.5 Database Testing
- **pgTAP:** PostgreSQL unit tests
- **Supabase CLI:** Migration testing, RLS policy testing

### 6.6 CI/CD Integration
- **GitHub Actions:** Automated test execution
- **Codecov:** Code coverage reporting
- **Playwright Report:** E2E test results

---

## 7. Harmonogram testów

### Faza 1: Unit Tests (Tydzień 1-2)
- [ ] Testy serwisów (`AuthService`, `FlashcardService`, etc.)
- [ ] Testy walidatorów Zod
- [ ] Testy algorytmu SM-2
- [ ] Testy rate limiting logic
- [ ] **Cel:** 80% code coverage

### Faza 2: Integration Tests (Tydzień 3)
- [ ] API endpoints + Supabase
- [ ] Middleware + endpoints
- [ ] OpenRouter integration (mocked)
- [ ] Password reset flow (DEV + PROD)

### Faza 3: E2E Tests (Tydzień 4)
- [ ] User journeys (register → generate → study)
- [ ] Password reset flow
- [ ] Flashcard management
- [ ] Study sessions

### Faza 4: Non-functional Tests (Tydzień 5)
- [ ] Performance tests (k6)
- [ ] Security tests (OWASP ZAP)
- [ ] Accessibility tests (axe-core)
- [ ] Responsive tests (różne urządzenia)

### Faza 5: Regression & UAT (Tydzień 6)
- [ ] Regression test suite (automated)
- [ ] User Acceptance Testing (manual)
- [ ] Bug fixing
- [ ] Final sign-off

---

## 8. Kryteria akceptacji testów

### 8.1 Funkcjonalne
- ✅ Wszystkie testy krytyczne (Priority: Critical) zaliczone - **100%**
- ✅ Testy wysokiego priorytetu zaliczone - **min. 95%**
- ✅ Testy średniego priorytetu zaliczone - **min. 90%**

### 8.2 Code Coverage
- ✅ Unit tests: **min. 80%** dla serwisów biznesowych
- ✅ Integration tests: **min. 70%** dla API endpoints
- ✅ E2E tests: **100%** critical user flows

### 8.3 Wydajność
- ✅ API response time: **p95 < 500ms** (bez AI generation)
- ✅ AI generation: **p95 < 5s**
- ✅ Page load (FCP): **< 1.5s**
- ✅ Page load (LCP): **< 2.5s**

### 8.4 Bezpieczeństwo
- ✅ **0** critical vulnerabilities (OWASP ZAP)
- ✅ **0** high severity npm audit issues
- ✅ RLS policies aktywne dla wszystkich tabel
- ✅ Rate limiting działa na wszystkich wrażliwych endpointach

### 8.5 Dostępność
- ✅ Lighthouse Accessibility Score: **min. 90/100**
- ✅ axe-core: **0** critical violations
- ✅ Keyboard navigation: **100%** funkcjonalności dostępne

### 8.6 Responsywność
- ✅ Wszystkie breakpoints testowane: **mobile, tablet, desktop**
- ✅ Touch targets: **min. 44x44px**
- ✅ Zoom 200%: **0** layout breaks

---

## 9. Role i odpowiedzialności

### 9.1 Test Manager
**Odpowiedzialności:**
- Koordynacja planu testów
- Raportowanie statusu testów
- Zarządzanie środowiskiem testowym
- Przegląd wyników testów

### 9.2 QA Engineers
**Odpowiedzialności:**
- Pisanie i wykonywanie testów manualnych
- Tworzenie test cases
- Raportowanie bugów
- Weryfikacja poprawek
- Testy regresyjne

### 9.3 Developers
**Odpowiedzialności:**
- Pisanie unit tests
- Pisanie integration tests
- Fixowanie bugów
- Code review testów
- Utrzymanie test coverage

### 9.4 DevOps
**Odpowiedzialności:**
- Konfiguracja CI/CD pipelines
- Zarządzanie test environments
- Monitoring test infrastructure
- Deployment procesu testowego

---

## 10. Procedury raportowania błędów

### 10.1 Kategorie błędów

#### Severity Levels
- **Critical (S1):** Blokuje kluczową funkcjonalność, brak workaround (np. nie można się zalogować)
- **High (S2):** Poważny błąd, istnieje workaround (np. fiszka nie zapisuje się, można użyć innej metody)
- **Medium (S3):** Błąd funkcjonalny, ale nie blokujący (np. błędny tekst w toaście)
- **Low (S4):** Kosmetyczny błąd (np. nieznaczne problemy z UI)

#### Priority Levels
- **P1:** Fix natychmiast (< 24h)
- **P2:** Fix w bieżącym sprincie (< 1 tydzień)
- **P3:** Fix w następnym sprincie (< 2 tygodnie)
- **P4:** Backlog (rozważyć w przyszłości)

### 10.2 Format raportu błędu

```markdown
## Bug ID: BUG-001

**Tytuł:** Nie można zalogować się po resecie hasła w trybie DEV

**Severity:** Critical (S1)
**Priority:** P1
**Środowisko:** DEV (localhost:3000)
**Wersja:** v1.2.3
**Reporter:** Jan Kowalski
**Data:** 2025-10-16

### Opis
Po wykonaniu resetu hasła w trybie DEV, użytkownik nie może zalogować się nowym hasłem.

### Kroki reprodukcji
1. Przejdź do `/reset-password`
2. Użyj DEV test card z emailem: `test@example.com`
3. Ustaw nowe hasło: `NewPass123`
4. Przejdź do `/login`
5. Spróbuj zalogować się nowym hasłem

### Oczekiwany rezultat
Logowanie powinno być pomyślne z nowym hasłem.

### Aktualny rezultat
Status 401, komunikat: "Nieprawidłowy email lub hasło"

### Logi/Screenshots
```
[POST /api/auth/password/update] INFO: Password updated successfully
[POST /api/auth/login] ERROR: Invalid credentials
```

### Potencjalna przyczyna
Hasło nie jest faktycznie zapisywane w bazie w trybie DEV (tylko symulowane).

### Dodatkowe informacje
- Browser: Chrome 118
- OS: Windows 11
- Supabase version: 2.38.0
```

### 10.3 Workflow raportowania

1. **Discovery:** Tester znajduje błąd podczas wykonywania test case
2. **Verification:** Sprawdzenie czy błąd jest reprodukowalny
3. **Search duplicates:** Sprawdzenie czy bug nie został już zgłoszony
4. **Create report:** Utworzenie raportu w GitHub Issues
5. **Triage:** Test Manager przypisuje severity/priority
6. **Assignment:** Przypisanie do developera
7. **Fix:** Developer naprawia błąd, tworzy PR
8. **Verification:** Tester weryfikuje poprawkę w QA environment
9. **Close:** Bug zamknięty po pomyślnej weryfikacji

### 10.4 Narzędzia
- **GitHub Issues:** Tracking bugów
- **Labels:** `bug`, `critical`, `high`, `medium`, `low`, `security`, `performance`
- **Milestones:** Grupowanie bugów po sprintach
- **Projects:** Kanban board dla statusu bugów (To Do, In Progress, In Review, Done)

---

## 11. Metryki testowe

### 11.1 Metryki do śledzenia

#### Test Execution Metrics
- **Test Pass Rate:** `(Passed / Total) * 100`
- **Test Failure Rate:** `(Failed / Total) * 100`
- **Test Coverage:** `(Covered Lines / Total Lines) * 100`
- **Defect Density:** `Bugs Found / KLOC`

#### Quality Metrics
- **Defect Removal Efficiency:** `(Bugs Fixed / Bugs Found) * 100`
- **Mean Time to Detect (MTTD):** Średni czas wykrycia bugu
- **Mean Time to Resolve (MTTR):** Średni czas naprawy bugu
- **Reopened Bugs Rate:** `(Reopened / Total Fixed) * 100`

#### Performance Metrics
- **API Response Time:** p50, p95, p99
- **Page Load Time:** FCP, LCP, TTI
- **Database Query Time:** Średni czas query

### 11.2 Raportowanie
- **Daily:** Test execution status (Slack/email)
- **Weekly:** Test summary report (Dashboard)
- **Sprint End:** Comprehensive test report (Confluence/Docs)

---

## 12. Ryzyka i mitigation

### 12.1 Zidentyfikowane ryzyka

#### Ryzyko 1: Brak dostępu do OpenRouter API w CI/CD
**Prawdopodobieństwo:** Średnie  
**Wpływ:** Wysoki  
**Mitigation:**
- Mockowanie OpenRouter w integration tests (MSW)
- Dedykowany test API key z niskim budgetem
- Fallback na cached responses w testach

#### Ryzyko 2: Supabase rate limiting w testach
**Prawdopodobieństwo:** Niskie  
**Wpływ:** Średni  
**Mitigation:**
- Użycie Supabase Local (Docker) w CI
- Throttling test execution
- Parallel execution z connection pooling

#### Ryzyko 3: Flaky E2E tests
**Prawdopodobieństwo:** Wysokie  
**Wpływ:** Średni  
**Mitigation:**
- Retry logic w Playwright (max 3 retries)
- Explicit waits zamiast timeouts
- Stable selectors (data-testid)
- Izolacja test data

#### Ryzyko 4: Brak testowych użytkowników w Supabase Auth
**Prawdopodobieństwo:** Niskie  
**Wpływ:** Wysoki  
**Mitigation:**
- Seed script tworzący test users
- Cleanup po każdym teście
- Dedykowana test database

#### Ryzyko 5: Zmiany w API OpenRouter
**Prawdopodobieństwo:** Niskie  
**Wpływ:** Krytyczny  
**Mitigation:**
- Versioning API calls (`/v1/...`)
- Contract testing
- Monitoring OpenRouter changelog

---

## 13. Podsumowanie

### 13.1 Kluczowe cele testowania

Niniejszy plan testów zapewnia kompleksowe pokrycie wszystkich aspektów aplikacji 10xCards, ze szczególnym naciskiem na:

1. **Bezpieczeństwo autentykacji** - weryfikacja JWT, RLS, rate limiting
2. **Poprawność algorytmu SM-2** - critical dla core value proposition
3. **Integracja z AI (OpenRouter)** - kluczowa funkcjonalność MVP
4. **Funkcjonalność resetowania hasła** - zarówno DEV (mock) jak i PROD (email)
5. **Dostępność i UX** - WCAG 2.1 AA, responsywność

### 13.2 Oczekiwane rezultaty

Po wykonaniu planu testów, aplikacja będzie:
- ✅ **Funkcjonalna** - wszystkie user stories z PRD zaimplementowane i przetestowane
- ✅ **Bezpieczna** - ochrona przed SQL injection, XSS, CSRF, brute-force
- ✅ **Wydajna** - szybkie czasy odpowiedzi, optymalne użycie zasobów
- ✅ **Dostępna** - zgodność z WCAG 2.1 AA
- ✅ **Skalowalna** - gotowa do obsługi rosnącej liczby użytkowników
- ✅ **Zgodna z RODO** - prawidłowe przetwarzanie danych osobowych

### 13.3 Następne kroki

1. **Review planu** z zespołem (dev, QA, product)
2. **Setup test environment** (Supabase Local, test data seeds)
3. **Rozpoczęcie Fazy 1** (Unit Tests) - tydzień 1
4. **Cotygodniowe review** postępów testowania
5. **Continuous improvement** planu na podstawie feedbacku

---

**Dokument zatwierdzony przez:**
- Test Manager: _________________
- Tech Lead: _________________
- Product Owner: _________________

**Data:** 2025-10-16  
**Wersja:** 1.0




