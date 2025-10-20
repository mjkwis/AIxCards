# Architektura UI dla AIxCards

## 1. Przegląd struktury UI

Aplikacja AIxCards składa się z publicznych stron (landing, logowanie, rejestracja) oraz chronionego obszaru „Dashboard” z czterema głównymi widokami: Generuj fiszki, Moje fiszki, Sesja nauki i Statystyki. Nawigacja odbywa się przez top navbar (desktop) i drawer (mobile). Interaktywne funkcje realizowane są w komponentach React (wyspy Astro), z zarządzaniem stanem: React Context (auth) i React Query (dane). Architektura zapewnia dostępność (WCAG AA), pełną responsywność (mobile-first) i bezpieczeństwo (JWT, ograniczenia uprawnień, walidacja runtime). W UI wykorzystujemy Shadcn/ui, Tailwind 4 i formularze oparte o React Hook Form + Zod.

## 2. Lista widoków

- Nazwy, ścieżki, cele, informacje, komponenty oraz względy UX/a11y/security przedstawiono dla każdego widoku.

### 2.1 Landing Page
- Nazwa widoku: Landing Page
- Ścieżka widoku: `/`
- Główny cel: Przedstawić wartość produktu i skierować użytkownika do logowania/rejestracji.
- Kluczowe informacje do wyświetlenia:
  - Hero z wartością i CTA (Zaloguj się/Rejestracja)
  - Krótki opis: generowanie fiszek AI, powtórki SM-2
  - Linki pomocnicze (polityka prywatności, kontakt)
- Kluczowe komponenty widoku:
  - Navbar (wersja publiczna), Hero, Feature list, Footer
- UX, dostępność i względy bezpieczeństwa:
  - Kontrast, semantyka (`<main>`, `<nav>`, `<section>`)
  - Duże przyciski CTA, focus ring, klawiaturowa nawigacja
  - Brak wrażliwych danych; brak interakcji z API

### 2.2 Logowanie
- Nazwa widoku: Logowanie
- Ścieżka widoku: `/login`
- Główny cel: Uwierzytelnienie użytkownika i przekierowanie do dashboardu.
- Kluczowe informacje do wyświetlenia:
  - Formularz: email, hasło, link do rejestracji
  - Komunikaty błędów walidacji i uwierzytelnienia
- Kluczowe komponenty widoku:
  - `LoginForm` (React Hook Form + Zod), Button, Input, Toast
  - Powiązane endpointy API: `POST /api/auth/login`
- UX, dostępność i względy bezpieczeństwa:
  - Autouzupełnianie, trim/lowercase email, show/hide hasło
  - ARIA dla błędów (`aria-describedby`), focus management po błędzie
  - Po 401: czytelny komunikat; tokeny zarządzane przez Supabase (httpOnly)

### 2.3 Rejestracja
- Nazwa widoku: Rejestracja
- Ścieżka widoku: `/register`
- Główny cel: Utworzenie konta i zalogowanie użytkownika.
- Kluczowe informacje do wyświetlenia:
  - Formularz: email, hasło, powtórz hasło, checklist wymagań
  - Komunikaty sukcesu/błędów
- Kluczowe komponenty widoku:
  - `RegisterForm` (RHF + Zod), Button, Input, Password requirements
  - Powiązane endpointy API: `POST /api/auth/register`
- UX, dostępność i względy bezpieczeństwa:
  - Live validation, czytelne błędy, focus po submit
  - Hasło: min 8, 1 duża litera, 1 cyfra
  - Po sukcesie: przekierowanie do `/dashboard/generate`

### 2.4 Dashboard (layout chroniony)
- Nazwa widoku: Dashboard (Layout)
- Ścieżka widoku: `/dashboard/*`
- Główny cel: Wspólny układ i nawigacja dla widoków chronionych.
- Kluczowe informacje do wyświetlenia:
  - Navbar z sekcjami: Generuj, Moje fiszki, Sesja nauki, Statystyki
  - Dropdown użytkownika: email, Wyloguj, Usuń konto
- Kluczowe komponenty widoku:
  - `DashboardLayout.astro`, `Navbar.astro` + `UserDropdown` (React)
  - Middleware auth; React Query Devtools (dev)
  - Powiązane endpointy API: `POST /api/auth/logout`, `DELETE /api/auth/account`
- UX, dostępność i względy bezpieczeństwa:
  - Widoczne stany aktywne, klawiaturowa obsługa dropdown
  - Dialog potwierdzenia przy usuwaniu konta
  - Ochrona tras w middleware; przekierowania 401→`/login?redirect=`

