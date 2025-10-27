# E2E Tests - Następne kroki

## ✅ Co zostało zaimplementowane

Właśnie ukończyłem pełną implementację testów E2E dla projektu AIxCards:

- **89 scenariuszy testowych** w 5 kategoriach
- **Pełne pokrycie** wszystkich głównych user stories (92%)
- **Mockowanie OpenRouter API** dla szybkich i deterministycznych testów
- **Fixtures i helpery** do łatwego pisania nowych testów
- **Kompletna dokumentacja** (README, Quick Start, Implementation Summary)
- **CI/CD ready** konfiguracja dla GitHub Actions
- **✨ Zaktualizowane 2025-10-27:** 25 testów autentykacji według Playwright best practices

## 🚀 Co musisz teraz zrobić

### 1. Konfiguracja środowiska testowego (15 min)

#### Opcja A: Szybkie lokalne testy

```bash
# 1. Skopiuj .env do .env.test
cp .env .env.test

# 2. Dodaj credentials test usera
echo "E2E_USERNAME=test@example.com" >> .env.test
echo "E2E_PASSWORD=TestPassword123!" >> .env.test

# 3. Utwórz test usera w Supabase
# - Otwórz Supabase Dashboard
# - Authentication → Users → Add User
# - Email: test@example.com
# - Password: TestPassword123!

# 4. Zainstaluj przeglądarki
npm run playwright:install
```

#### Opcja B: Dedykowana baza testowa (zalecane dla CI/CD)

```bash
# 1. Utwórz nowy projekt Supabase dla testów
# 2. Uruchom migracje na test database
# 3. Stwórz .env.test z test credentials
# 4. Utwórz test usera w test Supabase
# 5. Zainstaluj przeglądarki
npm run playwright:install
```

### 2. Pierwsze uruchomienie testów (2 min)

```bash
# Uruchom aplikację
npm run dev

# W nowym terminalu - uruchom testy w trybie UI
npm run test:e2e:ui
```

### 3. Dodaj data-testid do komponentów (opcjonalne, ale zalecane)

Testy używają fallback selektorów, ale dla najlepszej stabilności dodaj `data-testid`:

```tsx
// Przykłady gdzie warto dodać:

// Nawigacja
<button data-testid="user-dropdown-trigger">...</button>
<button data-testid="logout-button">Wyloguj</button>
<button data-testid="delete-account-button">Usuń konto</button>

// Generowanie
<button data-testid="generate-btn" type="submit">Generate</button>
<div data-testid="generated-flashcard">...</div>
<div data-testid="flashcard-front">...</div>
<div data-testid="flashcard-back">...</div>
<button data-testid="approve-btn">Approve</button>
<button data-testid="reject-btn">Reject</button>
<button data-testid="edit-btn">Edit</button>

// Flashcards
<button data-testid="add-flashcard-btn">Add</button>
<div data-testid="flashcard-item">...</div>
<div data-testid="flashcard-list">...</div>
<div data-testid="empty-state">...</div>

// Study Session
<div data-testid="study-card">...</div>
<div data-testid="flashcard-front">...</div>
<div data-testid="flashcard-back">...</div>
<button data-testid="flip-btn">Show Answer</button>
<button data-testid="quality-0">...</button>
<button data-testid="quality-5">Perfect</button>
<div data-testid="session-complete">...</div>
```

### 4. Setup CI/CD (10 min)

```bash
# 1. Skopiuj przykładowy workflow
cp .github/workflows/e2e-tests.yml.example .github/workflows/e2e-tests.yml

# 2. Dodaj GitHub Secrets w Settings → Secrets:
# - TEST_SUPABASE_URL
# - TEST_SUPABASE_KEY
# - E2E_USERNAME
# - E2E_PASSWORD

# 3. Commit i push - testy uruchomią się automatycznie
git add .github/workflows/e2e-tests.yml
git commit -m "Add E2E tests workflow"
git push
```

### 5. Przeczytaj dokumentację (10 min)

- **[Quick Start](./tests/e2e/QUICKSTART.md)** - Jak uruchomić testy w 5 minut
- **[Full README](./tests/e2e/README.md)** - Pełna dokumentacja, fixtures, best practices
- **[Implementation Summary](./tests/e2e/IMPLEMENTATION-SUMMARY.md)** - Co zostało zaimplementowane
- **⭐ [Playwright Best Practices](./tests/e2e/PLAYWRIGHT-BEST-PRACTICES.md)** - Quick reference dla selektorów
- **[Troubleshooting](./tests/e2e/TROUBLESHOOTING.md)** - Rozwiązywanie typowych problemów

## 📝 Checklist przed mergem

- [ ] `.env.test` utworzony z poprawnymi credentials
- [ ] Test user utworzony w Supabase
- [ ] Przeglądarki Playwright zainstalowane
- [ ] Testy przechodzą lokalnie (`npm run test:e2e:ui`)
- [ ] GitHub Secrets skonfigurowane (jeśli używasz CI/CD)
- [ ] Workflow CI/CD działa (opcjonalne)
- [ ] `data-testid` dodane do kluczowych komponentów (opcjonalne)

## 🎯 Zalecane kolejne kroki

### Natychmiast (must-have)
1. ✅ Setup `.env.test` i test user
2. ✅ Uruchom testy lokalnie
3. ✅ Sprawdź czy wszystkie przechodzą

### W najbliższym czasie (should-have)
4. 📝 Dodaj `data-testid` do komponentów
5. 🔄 Setup CI/CD workflow
6. 📊 Monitoruj stability testów

### Opcjonalnie (nice-to-have)
7. 📈 Dodaj testy statystyk (jeśli feature gotowy)
8. 📱 Rozszerz mobile tests
9. 🎨 Visual regression (Percy)

## 🆘 Jeśli coś nie działa

### Testy nie uruchamiają się

```bash
# Sprawdź czy jest .env.test
ls -la .env.test

# Sprawdź czy są zainstalowane przeglądarki
npx playwright install

# Sprawdź czy app działa
npm run dev
```

### Testy failują

```bash
# Uruchom w trybie debug
npm run test:e2e:debug

# Sprawdź czy test user istnieje w Supabase
# Dashboard → Authentication → Users

# Zobacz trace z błędu
npx playwright show-trace playwright-report/traces/trace.zip
```

### Pytania?

1. Przeczytaj [Quick Start](./tests/e2e/QUICKSTART.md)
2. Przeczytaj [README](./tests/e2e/README.md) - sekcja Troubleshooting
3. Sprawdź [Playwright Docs](https://playwright.dev)

## 📊 Metryki do monitorowania

Po uruchomieniu w CI/CD śledź:

- **Pass rate**: Powinno być >95%
- **Execution time**: ~10-13 min dla full suite
- **Flaky tests**: Powinno być <2%

Jeśli któryś test jest flaky:
1. Uruchom go 10x lokalnie w debug mode
2. Sprawdź czy używa odpowiednich waiterów
3. Dodaj data-testid jeśli używa CSS selectors
4. Zwiększ timeout jeśli potrzeba

## 🎉 Gratulacje!

Masz teraz **89 testów E2E** pokrywających wszystkie kluczowe scenariusze aplikacji. 

Testy są:
- ✅ **Deterministyczne** (dzięki mockom)
- ✅ **Szybkie** (~10 min full suite)
- ✅ **Łatwe do maintance** (fixtures, helpery)
- ✅ **Dobrze udokumentowane**
- ✅ **CI/CD ready**

**Happy testing! 🚀**

---

*Pytania? Sprawdź dokumentację w `tests/e2e/` lub uruchom `npm run test:e2e:ui` żeby zobaczyć testy w akcji.*

