# GitHub Secrets Configuration

Ten dokument opisuje jak skonfigurować GitHub Secrets wymagane do działania workflow CI/CD.

## Wymagane Secrets

### Build Workflow (`build.yml`)

Workflow dla testów jednostkowych i builda wymaga następujących secrets:

| Secret Name | Opis | Gdzie znaleźć |
|-------------|------|---------------|
| `SUPABASE_URL` | URL twojego projektu Supabase | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_KEY` | Anon/Public key Supabase | Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public` |
| `OPENROUTER_API_KEY` | Klucz API OpenRouter | https://openrouter.ai/ → Keys |

### E2E Tests Workflow (`e2e.yml`)

Workflow dla testów E2E wymaga następujących secrets:

| Secret Name | Opis | Gdzie znaleźć |
|-------------|------|---------------|
| `TEST_SUPABASE_URL` | URL testowej instancji Supabase | Supabase Dashboard → Project Settings → API → Project URL |
| `TEST_SUPABASE_KEY` | Anon key testowej instancji Supabase | Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public` |
| `E2E_USERNAME` | Email testowego użytkownika | Utwórz testowego użytkownika w Supabase Auth |
| `E2E_PASSWORD` | Hasło testowego użytkownika | Hasło użyte przy tworzeniu testowego użytkownika |

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

**Opcja 2: Ten sam projekt z testowymi użytkownikami**
- Utwórz dedykowanych użytkowników testowych
- Używaj prefixów w emailach (np. `test-*@example.com`)
- Ryzyko: testy mogą wpłynąć na dane produkcyjne

### Bezpieczeństwo

- ⚠️ **NIGDY** nie commituj plików `.env` do repozytorium
- ⚠️ Nie udostępniaj `SUPABASE_SERVICE_ROLE_KEY` w GitHub Secrets (ma pełny dostęp do bazy)
- ✅ Używaj tylko `anon` key dla testów E2E
- ✅ Dla testów E2E możesz użyć mock key dla OpenRouter (`OPENROUTER_API_KEY=mock-key`)

### Testowanie konfiguracji

Po dodaniu secrets:

1. Sprawdź czy `.env.test` jest w `.gitignore` ✅
2. Utwórz lokalny plik `.env.test` bazując na `.env.test.example`
3. Uruchom testy lokalnie: `npm run test:e2e`
4. Jeśli działają lokalnie, push do repozytorium uruchomi workflow

## Troubleshooting

### "supabaseUrl is required" podczas testów E2E

**Przyczyna:** Brak zmiennych środowiskowych dla Supabase

**Rozwiązanie:**
1. Sprawdź czy dodałeś wszystkie wymagane secrets do GitHub
2. Sprawdź czy nazwy secrets są dokładnie takie jak w workflow (wielkie litery!)
3. Sprawdź czy workflow używa właściwych nazw w sekcji `env:`

### Testy jednostkowe nie przechodzą w CI

**Przyczyna:** Brak zmiennych środowiskowych podczas budowania

**Rozwiązanie:**
- Dodaj wymagane secrets (`SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`) do GitHub
- Upewnij się, że są przekazane w sekcji `env:` w kroku `Build application`

## Struktura plików env

```
.env                    # Lokalne zmienne środowiskowe (GIT IGNORED)
.env.example            # Szablon dla .env (commited do repo)
.env.test               # Zmienne dla testów E2E lokalnie (GIT IGNORED)
.env.test.example       # Szablon dla .env.test (commited do repo)
```

## Dodatkowe informacje

- Build workflow uruchamia się przy pushu/PR do `main` i `master`
- E2E workflow uruchamia się przy pushu/PR do `main` i `master`
- E2E testy działają na 3 przeglądarkach: Chromium, Firefox, WebKit
- Raporty z testów są zapisywane jako artifacts przez 30 dni