### 2.5 Generuj fiszki
- Nazwa widoku: Generuj fiszki
- Ścieżka widoku: `/dashboard/generate`
- Główny cel: Wklejenie tekstu i wygenerowanie propozycji fiszek przez AI, a następnie ich przegląd/akceptacja/odrzucenie/edycja.
- Kluczowe informacje do wyświetlenia:
  - Formularz: textarea 1000–10000 znaków z licznikiem
  - Wyniki generowania: lista fiszek (front/back, status pending)
  - Batch selection + Zatwierdź zaznaczone; historia ostatnich 5 requestów
- Kluczowe komponenty widoku:
  - `GenerationForm`, `GeneratedFlashcardList`, `FlashcardEditor` (modal), Checkbox, Toast, Progress/Spinner, Collapsible „Historia”
  - Powiązane endpointy API: `POST /api/generation-requests`, `GET /api/generation-requests`, `GET /api/generation-requests/:id`, `POST /api/flashcards/:id/approve`, `POST /api/flashcards/:id/reject`, `POST /api/flashcards/batch-approve`
- UX, dostępność i względy bezpieczeństwa:
  - Disabled „Generuj” poza zakresem znaków; stany 429 z countdown/toast
  - Edycja w modalach z focus trap i ESC; aria-live dla wyników
  - Brak wyświetlania niesanitowanego HTML; ograniczenia długości pól

### 2.6 Moje fiszki
- Nazwa widoku: Moje fiszki
- Ścieżka widoku: `/dashboard/flashcards`
- Główny cel: Przeglądanie, filtrowanie, sortowanie, edycja i usuwanie fiszek oraz ręczne tworzenie nowych.
- Kluczowe informacje do wyświetlenia:
  - Taby/filtry: Aktywne | Oczekujące | Odrzucone; Źródło: Wszystkie/AI/Ręczne
  - Sort: Ostatnio dodane (domyślnie), Najstarsze, Najbliższa powtórka, A–Z
  - Grid kart (2–3 kol. desktop, 1 mobile); paginacja 20/s.
- Kluczowe komponenty widoku:
  - `FlashcardList`, `FlashcardCard`, `FlashcardEditor` (modal), `CreateFlashcardModal`, Filters/Tabs, SortDropdown, Pagination, Toast, Skeleton
  - Powiązane endpointy API: `GET /api/flashcards`, `GET /api/flashcards/:id`, `PATCH /api/flashcards/:id`, `DELETE /api/flashcards/:id`, `POST /api/flashcards`
- UX, dostępność i względy bezpieczeństwa:
  - Optimistic updates dla approve/reject/delete; undo (opcjonalnie)
  - Klawiaturowa obsługa kart i dialogów; czytelne badge status/source
  - Potwierdzenie usuwania; walidacja długości front/back

### 2.7 Sesja nauki
- Nazwa widoku: Sesja nauki
- Ścieżka widoku: `/dashboard/study`
- Główny cel: Przeprowadzenie sesji powtórkowej na bazie algorytmu SM-2 (przegląd, flip, ocena 0–5).
- Kluczowe informacje do wyświetlenia:
  - Liczba fiszek do powtórki; pasek postępu X/Y
  - Karta: „Pytanie” → flip → „Odpowiedź”; przyciski ocen 0–5
  - Zakończ sesję; ekran podsumowania
- Kluczowe komponenty widoku:
  - `StudyCard` (flip), `QualityRating` (0–5), `ProgressBar`, `SessionSummary`, Toast
  - Powiązane endpointy API: `GET /api/study-sessions/current`, `POST /api/study-sessions/review`
- UX, dostępność i względy bezpieczeństwa:
  - Duże przyciski (min 44×44), skróty klawiszowe, focus visible
  - Animacja flip (0.6s), płynny progress; brak background refetch w trakcie
  - Odporność na utratę fiszki (usunięta/zmieniona): bezpieczne przejście do kolejnej

### 2.8 Statystyki
- Nazwa widoku: Statystyki
- Ścieżka widoku: `/dashboard/stats`
- Główny cel: Prezentacja postępów i metryk (przegląd, AI vs manual, acceptance rate, aktywność).
- Kluczowe informacje do wyświetlenia:
  - Przegląd: total, active, due today, reviews completed
  - AI vs Manual: pie chart + liczby
  - Acceptance rate: circular progress + breakdown
  - Ostatnia aktywność: timeline 7 dni
- Kluczowe komponenty widoku:
  - `OverviewStats`, `AcceptanceRateChart`, `PieChart`, `ActivityTimeline`, Skeleton
  - Powiązane endpointy API: `GET /api/statistics/overview`, `GET /api/statistics/generation`
- UX, dostępność i względy bezpieczeństwa:
  - Opisy dla czytników ekranu; kolory + etykiety (nie tylko kolor)
  - Lazy load/`client:idle` dla wykresów; responsywne karty
  - Brak wrażliwych danych, ograniczony zakres czasowy (MVP)

