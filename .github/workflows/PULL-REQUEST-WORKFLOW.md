# Pull Request Validation Workflow

## Przegląd

Workflow `pull-request.yml` automatycznie waliduje każdy Pull Request przed mergem do głównych gałęzi (`main`, `master`, `develop`).

## Struktura workflow

```
┌─────────────┐
│    Lint     │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌─────┐ ┌─────┐
│Unit │ │ E2E │ (równolegle)
│Tests│ │Tests│
└──┬──┘ └──┬──┘
   │       │
   └───┬───┘
       │
       ▼
   ┌────────┐
   │Status  │
   │Comment │
   └────────┘
```

## Jobs

### 1. Lint (Sequential)

**Cel:** Sprawdzenie jakości kodu pod kątem standardów kodowania

**Kroki:**
- Checkout kodu
- Setup Node.js 20 z cache npm
- Instalacja zależności (`npm ci`)
- Uruchomienie lintera (`npm run lint`)

**Warunki sukcesu:** Brak błędów lintowania

---

### 2a. Unit Tests (Parallel with E2E)

**Cel:** Uruchomienie testów jednostkowych z pokryciem kodu

**Kroki:**
- Checkout kodu
- Setup Node.js 20 z cache npm
- Instalacja zależności
- Uruchomienie testów z coverage (`npm run test:coverage`)
- Upload coverage do Codecov (z flagą `unit`)
- Upload coverage jako artifacts (7 dni retention)

**Wymaga:** Job `lint` musi zakończyć się sukcesem

**Coverage:**
- Reporter: `v8` (vitest)
- Format: `lcov`, `json`, `html`, `text`
- Output: `./coverage/`

---

### 2b. E2E Tests (Parallel with Unit Tests)

**Cel:** Uruchomienie testów end-to-end na trzech przeglądarkach

**Konfiguracja:**
- **Environment:** `integration` (GitHub Environment)
- **Timeout:** 60 minut
- **Matrix Strategy:** `chromium`, `firefox`, `webkit`
- **fail-fast:** `false` (testy kontynuowane pomimo błędów w jednej przeglądarce)

**Kroki:**
- Checkout kodu
- Setup Node.js 20 z cache npm
- Instalacja zależności
- Instalacja przeglądarek Playwright (zgodnie z matrix)
- Tworzenie pliku `.env.test` ze zmiennymi z secrets
- Uruchomienie testów Playwright dla konkretnej przeglądarki
- Upload raportów Playwright (zawsze, nawet przy błędach)
- Upload wyników testów (zawsze, nawet przy błędach)

**Zmienne środowiskowe (z GitHub Secrets):**
```env
BASE_URL=http://localhost:3000
SUPABASE_URL=${{ secrets.TEST_SUPABASE_URL }}
SUPABASE_KEY=${{ secrets.TEST_SUPABASE_KEY }}
E2E_USERNAME=${{ secrets.E2E_USERNAME }}
E2E_PASSWORD=${{ secrets.E2E_PASSWORD }}
OPENROUTER_API_KEY=mock-key
```

**Artifacts:**
- `playwright-report-{browser}` - Raporty HTML (7 dni)
- `test-results-{browser}` - Wyniki testów (7 dni)

**Wymaga:** Job `lint` musi zakończyć się sukcesem

---

### 3. Status Comment (Final)

**Cel:** Dodanie lub aktualizacja komentarza w PR z podsumowaniem walidacji

**Uruchomienie:** Zawsze (`if: always()`), nawet gdy poprzednie jobs się nie powiodły

**Permissions:** `pull-requests: write`

**Kroki:**

1. **Checkout kodu**

2. **Download coverage artifacts**
   - Pobiera artifacts z job `unit-tests`
   - `continue-on-error: true` (nie blokuje gdy brak artifacts)

3. **Check job statuses**
   - Sprawdza status każdego poprzedniego job'a
   - Ustawia zmienne:
     - `lint_status`
     - `unit_status`
     - `e2e_status`
     - `overall_status` (success/failure)
     - `status_emoji` (✅/❌)

4. **Extract coverage percentage**
   - Parsuje plik `coverage/lcov.info`
   - Oblicza % pokrycia kodu: `(LINES_HIT / LINES_FOUND) * 100`
   - `continue-on-error: true`

5. **Create status comment** (`github-script@v7`)
   - Tworzy sformatowany komentarz z:
     - Emoji statusu (✅ sukces / ❌ błąd)
     - Tabela statusów wszystkich jobs
     - Pokrycie testami jednostkowymi
     - Linki do workflow run, commit, branch
     - Odpowiedni komunikat (sukces/błąd)
   
   - **Logika komentarzy:**
     - Szuka istniejącego komentarza od bota zawierającego "Pull Request Validation Results"
     - Jeśli istnieje → **aktualizuje** (`updateComment`)
     - Jeśli nie istnieje → **tworzy nowy** (`createComment`)

**Wymaga:** Jobs `lint`, `unit-tests`, `e2e-tests` (niezależnie od ich statusu)

---

## Konfiguracja GitHub Secrets

### Wymagane secrets:

| Secret Name | Opis | Przykład |
|-------------|------|----------|
| `TEST_SUPABASE_URL` | URL testowej instancji Supabase | `https://xxx.supabase.co` |
| `TEST_SUPABASE_KEY` | Anon key testowej instancji | `eyJhbGc...` |
| `E2E_USERNAME` | Email testowego użytkownika | `test@example.com` |
| `E2E_PASSWORD` | Hasło testowego użytkownika | `Test123!` |
| `CODECOV_TOKEN` | Token do Codecov (opcjonalny) | `abc123...` |
| `GITHUB_TOKEN` | Token GitHub (automatyczny) | - |

