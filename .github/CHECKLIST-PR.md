# Pull Request Checklist

Użyj tego checklistu przed mergowaniem Pull Requesta.

---

## ✅ Pre-merge Checklist

### 🤖 Automated Checks (przez workflow)

- [ ] **Linting** - Kod spełnia standardy kodowania
- [ ] **Unit Tests** - Wszystkie testy jednostkowe przechodzą
- [ ] **E2E Tests (Chromium)** - Testy end-to-end na Chrome
- [ ] **E2E Tests (Firefox)** - Testy end-to-end na Firefox
- [ ] **E2E Tests (WebKit)** - Testy end-to-end na Safari
- [ ] **Coverage** - Pokrycie testami ≥ 70% (zalecane)

### 👥 Human Review

- [ ] **Code Review** - Co najmniej 1 approval od team member
- [ ] **Documentation** - Aktualizowano dokumentację (jeśli needed)
- [ ] **Changelog** - Dodano entry do CHANGELOG.md (jeśli istnieje)
- [ ] **Breaking Changes** - Oznaczono breaking changes (jeśli applicable)
- [ ] **Conflicts** - Branch jest up-to-date z base branch (no conflicts)
- [ ] **Conversations** - Wszystkie conversations resolved

### 📝 Code Quality

- [ ] **No Debug Code** - Usunięto console.log, debugger, komentarze TODO
- [ ] **No Commented Code** - Usunięto zakomentowany kod
- [ ] **Meaningful Names** - Zmienne i funkcje mają sensowne nazwy
- [ ] **Single Responsibility** - Funkcje robią jedną rzecz
- [ ] **DRY Principle** - Nie ma duplikacji kodu
- [ ] **Error Handling** - Prawidłowa obsługa błędów

### 🧪 Testing

- [ ] **New Tests** - Dodano testy dla nowego kodu
- [ ] **Test Coverage** - Nowy kod pokryty testami ≥ 80%
- [ ] **Edge Cases** - Przetestowano edge cases
- [ ] **Manual Testing** - Przetestowano manualnie w przeglądarce (jeśli UI)

### 🔒 Security

- [ ] **No Secrets** - Brak hardcoded secrets, API keys, passwords
- [ ] **No PII** - Brak Personally Identifiable Information w logach
- [ ] **Input Validation** - Walidacja user input
- [ ] **XSS Protection** - Sanityzacja user-generated content (jeśli applicable)
- [ ] **SQL Injection** - Użycie prepared statements (jeśli applicable)

### 🚀 Performance

- [ ] **No Performance Regression** - Sprawdzono wpływ na performance
- [ ] **Optimized Queries** - Database queries są zoptymalizowane
- [ ] **Lazy Loading** - Używa lazy loading gdzie applicable
- [ ] **Bundle Size** - Sprawdzono wpływ na bundle size (jeśli frontend)

### ♿ Accessibility (jeśli UI changes)

- [ ] **Keyboard Navigation** - Wszystko dostępne z klawiatury
- [ ] **Screen Reader** - Odpowiednie aria-labels
- [ ] **Color Contrast** - Spełnia WCAG 2.1 AA
- [ ] **Focus Indicators** - Widoczne focus indicators

### 📱 Responsiveness (jeśli UI changes)

- [ ] **Mobile** - Działa na mobile devices
- [ ] **Tablet** - Działa na tablets
- [ ] **Desktop** - Działa na desktop

---

## 🔍 Detailed Review Guide

### Code Review Questions

#### Architecture & Design
- Czy rozwiązanie jest zgodne z architekturą projektu?
- Czy zmiany są w odpowiednich miejscach (katalogach)?
- Czy można uprościć rozwiązanie?

#### Readability
- Czy kod jest łatwy do zrozumienia?
- Czy nazwy zmiennych/funkcji są jasne?
- Czy złożone fragmenty mają komentarze wyjaśniające?

#### Maintainability
- Czy kod będzie łatwy do utrzymania?
- Czy zmiany nie wprowadzają tech debt?
- Czy są testy, które ułatwią refactoring w przyszłości?

