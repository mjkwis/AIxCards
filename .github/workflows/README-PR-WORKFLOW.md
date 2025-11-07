# Pull Request Workflow - Podsumowanie

## 📋 Co zostało utworzone?

### 1. **pull-request.yml** - Główny workflow
Automatyczna walidacja każdego Pull Requesta z następującymi etapami:
- ✅ Lintowanie kodu
- ✅ Testy jednostkowe z coverage
- ✅ Testy E2E na 3 przeglądarkach (chromium, firefox, webkit)
- ✅ Automatyczny komentarz z podsumowaniem statusu

### 2. **PULL-REQUEST-WORKFLOW.md** - Szczegółowa dokumentacja
Kompletny opis workflow zawierający:
- Diagram przepływu
- Szczegóły każdego job'a
- Konfiguracja secrets i environment
- Troubleshooting
- Best practices
- Optymalizacja wydajności

### 3. **SETUP-PR-WORKFLOW.md** - Przewodnik konfiguracji
Krok po kroku instrukcja setupu zawierająca:
- Dodawanie GitHub Secrets
- Tworzenie Environment
- Konfiguracja permissions
- Testowanie lokalne
- Weryfikacja konfiguracji
- Branch protection setup

---

## 🎯 Kluczowe cechy workflow

### Równoległe wykonanie testów
```
Lint (2 min)
    ↓
┌────────────┬────────────┐
│ Unit Tests │  E2E Tests │ (równolegle)
│  (3-5 min) │ (15-20 min)│
└────────────┴────────────┘
         ↓
   Status Comment
```

**Korzyść:** Oszczędność ~15 minut w porównaniu do sekwencyjnego wykonania

### Inteligentny system komentarzy
- ✅ Jeden komentarz na PR (aktualizowany, nie tworzy spamu)
- ✅ Pokazuje status wszystkich checks
- ✅ Wyświetla % pokrycia kodu testami
- ✅ Linki bezpośrednie do workflow runs

### Zbieranie coverage
- ✅ Unit tests coverage → Codecov + artifacts
- ✅ Automatyczne obliczanie % w komentarzu
- ✅ Historia coverage w Codecov (jeśli skonfigurowany)

### Multi-browser E2E
- ✅ Testy na 3 przeglądarkach równocześnie
- ✅ Osobne raporty dla każdej przeglądarki
- ✅ fail-fast: false (kontynuacja pomimo błędów)

---

## 🔧 Co musisz skonfigurować?

### Minimalna konfiguracja (5 minut):

1. **Dodaj 4 secrets:**
   - `TEST_SUPABASE_URL`
   - `TEST_SUPABASE_KEY`
   - `E2E_USERNAME`
   - `E2E_PASSWORD`

2. **Utwórz environment "integration"**

3. **Włącz workflow permissions**

### Opcjonalna konfiguracja:

4. **Codecov** (jeśli chcesz zewnętrzny dashboard coverage)
   - Dodaj `CODECOV_TOKEN`
   - Utwórz `codecov.yml`

5. **Branch protection** (zalecane)
   - Require status checks: lint, unit-tests, e2e-tests

---

## 📊 Wymagania i zmienne środowiskowe

### Zgodność z playwright.config.ts

Workflow pobiera przeglądarki zgodnie z `playwright.config.ts`:

```typescript
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
  // ... mobile viewports
]
```

```yaml
# W workflow:
matrix:
  project: [chromium, firefox, webkit]
  
# Instalacja:
npx playwright install --with-deps ${{ matrix.project }}
```

### Zgodność z package.json

```json
{
  "scripts": {
    "lint": "eslint .",              // ← używane w job 'lint'
    "test:coverage": "vitest --coverage",  // ← job 'unit-tests'
    "test:e2e": "playwright test"    // ← job 'e2e-tests'
  }
}
```

### Zgodność z vitest.config.ts

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],  // ← lcov dla Codecov
  // ...
}
```

Workflow oczekuje:
- `./coverage/lcov.info` - dla Codecov
- `./coverage/` - jako artifacts

---

## 🚀 Pierwsze użycie

### Scenariusz testowy:

1. **Utwórz branch:**
```bash
git checkout -b feature/test-workflow
```

2. **Wprowadź zmianę:**
```bash
echo "# Test" >> README.md
git add README.md
git commit -m "test: PR workflow"
git push origin feature/test-workflow
```

3. **Utwórz PR:**
   - GitHub → Pull requests → New pull request
   - Base: `main` ← Compare: `feature/test-workflow`
   - Create pull request

4. **Obserwuj workflow:**
   - Actions tab → Pull Request Validation
   - Zobacz każdy job w czasie rzeczywistym

5. **Sprawdź komentarz:**
   - Wróć do PR
   - Przewiń do komentarzy
   - Zobacz podsumowanie statusu

---

## 💡 Przykładowy output

### Status Check w PR:

```
Pull Request Validation

✅ lint                     2m 15s
✅ unit-tests               3m 42s
✅ e2e-tests (chromium)    15m 23s
✅ e2e-tests (firefox)     16m 01s
✅ e2e-tests (webkit)      14m 55s
✅ status-comment            28s

Total: 18m 44s (parallel)
```

### Komentarz w PR:

```markdown
## ✅ Pull Request Validation Results