### 2.9 Ekrany błędów i stany brzegowe (globalne)
- 401/403: przekierowanie do `/login?redirect=` + toast „Sesja wygasła”
- 404: komunikat i link do dashboardu
- 429: toast z countdown, blokada przycisków, tooltip
- Timeout/retry: informacja i akcje ponów/anuluj; skeletony i spinnery

## 3. Mapa podróży użytkownika

- Główny scenariusz (MVP):
  1) Rejestracja → 2) Logowanie → 3) Generowanie fiszek → 4) Przegląd/edycja/akceptacja → 5) Sesja nauki → 6) Statystyki

- Szczegóły krok po kroku:
  1. Rejestracja: `/register` (walidacja, success → autologin → `/dashboard/generate`).
  2. Logowanie: `/login` (po 401 z middleware, `?redirect=` przywraca docelową trasę).
  3. Generowanie: wklejenie tekstu (1000–10000), submit → loader/progress → lista fiszek pending; edycja inline (modal), approve/reject pojedynczo lub batch; toast potwierdzający.
  4. Moje fiszki: przegląd filtrowany/sortowany; edycja/usuwanie; ręczne tworzenie (modal); natychmiastowe odświeżenie cache (optimistic updates).
  5. Sesja nauki: pobranie due (`GET /api/study-sessions/current`), flip, ocena 0–5 (`POST /review`), progress; zakończenie i ekran podsumowania.
  6. Statystyki: przegląd metryk (cache 5 min), możliwość powrotu do nauki/generowania.

- Odchylenia i edge cases:
  - 429 podczas generowania: odliczanie i blokada; sugestia powrotu do „Moje fiszki”/„Sesja nauki”.
  - Brak fiszek do nauki: empty state + CTA do generowania lub tworzenia ręcznego.
  - Usunięcie konta: dialog z ostrzeżeniem i checkboxem; po sukcesie → landing.

- Odwzorowanie historyjek PRD (US-001…US-009):
  - US-001 Rejestracja → widok Rejestracja (`POST /api/auth/register`)
  - US-002 Logowanie → widok Logowanie (`POST /api/auth/login`), redirect do `/dashboard/generate`
  - US-003 Generowanie AI → widok Generuj fiszki (`POST /api/generation-requests`)
  - US-004 Przegląd i zatwierdzanie → wyniki generowania + `POST /api/flashcards/:id/approve|reject`, `POST /api/flashcards/batch-approve`
  - US-005 Edycja fiszek → widoki Generuj/Flashcards (modal), `PATCH /api/flashcards/:id`
  - US-006 Usuwanie fiszek → widok Moje fiszki, `DELETE /api/flashcards/:id`
  - US-007 Ręczne tworzenie → widok Moje fiszki (modal), `POST /api/flashcards`
  - US-008 Sesja nauki → widok Sesja nauki, `GET /api/study-sessions/current`, `POST /api/study-sessions/review`
  - US-009 Bezpieczny dostęp → layout Dashboard + middleware + RLS (ochrona tras, 401/403)

## 4. Układ i struktura nawigacji

- Top navbar (desktop): logo (link do `/dashboard/generate` lub `/`), linki: Generuj fiszki, Moje fiszki, Sesja nauki, Statystyki; dropdown użytkownika (email, Wyloguj, Usuń konto).
- Mobile: hamburger → pełnoekranowy drawer z tymi samymi sekcjami; focus trap i zamknięcie ESC.
- Oznaczanie aktywnej sekcji (underline/highlight), stany hover/focus.
- URL i ochrona tras: `/dashboard/*` za middleware; publiczne: `/`, `/login`, `/register`.

## 5. Kluczowe komponenty

- Nawigacja i layout:
  - `Navbar.astro` (public/protected warianty), `DashboardLayout.astro`, `UserDropdown`, `MobileDrawer`
- Formularze i dialogi:
  - `LoginForm`, `RegisterForm`, `GenerationForm`, `CreateFlashcardModal`, `FlashcardEditor`, `ConfirmDialog`
- Fiszki i listy:
  - `FlashcardCard`, `FlashcardList`, `GeneratedFlashcardList`, `FiltersTabs`, `SortDropdown`, `Pagination`
- Sesja nauki:
  - `StudyCard` (flip), `QualityRating` (0–5), `ProgressBar`, `SessionSummary`
- Statystyki:
  - `OverviewStats`, `AcceptanceRateChart`, `PieChart`, `ActivityTimeline`
- Systemowe:
  - `ToastProvider`, `ErrorBoundary`, `Skeleton`, `Spinner`, `RateLimitNotice`
- Integracje i stan:
  - React Context (auth), React Query (cache, mutations, optimistic updates), axios client z interceptorami
- A11y i bezpieczeństwo (przekrojowo):
  - Focus management, aria-live dla toasts i wyników, role/label na ikonach
  - Walidacja danych (Zod) i limity pól, brak `dangerouslySetInnerHTML`, CSP