#### Performance
- Czy nie ma niepotrzebnych obliczeń w pętlach?
- Czy używane są odpowiednie struktury danych?
- Czy nie ma memory leaks (event listeners, subscriptions)?

#### Security
- Czy dane użytkownika są walidowane?
- Czy używamy bezpiecznych API?
- Czy nie ma podatności OWASP Top 10?

---

## 🚦 Status Check Meanings

### ✅ All Checks Passed
**Meaning:** Wszystko działa, kod spełnia standardy

**Action:** 
- Poproś o code review
- Po approval → **Safe to merge**

### ❌ Linting Failed
**Meaning:** Kod nie spełnia standardów formatowania/stylu

**Action:**
```bash
npm run lint:fix  # Automatyczna naprawa
npm run lint      # Sprawdź remaining issues
```

### ❌ Unit Tests Failed
**Meaning:** Testy jednostkowe nie przechodzą

**Action:**
```bash
npm run test              # Zobacz które testy failują
npm run test:ui           # UI mode dla debugowania
npm run test:watch        # Watch mode dla iteracji
```

**Common causes:**
- Błąd w logice kodu
- Nieaktualne testy (po zmianie API)
- Missing mocks
- Race conditions w asynchronicznych testach

### ❌ E2E Tests Failed
**Meaning:** Testy end-to-end nie przechodzą

**Action:**
```bash
npm run test:e2e:headed   # Zobacz test w przeglądarce
npm run test:e2e:debug    # Debug mode
```

**Common causes:**
- Zmienione selektory (data-testid, classes)
- Timing issues (element nie załadowany)
- Breaking change w UI
- Flaky test (losowe faile)

**Check artifacts:**
1. Actions → Workflow run → Scroll down → Artifacts
2. Download `playwright-report-{browser}`
3. Otwórz `index.html` → Zobacz screenshoty błędów

### ⚠️ Tests Cancelled
**Meaning:** Workflow został przerwany

**Possible reasons:**
- Nowy push do tego samego PR (poprzedni workflow cancelled)
- Timeout przekroczony (> 60 min)
- Ręczne anulowanie
- GitHub Actions issue

**Action:**
- Sprawdź logi w Actions
- Re-run workflow (Actions → Re-run all jobs)

### ⏭️ Tests Skipped
**Meaning:** Test job został pominięty

**Reason:** Poprzedni job (lint) failed, więc testy nie uruchomiły się

**Action:** Najpierw napraw lint, potem push again

---

## 📊 Coverage Guidelines

### Coverage Thresholds

| Coverage | Status | Action |
|----------|--------|--------|
| ≥ 90% | 🌟 Excellent | Świetna robota! |
| 80-89% | ✅ Good | Akceptowalne |
| 70-79% | ⚠️ Acceptable | Rozważ dodanie testów |
| < 70% | ❌ Low | Dodaj więcej testów |

### Co testować?

#### ✅ Must Test:
- Business logic
- Utility functions
- Data transformations
- API endpoints
- Critical user flows

#### ⚠️ Should Test:
- UI components (podstawowe scenariusze)
- Error handling
- Edge cases
- Validation logic

#### ⏭️ Can Skip:
- Pure presentational components (tylko HTML/CSS)
- Third-party library wrappers (testowane przez library)
- Configuration files
- Simple type definitions

### Jak poprawić coverage?

```bash
# 1. Zobacz coverage report
npm run test:coverage

# 2. Otwórz HTML report
open coverage/index.html  # macOS
start coverage/index.html # Windows

# 3. Znajdź pliki z niskim coverage (czerwone)

# 4. Dodaj testy dla uncovered lines

# 5. Re-run coverage
npm run test:coverage
```

---

## 🐛 Common Issues & Solutions

### Issue: "E2E tests timing out"

**Solution:**
- Zwiększ timeout w `playwright.config.ts`
- Użyj `page.waitForLoadState('networkidle')`
- Sprawdź czy dev server startuje poprawnie

### Issue: "Flaky E2E tests"

**Solution:**
- Użyj `toHaveText()` zamiast `toBe()` (auto-retry)
- Dodaj explicit waits: `await page.waitForSelector()`
- Unikaj `page.waitForTimeout()` - użyj waits based on state

