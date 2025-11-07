# Szybka konfiguracja Pull Request Workflow

## Krok 1: Dodaj GitHub Secrets

Przejdź do: **Settings → Secrets and variables → Actions → New repository secret**

Dodaj następujące secrets:

```
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_KEY=eyJhbGc...
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123!
CODECOV_TOKEN=abc123...  (opcjonalny)
```

### Skąd wziąć wartości?

#### `TEST_SUPABASE_URL` i `TEST_SUPABASE_KEY`

**Opcja A: Utwórz dedykowany projekt testowy (ZALECANE)**

1. Przejdź do [supabase.com](https://supabase.com)
2. Utwórz nowy projekt: **"YourApp-Test"**
3. Skopiuj:
   - Project URL → `TEST_SUPABASE_URL`
   - Project API keys → anon/public → `TEST_SUPABASE_KEY`
4. Uruchom te same migracje co na prod (database schema)

**Opcja B: Użyj istniejącego projektu**

⚠️ **Uwaga:** Testy mogą wpłynąć na dane produkcyjne!

```bash
# Z pliku .env
TEST_SUPABASE_URL=$SUPABASE_URL
TEST_SUPABASE_KEY=$SUPABASE_KEY
```

#### `E2E_USERNAME` i `E2E_PASSWORD`

Utwórz dedykowanego użytkownika testowego w Supabase:

1. Supabase Dashboard → Authentication → Users → **Add User**
2. Email: `test@example.com`
3. Password: `TestPassword123!` (lub dowolne bezpieczne hasło)
4. ✅ Auto Confirm User

#### `CODECOV_TOKEN`

1. Zarejestruj się na [codecov.io](https://codecov.io)
2. Dodaj swoje repozytorium
3. Skopiuj **Repository Upload Token**

---

## Krok 2: Utwórz GitHub Environment

Przejdź do: **Settings → Environments → New environment**

1. **Name:** `integration`
2. (Opcjonalnie) **Protection rules:**
   - ✅ Required reviewers: Wybierz reviewerów
   - ✅ Wait timer: np. 5 minut przed uruchomieniem E2E
3. **Environment secrets:** (jeśli chcesz inne niż repo-level)
   - Możesz dodać `TEST_SUPABASE_URL`, etc. specyficzne dla tego środowiska

---

## Krok 3: Włącz permissions dla workflow

Przejdź do: **Settings → Actions → General → Workflow permissions**

Wybierz:
- ✅ **Read and write permissions**

Lub alternatywnie (bardziej restrykcyjne):
- ⚪ **Read repository contents and packages permissions**
- ✅ **Allow GitHub Actions to create and approve pull requests**

---

## Krok 4: (Opcjonalnie) Skonfiguruj Codecov

### W projekcie:

Utwórz `codecov.yml` w root projektu:

```yaml
codecov:
  require_ci_to_pass: yes

coverage:
  precision: 2
  round: down
  range: "70...100"
  
  status:
    project:
      default:
        target: 80%
        threshold: 1%
    patch:
      default:
        target: 80%

comment:
  layout: "header, diff, flags, files"
  behavior: default
  require_changes: false

flags:
  unit:
    paths:
      - src/
    carryforward: true
```

---

## Krok 5: Testowanie lokalnie

Przed pierwszym PR, przetestuj workflow lokalnie:

### 1. Utwórz lokalny plik `.env.test`:

```bash
BASE_URL=http://localhost:3000
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_KEY=eyJhbGc...
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123!
OPENROUTER_API_KEY=mock-key
```

⚠️ **Upewnij się, że `.env.test` jest w `.gitignore`!**

### 2. Uruchom testy lokalnie:

```bash
# Linting
npm run lint

# Unit tests z coverage
npm run test:coverage

# E2E tests (w osobnym terminalu uruchom: npm run dev)
npm run test:e2e
```

### 3. Sprawdź czy coverage działa:

```bash
# Sprawdź czy powstał katalog coverage/
ls -la coverage/

# Sprawdź lcov.info
cat coverage/lcov.info | head -20
```

---

## Krok 6: Pierwszy Pull Request

1. Utwórz branch:
```bash
git checkout -b test-pr-workflow
```

2. Wprowadź drobną zmianę (np. README)

3. Commit i push:
```bash
git add .
git commit -m "test: verify PR workflow"
git push origin test-pr-workflow
```

4. Utwórz Pull Request na GitHub

5. Obserwuj workflow:
   - Przejdź do **Actions tab**
   - Kliknij na najnowszy workflow run
   - Sprawdź każdy job (Lint → Unit Tests / E2E Tests → Status Comment)

6. Sprawdź komentarz w PR:
   - Po zakończeniu wszystkich jobs
   - Powinien pojawić się komentarz z podsumowaniem

---

## Weryfikacja konfiguracji

### ✅ Checklist:

- [ ] Secrets dodane w Settings → Secrets
- [ ] Environment "integration" utworzony
- [ ] Workflow permissions ustawione
- [ ] Plik `.env.test` w `.gitignore`
- [ ] Lokalnie testy przechodzą (`npm run lint`, `npm run test`, `npm run test:e2e`)
- [ ] Pierwszy PR utworzony i workflow działa
- [ ] Komentarz z statusem pojawia się w PR

---

## Troubleshooting

### Problem: "Environment 'integration' not found"

**Rozwiązanie:**
```yaml
# W pliku .github/workflows/pull-request.yml, job e2e-tests
# Usuń lub zakomentuj linię:
# environment: integration

# LUB utwórz environment w Settings → Environments
```

### Problem: Secrets nie są dostępne w workflow

**Sprawdź:**
1. Czy nazwy secrets są dokładnie takie same (case-sensitive)?
2. Czy secrets są na poziomie **repository**, nie organizacji?
3. Czy workflow ma dostęp do secrets? (może być blokowane przez branch protection)

**Debug:**
```yaml
# Dodaj step do debugowania (tylko tymczasowo!):
- name: Debug secrets
  run: |
    echo "SUPABASE_URL exists: ${{ secrets.TEST_SUPABASE_URL != '' }}"
    echo "SUPABASE_KEY exists: ${{ secrets.TEST_SUPABASE_KEY != '' }}"
    # NIE wyświetlaj wartości secrets w logach!
```

### Problem: E2E testy timeout

**Zwiększ timeout:**
```yaml
e2e-tests:
  timeout-minutes: 90  # zamiast 60
```

**Lub zmniejsz liczbę przeglądarek:**
```yaml
matrix:
  project: [chromium]  # tylko jedna przeglądarka
```

### Problem: Status comment nie pojawia się

**Sprawdź:**
1. Czy workflow permissions ustawione na "Read and write"?
2. Czy job `status-comment` się uruchomił? (Actions → workflow run → status-comment)
3. Czy są błędy w logach job'a `status-comment`?

**Fallback (jeśli nadal nie działa):**

Zmień `if: always()` na `if: success() || failure()`:
```yaml
status-comment:
  if: success() || failure()  # zamiast always()
```

---

## Optymalizacja kosztów (private repos)

Jeśli chcesz oszczędzić GitHub Actions minutes:

### 1. Ogranicz przeglądarki do jednej (chromium):
```yaml
matrix:
  project: [chromium]
```

### 2. Uruchamiaj E2E tylko na PR do main/master:
```yaml
on:
  pull_request:
    branches: [main, master]  # usuń 'develop'
```

### 3. Skip testów jeśli tylko dokumentacja:
```yaml
on:
  pull_request:
    branches: [main, master, develop]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

### 4. Użyj self-hosted runners:

Settings → Actions → Runners → New self-hosted runner

(wymaga własnego serwera/VM)

---

## Następne kroki

Po skonfigurowaniu workflow możesz:

1. **Dodać branch protection:**
   - Settings → Branches → Add rule
   - Branch name pattern: `main`
   - ✅ Require status checks to pass
   - Wybierz: `lint`, `unit-tests`, `e2e-tests`

2. **Dodać auto-merge:**
   - Włącz w Settings → General → Pull Requests
   - ✅ Allow auto-merge
   - W PR: Enable auto-merge → Squash and merge

3. **Dodać CODEOWNERS:**
   - Utwórz `.github/CODEOWNERS`
   ```
   * @your-username
   /src/lib/** @backend-team
   ```

4. **Monitoring:**
   - Sprawdzaj regularnie czas wykonania workflow (Actions → Workflows → Pull Request Validation)
   - Monitoruj koszty Actions minutes (Settings → Billing)

---

## Przykładowa konfiguracja branch protection

Settings → Branches → Add rule:

```
Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks:
    - lint
    - unit-tests
    - e2e-tests (chromium)
    - e2e-tests (firefox)
    - e2e-tests (webkit)

☑ Require conversation resolution before merging

☐ Require signed commits (opcjonalnie)

☐ Include administrators (zalecane dla małych zespołów)
```

---

## Pomoc

Jeśli napotkasz problemy:

1. Sprawdź logi workflow w Actions tab
2. Przeczytaj [PULL-REQUEST-WORKFLOW.md](./PULL-REQUEST-WORKFLOW.md) - szczegółowa dokumentacja
3. GitHub Actions docs: https://docs.github.com/en/actions
4. Playwright CI docs: https://playwright.dev/docs/ci

---

**Powodzenia! 🚀**

