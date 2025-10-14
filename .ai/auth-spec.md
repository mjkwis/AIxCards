### Moduł autentykacji (US-002) – Specyfikacja architektoniczna

Wersja: 1.0
Data: 2025-10-14 (zaktualizowano)
Zakres: Rejestracja, logowanie, wylogowanie, odzyskiwanie hasła (reset), stan sesji, ochrona tras i integracja z istniejącym MVP.
Stack: Astro 5 (SSR), React 19 (formularze interaktywne), TypeScript 5, Tailwind 4, Shadcn/ui, Supabase Auth.

---

## 1. Architektura interfejsu użytkownika

### 1.1. Strony Astro (SSR) i layouty
- `src/layouts/PublicLayout.astro`: Layout stron publicznych (landing, login, register). Zostaje bez zmian strukturalnie. Zawiera montaż React przez `Providers` i brak wymagań sesji.
- `src/layouts/DashboardLayout.astro`: Layout stron chronionych. Już egzekwuje autentykację przez `Astro.locals.user` (wypełniane przez middleware). Pozostaje źródłem prawdy dla SSR ochrony tras dashboardu i przekazuje `initialUser` do `Providers` przez meta.
- Strony publiczne z kontrolą sesji (już istnieją):
  - `src/pages/login.astro` – jeśli sesja istnieje, redirect do `/dashboard/generate`.
  - `src/pages/register.astro` – jw.
  - `src/pages/index.astro` – jw.
- Nowa strona (reset hasła):
  - `src/pages/reset-password.astro` (publiczna): formularz wprowadzania e-maila do otrzymania linku resetu. SSR: gdy zalogowany – redirect do `/dashboard/generate` (spójne z login/register).
  - `src/pages/update-password.astro` (publiczna, dostęp przez link e-mail): formularz ustawienia nowego hasła na podstawie kodu z URL. SSR: jeśli brak wymaganych parametrów lub sesji z kodu, wyświetl komunikat o błędzie i CTA do ponownego wysłania linku.

Uzasadnienie: Strony Astro odpowiadają za SSR redirecty, SEO, i osadzenie dynamicznych formularzy React. Ochrona tras odbywa się w middleware i layoutach, nie w komponentach.

### 1.2. Komponenty React (client-side) – formularze i elementy UI
- Istniejące:
  - `src/components/auth/LoginForm.tsx`: walidacja z Zod na kliencie (email, hasło), integracja z `AuthProvider.login`. Rozszerzenia:
    - Obsługa kodów błędów serwera (INVALID_CREDENTIALS, RATE_LIMIT_EXCEEDED) – przyjazne komunikaty.
    - Link „Nie pamiętasz hasła?” → `/reset-password`.
  - `src/components/auth/RegisterForm.tsx`: walidacja z Zod (siła hasła). Rozszerzenia:
    - Obsługa `EMAIL_ALREADY_REGISTERED`, walidacji długości email (<=255) i błędów 429.
- Nowe:
  - `src/components/auth/ResetPasswordRequestForm.tsx`: input email, walidacja jak w login/register. Po sukcesie komunikat „Jeśli podany email istnieje, wysłaliśmy link resetujący” (bez ujawniania istnienia konta).
  - `src/components/auth/UpdatePasswordForm.tsx`: pola `password`, `confirmPassword`, walidacja siły hasła spójna z backend Zod. Integracja z endpointem `POST /api/auth/password/update` (patrz backend). Obsługa komunikatów po sukcesie (redirect do `/login`).
- Nawigacja:
  - `src/components/navigation/UserDropdown.tsx`: pozostaje. Można dodać link „Ustawienia konta” w przyszłości, ale w MVP niewymagane. Wylogowanie/Usuń konto – bez zmian.

Podział odpowiedzialności:
- Strony Astro: SSR redirecty na podstawie sesji; osadzenie kart/formularzy; minimalna logika (bez wywołań API – poza Supabase `getSession`).
- Formularze React: walidacja natychmiastowa (Zod), UX (aria, focus), wywołania `apiClient`/`AuthProvider` i obsługa błędów; client-side redirect po sukcesie.
- `Providers` + `AuthProvider`: stan użytkownika w SPA fragmentach; spójne z SSR dzięki `initialUser` w layoutach chronionych.