### Issue: "Coverage dropped after adding new file"

**Solution:**
- Dodaj testy dla nowego pliku
- Lub exclude z coverage (vitest.config.ts → coverage.exclude)

### Issue: "Lint errors only in CI, not locally"

**Solution:**
- Sprawdź czy masz te same wersje dependencies
- Run `npm ci` lokalnie (zamiast `npm install`)
- Sprawdź czy masz pre-commit hooks (husky)

---

## 🎯 Merge Strategies

### Squash and Merge (Zalecane)
**When:** Feature branches, bug fixes

**Pros:**
- Czysta historia (1 commit per feature)
- Łatwe revert całego feature

**Cons:**
- Tracisz historię drobnych commitów

```
feature/add-login (3 commits) → main (1 squashed commit)
```

### Merge Commit
**When:** Ważna historia commitów, hotfixy

**Pros:**
- Zachowuje pełną historię
- Widoczne merge points

**Cons:**
- Brudniejsza historia

```
feature/refactor (5 commits) → main (5 commits + 1 merge commit)
```

### Rebase and Merge
**When:** Linear history preferred

**Pros:**
- Najczystsza historia (linear)
- Brak merge commits

**Cons:**
- Przepisuje historię (zmienia SHA commitów)

```
feature/optimize (2 commits) → main (2 rebased commits)
```

---

## 📋 PR Templates

### Feature PR Template

```markdown
## Description
Brief description of the feature

## Type of Change
- [ ] New feature
- [ ] Enhancement
- [ ] Refactoring

## Changes
- List specific changes
- 

## Testing
- [ ] Unit tests added
- [ ] E2E tests added
- [ ] Tested manually

## Screenshots (if UI)
Before | After
--- | ---
![before](url) | ![after](url)

## Related Issues
Closes #123
```

### Bug Fix PR Template

```markdown
## Bug Description
What was the bug?

## Root Cause
What caused it?

## Fix
How did you fix it?

## Testing
- [ ] Added test to prevent regression
- [ ] Verified fix locally
- [ ] Tested edge cases

## Related Issues
Fixes #456
```

---

## 🔄 Post-Merge Actions

### Immediate (< 5 min)
- [ ] Sprawdź czy deploy się udał (jeśli auto-deploy)
- [ ] Sprawdź error monitoring (Sentry, etc.)
- [ ] Usuń branch (jeśli już nie potrzebny)

### Short-term (< 1 day)
- [ ] Sprawdź metrics/analytics (jeśli applicable)
- [ ] Monitoruj user feedback
- [ ] Aktualizuj documentation (jeśli external docs)

### Long-term (< 1 week)
- [ ] Retrospective: co można poprawić w procesie?
- [ ] Refactoring follow-up (jeśli needed)
- [ ] Tech debt tracking (jeśli introduced)

---

## 🆘 Emergency Hotfix Process

Jeśli MUSISZ zmergować bez pełnego workflow:

### ⚠️ ONLY for critical production bugs!

1. **Create hotfix branch from main**
```bash
git checkout main
git pull
git checkout -b hotfix/critical-bug-description
```

2. **Make minimal fix**
```bash
# Fix the bug
# DON'T add features or refactor
```

3. **Test locally**
```bash
npm run lint
npm run test
npm run test:e2e  # przynajmniej chromium
```

4. **Create PR with label: `hotfix` or `urgent`**

5. **Get expedited review (15 min max)**

6. **Merge ASAP**

7. **Follow up:**
- [ ] Add tests in separate PR
- [ ] Document incident
- [ ] Postmortem (co poszło nie tak?)

---

## 📞 Need Help?

- **Workflow issues:** Check [PULL-REQUEST-WORKFLOW.md](../.github/workflows/PULL-REQUEST-WORKFLOW.md)
- **Setup issues:** Check [SETUP-PR-WORKFLOW.md](../.github/workflows/SETUP-PR-WORKFLOW.md)
- **Test failures:** Check artifacts in Actions tab
- **Still stuck:** Ask in #dev-help channel (or your team chat)

---

**Remember:** Automation jest pomocne, ale human review jest kluczowe! 🧠

**Merge responsibly!** 🚀