### Status podsumowania
| Job | Status |
|-----|--------|
| Linting | ✅ success |
| Unit Tests | ✅ success |
| E2E Tests | ✅ success |
| **Overall** | **✅ success** |

### Pokrycie testami
📊 Unit Test Coverage: **87.45%**

### Szczegóły
- **Workflow Run:** [#42](https://github.com/.../runs/123456)
- **Commit:** abc123
- **Branch:** `feature/test-workflow`

🎉 Wszystkie sprawdzenia przeszły pomyślnie! PR jest gotowy do przeglądu.
```

---

## ⚡ Optymalizacja wydajności

### Dla projektów z ograniczonym budżetem Actions minutes:

#### Opcja 1: Tylko chromium (oszczędność ~66%)
```yaml
matrix:
  project: [chromium]  # zamiast [chromium, firefox, webkit]
```

#### Opcja 2: E2E tylko na main branch
```yaml
e2e-tests:
  if: github.base_ref == 'main'  # dodaj warunek
```

#### Opcja 3: Skip na draft PRs
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

e2e-tests:
  if: github.event.pull_request.draft == false
```

#### Opcja 4: Paths filters
```yaml
on:
  pull_request:
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package.json'
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

---

## 🔒 Bezpieczeństwo

### ✅ Co jest bezpieczne:

- **Environment "integration"** - separacja secrets od produkcji
- **Dedykowana baza testowa** - dane testowe oddzielone
- **Mock OpenRouter API** - brak prawdziwych kosztów API
- **fail_ci_if_error: false** dla Codecov - nie blokuje workflow
- **GITHUB_TOKEN** - automatyczny, scope ograniczony do repo

### ⚠️ Uwagi bezpieczeństwa:

- **NIE commituj `.env.test`** do repo (sprawdź `.gitignore`)
- **Użyj TEST_SUPABASE_KEY (anon)**, nie service_role key
- **Użyj dedykowanego użytkownika testowego**, nie prawdziwego konta
- **Regularnie rotuj secrets** (szczególnie po opuszczeniu zespołu członka)

---

## 📈 Monitorowanie

### Metryki do śledzenia:

1. **Czas wykonania workflow:**
   - Actions → Workflows → Pull Request Validation
   - Sprawdzaj trends - czy nie rośnie czas?

2. **Success rate:**
   - Ile % PRs przechodzi wszystkie testy?
   - Jeśli < 80%, może problem z flaky tests

3. **Actions minutes (private repos):**
   - Settings → Billing
   - Sprawdzaj miesięczny usage

4. **Coverage trends:**
   - Codecov dashboard (jeśli skonfigurowany)
   - Czy coverage nie spada?

---

## 🐛 Najczęstsze problemy

### 1. "Environment 'integration' not found"
**Quick fix:** Usuń linię `environment: integration` z job'a `e2e-tests`

### 2. E2E tests timeout after 60 minutes
**Quick fix:** Zwiększ `timeout-minutes: 90` lub ogranicz do `[chromium]`

### 3. Status comment nie pojawia się
**Quick fix:** Settings → Actions → General → "Read and write permissions"

### 4. Coverage pokazuje 0% lub N/A
**Quick fix:** Sprawdź czy `npm run test:coverage` tworzy `coverage/lcov.info`

### 5. Secrets nie są dostępne
**Quick fix:** Sprawdź case-sensitivity nazw secrets (TEST_SUPABASE_URL nie test_supabase_url)

---

## 📚 Kolejne kroki

Po uruchomieniu workflow:

1. **Tydzień 1:** Monitoruj wszystkie PRs, zbieraj feedback od zespołu
2. **Tydzień 2:** Dodaj branch protection rules
3. **Tydzień 3:** Optymalizuj czas wykonania (jeśli > 30 min)
4. **Tydzień 4:** Rozważ dodanie Codecov dashboardów

### Potencjalne rozszerzenia:

- **Performance tests** (Lighthouse CI)
- **Security scanning** (Snyk, OWASP ZAP)
- **Dependency updates** (Dependabot)
- **Auto-merge** dla approved PRs
- **Slack/Discord notifications**

---

## 📖 Dokumentacja

- **PULL-REQUEST-WORKFLOW.md** - Pełna dokumentacja techniczna
- **SETUP-PR-WORKFLOW.md** - Instrukcja konfiguracji krok po kroku
- **README-PR-WORKFLOW.md** - Ten plik (quick reference)

---

## 🤝 Wsparcie

Jeśli masz pytania:

1. Przeczytaj dokumentację (linki powyżej)
2. Sprawdź [GitHub Actions docs](https://docs.github.com/en/actions)
3. Sprawdź [Playwright CI docs](https://playwright.dev/docs/ci)
4. Sprawdź logi workflow w Actions tab

---

**Status:** ✅ Gotowe do użycia

**Wersja:** 1.0

**Ostatnia aktualizacja:** 2025-11-07

---

## Changelog

### v1.0 (2025-11-07)
- ✨ Inicjalna wersja workflow
- ✨ Równoległe wykonanie unit + e2e tests
- ✨ Multi-browser E2E (chromium, firefox, webkit)
- ✨ Automatyczny komentarz z statusem
- ✨ Integracja z Codecov
- ✨ Zbieranie artifacts (reports, coverage)
- 📝 Kompletna dokumentacja