### 1.3. Walidacja i komunikaty błędów (UI)
- Email: RFC, trim, lowercase, max 255 – komunikat „Nieprawidłowy adres email / zbyt długi email”.
- Hasło – przy rejestracji/zmianie: min 8, 1 duża, 1 mała, 1 cyfra, max 128 – lista wymagań z tickami jak w `RegisterForm`.
- Login: pokazuj „Nieprawidłowy email lub hasło” bez rozróżnienia (zapobiega enumeracji).
- Rate limit: „Zbyt wiele prób. Spróbuj ponownie później.”
- Błędy sieci/500: komunikat ogólny i zachowanie idempotentne.

### 1.4. Scenariusze kluczowe
- Użytkownik zalogowany wchodzi na `/login` lub `/register` → SSR redirect do dashboard.
- Użytkownik niezalogowany wchodzi na `/dashboard/*` → middleware + layout redirect do `/login?redirect=...`.
- Po zalogowaniu: redirect do `redirect` z query lub `/dashboard/generate`.
- Reset hasła: wysłanie emaila zawsze kończy się takim samym komunikatem (nie ujawniamy istnienia konta). Ustawienie nowego hasła wymaga poprawnego tokenu (dostarczonego przez Supabase link magiczny / access token).
 - Chronione API: w przypadku braku/nieprawidłowego Bearera endpointy zwracają 401; klient (apiClient) przechwytuje 401 i przekierowuje do `/login` (spełnia wymaganie PRD o przekierowaniu bez zmiany kontraktów API).

---

## 2. Logika backendowa

### 2.1. API – struktura endpointów
Wszystkie endpointy w `src/pages/api/auth/*` (już istnieje część):
- `POST /api/auth/register` – rejestracja (istnieje): walidacja Zod (`RegisterSchema`), `AuthService.register`, cookie `sb-refresh-token` (httpOnly, SameSite=Lax, Secure w PROD), nagłówki rate limit. PUBLIC.
- `POST /api/auth/login` – logowanie (istnieje): `LoginSchema`, rate limit IP+email, `AuthService.login`, cookie jw. PUBLIC.
- `GET /api/auth/account` – pobranie bieżącego użytkownika (NOWY): wymaga JWT w headerze; zwraca 200 `{ user }`.
- `POST /api/auth/logout` – wylogowanie (istnieje): wymaga JWT w headerze; czyści cookie, wywołuje `AuthService.logout`, 204 na sukces.
- `DELETE /api/auth/account` – usunięcie konta (istnieje): wymaga JWT w headerze, używa `supabaseAdmin` do twardego usunięcia i czyści cookie.
- Nowe dla odzyskiwania hasła:
  - `POST /api/auth/password/reset` – przyjmuje `{ email }`, walidacja email, wywołuje `AuthService.sendPasswordResetEmail(email)`, zawsze 200 z komunikatem neutralnym, rate limit (np. 5/h per IP). PUBLIC.
  - `POST /api/auth/password/update` – przyjmuje `{ password }`, działa w kontekście sesji z linku resetującego (Supabase po wejściu w link ustawia sesję w cookies); walidacja hasła, `AuthService.updatePassword(password)`, 204, czyści ewentualne stare sesje zgodnie z Supabase. PUBLIC (wymaga sesji z linku w cookies).

Uwaga: W Supabase reset hasła odbywa się przez `auth.resetPasswordForEmail` (wysyłka) oraz `auth.updateUser({ password })` po otwarciu linku (sesja magic). Endpoint `password/update` pełni rolę bezpiecznego call site po stronie naszego origin (CSRF chroniony przez SameSite=Lax i brak customowych cookie dostępnych JS).

### 2.2. Modele/DTO i typy
- `src/types.ts` – już definiuje `UserDTO`, `SessionDTO`, `ErrorResponse` (używane w UI i API). Dodatkowe typy (jeśli potrzebne):
  - `PasswordResetRequestDTO` { email: string }
  - `PasswordUpdateDTO` { password: string }
  - Zachowujemy kontrakty odpowiedzi: dla reset request – 200 `{ ok: true }`; dla update – 204 bez body.

### 2.3. Walidacja danych wejściowych (Zod)
- `src/lib/validation/auth.ts` – rozszerzyć o:
  - `PasswordResetRequestSchema` z `emailSchema`.
  - `PasswordUpdateSchema` z `passwordSchema`.
