# GitHub Actions Workflows

Katalog zawiera wszystkie GitHub Actions workflows dla projektu AIxCards.

## 📁 Struktura

```
.github/workflows/
├── pull-request.yml          # ⭐ Główny workflow dla PR validation
├── test.yml                  # Testy (unit + e2e) - legacy
├── e2e.yml                   # E2E tests standalone
├── build.yml                 # Build verification
├── e2e-tests.yml.example     # Przykład konfiguracji E2E
│
├── README.md                         # Ten plik (overview)
├── README-PR-WORKFLOW.md            # Quick reference dla PR workflow
├── PULL-REQUEST-WORKFLOW.md         # Szczegółowa dokumentacja PR workflow
├── SETUP-PR-WORKFLOW.md             # Przewodnik konfiguracji
└── EXAMPLE-PR-COMMENT.md            # Przykłady komentarzy w PR
```

---

## 🚀 Workflows

### 1. Pull Request Validation ⭐ (NOWY)

**Plik:** `pull-request.yml`

**Trigger:** Pull Request do `main`, `master`, `develop`

**Funkcjonalność:**
- ✅ Lintowanie kodu
- ✅ Testy jednostkowe z coverage
- ✅ Testy E2E na 3 przeglądarkach (równolegle)
- ✅ Automatyczny komentarz w PR z podsumowaniem

**Czas wykonania:** ~30-40 minut (parallel)

**Status:** ✅ Gotowy do użycia

**Dokumentacja:**
- [README-PR-WORKFLOW.md](./README-PR-WORKFLOW.md) - Quick reference
- [PULL-REQUEST-WORKFLOW.md](./PULL-REQUEST-WORKFLOW.md) - Pełna dokumentacja
- [SETUP-PR-WORKFLOW.md](./SETUP-PR-WORKFLOW.md) - Przewodnik setupu

---

### 2. Tests (Legacy)

**Plik:** `test.yml`

**Trigger:** Push/PR do `main`, `master`, `develop`

**Funkcjonalność:**
- Unit tests z coverage → Codecov
- E2E tests (podstawowe)

**Status:** ⚠️ Legacy - rozważ migrację do `pull-request.yml`

---

### 3. E2E Tests Standalone

**Plik:** `e2e.yml`

**Trigger:** Push/PR do `main`, `master`

**Funkcjonalność:**
- E2E tests na 3 przeglądarkach (matrix)
- Upload artifacts (reports, test-results)

**Status:** ✅ Aktywny

---

### 4. Build Verification

**Plik:** `build.yml`

**Trigger:** Push/PR do głównych branchy

**Funkcjonalność:**
- Weryfikacja czy projekt się buduje
- Build z env variables

**Status:** ✅ Aktywny

---

## 🎯 Zalecane użycie

### Dla Pull Requestów (ZALECANE)

Używaj **`pull-request.yml`** - kompleksowy workflow z:
- Automatycznym lintowaniem
- Równoległymi testami (unit + e2e)
- Komentarzem z podsumowaniem w PR

### Dla Push do main/master

Automatycznie uruchomią się:
- `e2e.yml` - E2E verification
- `build.yml` - Build verification

---

## ⚙️ Konfiguracja

### Wymagane GitHub Secrets

Dodaj w: **Settings → Secrets and variables → Actions**

```bash
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_KEY=eyJhbGc...
E2E_USERNAME=test@example.com
E2E_PASSWORD=TestPassword123!
CODECOV_TOKEN=abc123...  # opcjonalny
```

### Wymagane GitHub Environment

Utwórz w: **Settings → Environments**

```
Name: integration
```

### Workflow Permissions

Ustaw w: **Settings → Actions → General → Workflow permissions**

- ✅ Read and write permissions

---

## 📊 Porównanie workflows

| Feature | pull-request.yml | test.yml | e2e.yml |
|---------|------------------|----------|---------|
| Lint | ✅ | ❌ | ❌ |
| Unit Tests | ✅ | ✅ | ❌ |
| E2E Tests | ✅ | ✅ | ✅ |
| Multi-browser | ✅ (3) | ❌ | ✅ (3) |
| Coverage | ✅ | ✅ | ❌ |
| Codecov | ✅ | ✅ | ❌ |
| PR Comment | ✅ | ❌ | ❌ |
| Parallel Jobs | ✅ | ❌ | ❌ |
| Environment | ✅ | ❌ | ❌ |

**Rekomendacja:** Użyj `pull-request.yml` jako głównego workflow dla PRs.

---

## 🔄 Migration Guide

### Z `test.yml` do `pull-request.yml`

#### Krok 1: Przetestuj nowy workflow

1. Utwórz test PR
2. Obserwuj workflow `pull-request.yml`
3. Sprawdź czy wszystko działa

#### Krok 2: Zaktualizuj branch protection

Settings → Branches → Edit rule for `main`