### Konfiguracja GitHub Environment

Należy utworzyć environment o nazwie **`integration`** w ustawieniach repozytorium:

1. Settings → Environments → New environment
2. Nazwa: `integration`
3. Dodaj secrets specyficzne dla środowiska (jeśli inne niż repo-level secrets)

---

## Przykładowy komentarz w PR

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
- **Workflow Run:** [#42](https://github.com/user/repo/actions/runs/123456)
- **Commit:** abc123def456
- **Branch:** `feature/new-functionality`

🎉 Wszystkie sprawdzenia przeszły pomyślnie! PR jest gotowy do przeglądu.
```

---

## Przepływ danych

### Coverage Flow:
```
vitest (test:coverage)
    ↓
coverage/lcov.info
    ↓
├─→ Codecov (codecov-action)
└─→ Artifacts (upload-artifact)
       ↓
    Download (status-comment job)
       ↓
    Parse & Display w komentarzu
```

### E2E Matrix Flow:
```
Playwright Config (chromium, firefox, webkit)
    ↓
Matrix Strategy (3 równoległe joby)
    ↓
Install browsers dla każdej przeglądarki
    ↓
Run tests (--project=${{ matrix.project }})
    ↓
Artifacts: playwright-report-{browser}
```

---

## Troubleshooting

### ❌ E2E tests fail: "supabaseUrl is required"

**Przyczyna:** Brak secrets `TEST_SUPABASE_URL` lub `TEST_SUPABASE_KEY`

**Rozwiązanie:**
1. Sprawdź Settings → Secrets and variables → Actions
2. Dodaj wymagane secrets
3. Upewnij się, że nazwy są dokładnie takie same (case-sensitive!)

---

### ❌ Status comment nie pojawia się

**Przyczyna:** Brak uprawnień do pisania komentarzy

**Rozwiązanie:**
1. Sprawdź Settings → Actions → General → Workflow permissions
2. Ustaw "Read and write permissions"
3. Lub dodaj `permissions: pull-requests: write` w workflow (już jest!)

---

### ⚠️ Coverage upload fails

**Przyczyna:** Brak `CODECOV_TOKEN` lub problem z Codecov

**Rozwiązanie:**
- `fail_ci_if_error: false` już ustawione - nie blokuje workflow
- Dodaj `CODECOV_TOKEN` w secrets jeśli chcesz używać Codecov
- Coverage nadal będzie dostępny w artifacts i komentarzu

---

### ❌ Environment "integration" nie istnieje

**Przyczyna:** Environment nie został utworzony w repo

**Rozwiązanie:**
1. Settings → Environments → New environment
2. Nazwa: `integration`
3. Opcjonalnie: dodaj protection rules lub approval requirements

---

### 🐌 E2E tests są wolne

**Optymalizacja:**

1. **Zmniejsz liczbę przeglądarek w matrix** (testuj tylko chromium):
```yaml
matrix:
  project: [chromium]  # zamiast [chromium, firefox, webkit]
```

2. **Włącz fail-fast** (przerwij przy pierwszym błędzie):
```yaml
strategy:
  fail-fast: true  # zamiast false
```

3. **Zwiększ workers w Playwright** (playwright.config.ts):
```typescript
workers: process.env.CI ? 2 : undefined  // zamiast 1
```

---

## Maintenance

### Aktualizacja wersji Node.js

W 3 miejscach (lint, unit-tests, e2e-tests, status-comment):
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # ← zmień tutaj
```

### Zmiana retention days dla artifacts

```yaml
retention-days: 7  # ← zmień na 30, 60, 90 (max)
```

### Dodanie nowych przeglądarek

```yaml
matrix:
  project: [chromium, firefox, webkit, edge]  # ← dodaj edge
```

(Upewnij się, że przeglądarka jest wspierana przez Playwright)

---

## Integracja z Codecov

### Setup Codecov w projekcie:

1. Zarejestruj repo na [codecov.io](https://codecov.io)
2. Skopiuj token
3. Dodaj `CODECOV_TOKEN` w GitHub Secrets
4. Workflow już skonfigurowany - coverage będzie automatycznie uploadowany

### Flagi coverage:

- `unit` - testy jednostkowe (vitest)
- `e2e` - można dodać jeśli Playwright będzie zbierał coverage

---

## Best Practices

✅ **DO:**
- Używaj dedykowanej bazy testowej dla E2E (nie produkcyjna!)
- Regularnie aktualizuj przeglądarki Playwright
- Monitoruj czas wykonania testów (timeout: 60 min)
- Przechowuj artifacts przynajmniej 7 dni

❌ **DON'T:**
- Nie używaj produkcyjnych credentials w testach
- Nie pushuj plików `.env.test` do repo
- Nie ignoruj failujących testów E2E na konkretnych przeglądarkach
- Nie zwiększaj timeout ponad 90 minut (GitHub limit: 360 min/repo)

---

## Statystyki

**Średni czas wykonania:**
- Lint: ~2 min
- Unit Tests: ~3-5 min
- E2E Tests: ~15-20 min (na przeglądarkę)
- Status Comment: ~30 sek

**Total:** ~30-40 minut dla wszystkich przeglądarek równolegle

**GitHub Actions minutes cost:**
- Dla public repo: **FREE** ✅
- Dla private repo: ~40 min × liczba PR (sprawdź limit w Settings → Billing)

