# GitHub Secrets Configuration

Ten dokument opisuje jak skonfigurować GitHub Secrets wymagane do działania workflow CI/CD.

## Wymagane Secrets

### Test Workflow (`test.yml`)

Workflow dla testów jednostkowych i E2E wymaga następujących secrets:

| Secret Name | Opis | Gdzie znaleźć | Wymagane dla |
|-------------|------|---------------|--------------|
| `SUPABASE_URL` | URL twojego projektu Supabase | Supabase Dashboard → Project Settings → API → Project URL | Testy jednostkowe i E2E |
| `SUPABASE_KEY` | Anon/Public key Supabase | Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public` | Testy jednostkowe i E2E |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key Supabase | Supabase Dashboard → Project Settings → API → Project API keys → `service_role` | Testy E2E (cleanup) |
| `OPENROUTER_API_KEY` | Klucz API OpenRouter | https://openrouter.ai/ → Keys | Testy jednostkowe i E2E |
| `E2E_USERNAME` | Email testowego użytkownika | Opcjonalny - testy generują automatycznie użytkowników | Testy E2E (opcjonalne) |
| `E2E_PASSWORD` | Hasło testowego użytkownika | Opcjonalne - domyślnie: `TestPassword123!` | Testy E2E (opcjonalne) |
| `CODECOV_TOKEN` | Token do uploadu pokrycia kodu | https://codecov.io/ → Settings → Tokens | Opcjonalne - dla code coverage |

## Jak dodać Secrets do GitHub

1. Przejdź do swojego repozytorium na GitHub
2. Kliknij **Settings** (Ustawienia)
3. W menu bocznym kliknij **Secrets and variables** → **Actions**
4. Kliknij **New repository secret**
5. Wpisz nazwę secret (np. `SUPABASE_URL`)
6. Wpisz wartość
7. Kliknij **Add secret**
8. Powtórz dla wszystkich wymaganych secrets

## Rekomendacje

### Supabase dla testów E2E

**Opcja 1: Osobny projekt testowy (zalecane)**
- Stwórz nowy projekt Supabase dedykowany tylko dla testów
- Użyj darmowego planu
- Dane testowe są odizolowane od produkcji

**Opcja 2: Ten sam projekt z testowymi użytkownikami (używane obecnie)**
- Testy automatycznie generują unikalnych użytkowników z losowymi emailami
- Format: `test-{random}-{timestamp}@test-playwright.local`
- Nie ma ryzyka konfliktów między testami
- Możesz używać tej samej instancji Supabase co development

### Bezpieczeństwo

- ⚠️ **NIGDY** nie commituj plików `.env` do repozytorium
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ma pełny dostęp do bazy - używaj ostrożnie
- ✅ W GitHub Actions przekazuj secrets przez workflow, nie hardcoduj ich
- ✅ Używaj `anon` key dla większości operacji testowych
- ✅ Service role key jest potrzebny tylko dla cleanup operacji w testach

### Testowanie konfiguracji

**Konfiguracja lokalna:**

1. Skopiuj plik `.env.test.example` do `.env.test`:
   ```bash
   cp .env.test.example .env.test
   ```

2. Wypełnij wartości w `.env.test` swoimi danymi testowymi

3. Sprawdź czy `.env.test` jest w `.gitignore` ✅

4. Uruchom testy lokalnie:
   ```bash
   npm run test        # Testy jednostkowe
   npm run test:e2e    # Testy E2E
   ```

**Konfiguracja GitHub Actions:**

1. Dodaj wymagane secrets do GitHub (patrz sekcja "Jak dodać Secrets")

2. Push do repozytorium uruchomi workflow automatycznie

3. Sprawdź logi w zakładce Actions na GitHub

4. Jeśli testy przechodzą lokalnie ale nie w CI, sprawdź czy wszystkie secrets są dodane

## Troubleshooting

### "supabaseUrl is required" podczas testów E2E

**Przyczyna:** Brak pliku `.env.test` lub brak zmiennych środowiskowych dla Supabase

**Rozwiązanie lokalnie:**
1. Upewnij się, że masz plik `.env.test` w głównym katalogu projektu
2. Sprawdź czy plik zawiera `SUPABASE_URL` i `SUPABASE_KEY`

**Rozwiązanie w CI:**
1. Sprawdź czy dodałeś wszystkie wymagane secrets do GitHub
2. Sprawdź czy nazwy secrets są dokładnie takie jak w workflow (wielkie litery!)
3. Sprawdź czy workflow ma krok "Create .env.test file"

### Testy E2E nie mogą połączyć się z serwerem

**Przyczyna:** Nieprawidłowy port lub BASE_URL

**Rozwiązanie:**
- Sprawdź czy `astro.config.mjs` ma ustawiony port: `server: { port: 3000 }`
- Sprawdź czy `playwright.config.ts` używa tego samego portu
- W workflow BASE_URL powinien być: `http://localhost:3000`

### Testy przechodzą lokalnie ale nie w CI

**Przyczyna:** Różnice w konfiguracji środowiska

**Rozwiązanie:**
1. Sprawdź czy wszystkie secrets są dodane do GitHub Actions
2. Sprawdź czy wersja Node.js w workflow (obecnie 20) odpowiada lokalnej
3. Sprawdź logi w GitHub Actions aby znaleźć dokładny błąd
4. Upewnij się że plik `.env.test` jest tworzony w workflow przed uruchomieniem testów

## Struktura plików env

```
.env                    # Lokalne zmienne środowiskowe (GIT IGNORED)
.env.example            # Szablon dla .env (commited do repo)
.env.test               # Zmienne dla testów E2E lokalnie (GIT IGNORED)
.env.test.example       # Szablon dla .env.test (commited do repo)
```

## Dodatkowe informacje

- Test workflow (`test.yml`) uruchamia się przy pushu/PR do `main`, `master` i `develop`
- Workflow zawiera 2 joby: `unit-tests` i `e2e-tests`
- E2E testy domyślnie działają na 5 przeglądarkach: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Raporty z testów Playwright są zapisywane jako artifacts przez 30 dni
- Coverage report jest uploadowany do Codecov (wymaga tokena)
- Testy jednostkowe i E2E działają równolegle (można uruchamiać niezależnie)