**Usuń:**
- ❌ `unit-tests` (z test.yml)
- ❌ `e2e-tests` (z test.yml)

**Dodaj:**
- ✅ `lint` (z pull-request.yml)
- ✅ `unit-tests` (z pull-request.yml)
- ✅ `e2e-tests (chromium)` (z pull-request.yml)
- ✅ `e2e-tests (firefox)` (z pull-request.yml)
- ✅ `e2e-tests (webkit)` (z pull-request.yml)

#### Krok 3: (Opcjonalnie) Usuń stary workflow

```bash
# Opcja A: Usuń całkowicie
git rm .github/workflows/test.yml

# Opcja B: Zachowaj jako backup
git mv .github/workflows/test.yml .github/workflows/test.yml.backup
```

---

## 📈 Monitoring & Optimization

### Czas wykonania workflows

Sprawdź: **Actions → Workflows → {workflow name}**

**Target times:**
- Lint: < 3 min
- Unit Tests: < 5 min
- E2E Tests (per browser): < 20 min
- Overall PR workflow: < 40 min

**Jeśli dłużej:**
1. Sprawdź bottleneck (który job trwa najdłużej?)
2. Optymalizuj testy (parallelize, reduce timeouts)
3. Cache dependencies (npm cache w setup-node)

### GitHub Actions Minutes (Private Repos)

Sprawdź usage: **Settings → Billing**

**Free tier:** 2000 minutes/month

**Typical usage per PR:**
- `pull-request.yml`: ~40 min
- `e2e.yml`: ~15-20 min (per browser)

**Optimization tips:**
1. Zmniejsz matrix do 1 przeglądarki (chromium)
2. Użyj `paths-ignore` dla dokumentacji
3. Skip E2E na draft PRs

---

## 🐛 Troubleshooting

### "Workflow not running"

**Check:**
1. Czy `.github/workflows/{name}.yml` jest w `main` branch?
2. Czy syntax YAML jest poprawny? (użyj YAML validator)
3. Czy trigger (`on:`) pasuje do eventu? (push vs pull_request)

### "Environment 'integration' not found"

**Solution:**
```yaml
# Opcja A: Utwórz environment w Settings → Environments
# Opcja B: Usuń linię z workflow:
# environment: integration
```

### "Secrets not available"

**Check:**
1. Czy secrets są dodane w Settings → Secrets?
2. Czy nazwy są dokładnie takie same? (case-sensitive!)
3. Czy workflow ma dostęp? (może być restricted przez org policies)

### "Workflow timeout"

**Solution:**
```yaml
# Zwiększ timeout dla konkretnego job'a:
e2e-tests:
  timeout-minutes: 90  # default: 360 (max)
```

---

## 🔐 Security Best Practices

### ✅ DO:

- Używaj dedicated test database (nie production!)
- Rotuj secrets regularnie
- Używaj `anon` key dla Supabase (nie `service_role`)
- Używaj dedykowanych test users
- Ograniczaj permissions do minimum (`pull-requests: write`)

### ❌ DON'T:

- Nie commituj `.env.test` do repo
- Nie loguj secrets w workflow (`echo ${{ secrets.KEY }}`)
- Nie używaj production credentials
- Nie dawaj `write` permissions dla forks (security risk)

---

## 📚 Dodatkowe zasoby

### Dokumentacja

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Playwright CI](https://playwright.dev/docs/ci)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)

### Projekty

- [Codecov](https://codecov.io) - Coverage visualization
- [Playwright](https://playwright.dev) - E2E testing
- [Vitest](https://vitest.dev) - Unit testing

### Nasze docs

- [SETUP-PR-WORKFLOW.md](./SETUP-PR-WORKFLOW.md) - Setup guide
- [PULL-REQUEST-WORKFLOW.md](./PULL-REQUEST-WORKFLOW.md) - Szczegóły workflow
- [EXAMPLE-PR-COMMENT.md](./EXAMPLE-PR-COMMENT.md) - Przykłady komentarzy
- [../CHECKLIST-PR.md](../CHECKLIST-PR.md) - PR checklist

---

## 🤝 Contributing

Jeśli chcesz dodać nowy workflow lub zmodyfikować istniejący:

1. Przetestuj lokalnie (jeśli możliwe)
2. Utwórz PR z opisem zmian
3. Dodaj dokumentację (update ten README)
4. Zaznacz jako draft jeśli jeszcze eksperymentalny

---

## 📞 Support

Potrzebujesz pomocy?

1. **Workflow issues:** Check [PULL-REQUEST-WORKFLOW.md](./PULL-REQUEST-WORKFLOW.md) troubleshooting
2. **Setup issues:** Check [SETUP-PR-WORKFLOW.md](./SETUP-PR-WORKFLOW.md)
3. **Test failures:** Check artifacts in Actions tab
4. **Still stuck:** Create issue lub ask in team chat

---

**Last updated:** 2025-11-07

**Maintainer:** DevOps Team / AI Assistant 🤖