- Spójność wymagań między frontendem a backendem (te same zasady i komunikaty, gdzie to możliwe).

### 2.4. Obsługa wyjątków i błędów
- Wzorować się na istniejących endpointach (użycie `errorResponse`).
- Przypadki:
  - Walidacja 400, enumeracja – komunikaty neutralne.
  - Rate limit 429 – nagłówki `X-RateLimit-*`.
  - Błędy Supabase mapowane do kontrolowanych kodów (`LOGIN_FAILED`, `REGISTRATION_FAILED`, `RESET_FAILED`, `UPDATE_FAILED`).
  - Globalny 500 z komunikatem generycznym, log wewnętrzny z `code` i `details`.

### 2.5. SSR i renderowanie zgodnie z `astro.config.mjs`
- `output: "server"` i adapter node standalone – middleware działa dla wszystkich żądań.
- Middleware `src/middleware/index.ts` już tworzy klienta Supabase SSR i pilnuje JWT dla API (Authorization: Bearer) oraz `getSession()` dla SSR stron. Rozszerzenia:
  - Zawęzić whitelistę PUBLIC API wyłącznie do: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/password/reset`, `POST /api/auth/password/update`. Pozostałe trasy w `api/auth/*` (np. `GET /api/auth/account`, `POST /api/auth/logout`, `DELETE /api/auth/account`) są chronione Bearerem.
  - Dla stron `/update-password` zapewnić brak redirectu do loginu – dostępny publicznie (ale nie „dashboard”).
- Strony Astro login/register/index: bez zmian – już implementują redirecty SSR na podstawie sesji z `Astro.locals.supabase.auth.getSession()`.

---

## 3. System autentykacji (Supabase Auth + Astro)

### 3.1. Przepływy
- Rejestracja: `POST /api/auth/register` → `supabase.auth.signUp` → ustawienie httpOnly refresh cookie → UI redirect.
- Logowanie: `POST /api/auth/login` → `supabase.auth.signInWithPassword` → httpOnly refresh cookie → UI redirect.
- Wylogowanie: `POST /api/auth/logout` → `supabase.auth.signOut` → czyszczenie cookie → UI redirect do `/login`.
- Usunięcie konta: `DELETE /api/auth/account` → `supabaseAdmin.auth.admin.deleteUser` → czyszczenie cookie → UI redirect.
- Reset hasła:
  - Żądanie: `POST /api/auth/password/reset` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: <our-update-password-url> })`.
  - Link w emailu kieruje do naszej domeny i Supabase ustanawia tymczasową sesję.
  - Zmiana: `POST /api/auth/password/update` → `supabase.auth.updateUser({ password })` (używa sesji z linku). Po sukcesie opcjonalny logout wszelkich innych sesji; UI redirect do `/login`.

### 3.2. Bezpieczeństwo
- JWT dla API: middleware wymaga `Authorization: Bearer` na wszystkich `/api/*` poza PUBLIC: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/password/reset`, `POST /api/auth/password/update`.
- Sesja SSR: dashboard i strony chronione sprawdzane przez `getSession()` i `Astro.locals.user`.
- Cookies: tylko refresh token w httpOnly, SameSite=Lax, `Secure` w PROD.
- Access token: przechowywany w Supabase (po stronie klienta) i automatycznie dodawany do nagłówka `Authorization: Bearer <access_token>` przez request interceptor w `apiClient` dla wszystkich chronionych wywołań.
- Rate limiting: już istnieje wzorzec – zastosować do resetu hasła (np. 5/h per IP oraz per email, aby ograniczyć nadużycia).
- Neutralne komunikaty dla operacji resetu i logowania (brak enumeracji użytkowników).

### 3.3. Moduły/serwisy i kontrakty
- `src/lib/services/auth.service.ts` – rozszerzyć o:
  - `sendPasswordResetEmail(email: string): Promise<void>` – wywołuje `supabase.auth.resetPasswordForEmail(email, { redirectTo })` i nie ujawnia istnień kont.
  - `updatePassword(password: string): Promise<void>` – wywołuje `supabase.auth.updateUser({ password })` i mapuje błędy.
- `src/lib/validation/auth.ts` – dodać `PasswordResetRequestSchema`, `PasswordUpdateSchema`.
- `src/pages/api/auth/password/reset.ts` – Zod walidacja email, rate limit, AuthService, odpowiedź 200 `{ ok: true }` + nagłówki RL.
- `src/pages/api/auth/password/update.ts` – Zod walidacja hasła, wymaga aktywnej sesji z linku (ale endpoint nie wymaga Bearera – jest częścią `api/auth/*`), 204.

### 3.4. Integracja z UI
- `LoginForm`: dodać link do resetu i obsługę komunikatów 401/429.
- Nowe formularze reset/update wykorzystują `apiClient` (withCredentials: true) – cookies dostarczone przez Supabase po kliknięciu linku z e-maila.
- `apiClient`: dodać request interceptor, który przed wysłaniem żądania pobiera aktualny access token z `supabaseClient.auth.getSession()` i ustawia nagłówek `Authorization: Bearer <token>` dla chronionych tras.
- `AuthProvider`: 
  - `fetchCurrentUser()` wywołuje `GET /api/auth/account` (chronione Bearer) w celu zsynchronizowania stanu użytkownika w SPA.
  - pozostałe metody (login/register/logout/delete) pozostają, ale korzystają z interceptorów dla Bearer.

---

## 4. Kompatybilność i brak regresji
- Nie zmieniamy istniejących endpointów kontraktowo – pozostają kompatybilne z obecnymi formularzami.
- Middleware zachowuje dotychczasowe zasady: dashboard chroniony, API zabezpieczone przez Bearer poza `api/auth/*`.
- Redirecty SSR na stronach publicznych pozostają – spójne UX.
- Nowe ścieżki nie kolidują z obecną nawigacją i nie ingerują w generowanie fiszek, sesję nauki, statystyki.

---

## 5. TODO – implementacja (wysoki poziom)
- Dodać strony: `reset-password.astro`, `update-password.astro` + formularze React.
- Rozszerzyć `auth.service.ts` o reset/update hasła.
- Dodać walidacje w `validation/auth.ts`.
- Utworzyć endpointy: `POST /api/auth/password/reset` oraz `POST /api/auth/password/update` z rate limitingiem (PUBLIC) oraz `GET /api/auth/account` (chronione Bearer).
- Zaktualizować middleware: zawęzić whitelistę PUBLIC do (login, register, password/reset, password/update); `logout` i `account` chronione Bearerem.
- Dodać request interceptor do `apiClient`, który automatycznie dołącza nagłówek `Authorization: Bearer` na podstawie bieżącej sesji Supabase.
- Drobne poprawki UI: link w `LoginForm`, obsługa kodów błędów (401/409/429) w toasts; `AuthProvider.fetchCurrentUser()` używa `GET /api/auth/account`.

---

## 6. Kontrakty API (podsumowanie)
- POST `/api/auth/register` → 201 `{ user, session }` | 400 | 409 | 429 | 500 (PUBLIC)
- POST `/api/auth/login` → 200 `{ user, session }` | 400 | 401 | 429 | 500 (PUBLIC)
- GET `/api/auth/account` → 200 `{ user }` | 401 | 500
- POST `/api/auth/logout` → 204 | 401 | 500 (cookie i tak czyszczone)
- DELETE `/api/auth/account` → 204 | 401 | 500
- POST `/api/auth/password/reset` → 200 `{ ok: true }` | 400 | 429 | 500 (PUBLIC)
- POST `/api/auth/password/update` → 204 | 400 | 401 (jeśli brak sesji z linku) | 500 (PUBLIC)

Uwagi:
- Wszystkie odpowiedzi błędów używają `errorResponse(status, code, message, meta?)`.
- Nagłówki rate limit na trasach limitowanych.

---

## 7. Edge cases i ryzyka
- Link resetu wygasł/wykorzystany: `update` zwróci 401 – UI pokaże prośbę o ponowne wysłanie linku.
- Brak `Secure` w dev: dopuszczalne lokalnie, w PROD włączone przez `import.meta.env.PROD`.
- CSRF: brak niestandardowych cookies dostępnych dla JS; `SameSite=Lax` + POST z samego originu minimalizuje ryzyko.
- DEV_MOCK_AUTH: w dev middleware dopuszcza mock user – reset/update powinny działać tylko w PROD; w DEV można wyłączyć akcje resetu (informacja w UI) lub użyć realnej konfiguracji Supabase.
