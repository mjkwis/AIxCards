# Przykładowy komentarz w Pull Request

## Przykład 1: Wszystkie testy przeszły ✅

---

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
- **Workflow Run:** [#42](https://github.com/user/repo/actions/runs/8374653910)
- **Commit:** abc123def456789
- **Branch:** `feature/add-user-authentication`

🎉 Wszystkie sprawdzenia przeszły pomyślnie! PR jest gotowy do przeglądu.

---

## Przykład 2: Błąd w testach jednostkowych ❌

---

## ❌ Pull Request Validation Results

### Status podsumowania
| Job | Status |
|-----|--------|
| Linting | ✅ success |
| Unit Tests | ❌ failure |
| E2E Tests | ✅ success |
| **Overall** | **❌ failure** |

### Pokrycie testami
📊 Unit Test Coverage: **78.23%**

### Szczegóły
- **Workflow Run:** [#43](https://github.com/user/repo/actions/runs/8374653911)
- **Commit:** def456abc789012
- **Branch:** `feature/update-api-client`

⚠️ Niektóre sprawdzenia nie powiodły się. Sprawdź logi powyżej i napraw błędy przed mergem.

---

## Przykład 3: Błąd w lintowaniu ❌

---

## ❌ Pull Request Validation Results

### Status podsumowania
| Job | Status |
|-----|--------|
| Linting | ❌ failure |
| Unit Tests | ⏭️ skipped |
| E2E Tests | ⏭️ skipped |
| **Overall** | **❌ failure** |

### Pokrycie testami
📊 Coverage data not available

### Szczegóły
- **Workflow Run:** [#44](https://github.com/user/repo/actions/runs/8374653912)
- **Commit:** ghi789jkl012345
- **Branch:** `fix/code-style-issues`

⚠️ Niektóre sprawdzenia nie powiodły się. Sprawdź logi powyżej i napraw błędy przed mergem.

---

## Przykład 4: Błąd w E2E na jednej przeglądarce ❌

---

## ❌ Pull Request Validation Results

### Status podsumowania
| Job | Status |
|-----|--------|
| Linting | ✅ success |
| Unit Tests | ✅ success |
| E2E Tests | ❌ failure |
| **Overall** | **❌ failure** |

### Pokrycie testami
📊 Unit Test Coverage: **85.12%**

### Szczegóły
- **Workflow Run:** [#45](https://github.com/user/repo/actions/runs/8374653913)
- **Commit:** jkl012mno345678
- **Branch:** `feature/responsive-design`

⚠️ Niektóre sprawdzenia nie powiodły się. Sprawdź logi powyżej i napraw błędy przed mergem.

**Uwaga:** E2E Tests mogą zawierać błędy tylko na konkretnej przeglądarce (np. webkit). 
Sprawdź szczegółowy raport w artifacts:
- `playwright-report-chromium` ✅
- `playwright-report-firefox` ✅
- `playwright-report-webkit` ❌

---

## Przykład 5: Wszystkie testy anulowane ⚠️

---

## ❌ Pull Request Validation Results

### Status podsumowania
| Job | Status |
|-----|--------|
| Linting | ⚠️ cancelled |
| Unit Tests | ⚠️ cancelled |
| E2E Tests | ⚠️ cancelled |
| **Overall** | **❌ failure** |

### Pokrycie testami
📊 Coverage data not available

### Szczegóły
- **Workflow Run:** [#46](https://github.com/user/repo/actions/runs/8374653914)
- **Commit:** mno345pqr678901
- **Branch:** `hotfix/critical-bug`

⚠️ Niektóre sprawdzenia nie powiodły się. Sprawdź logi powyżej i napraw błędy przed mergem.

**Przyczyna:** Workflow został ręcznie anulowany lub przekroczony timeout.

---

## Przykład 6: Niskie pokrycie testami ⚠️

---

## ✅ Pull Request Validation Results

### Status podsumowania
| Job | Status |
|-----|--------|
| Linting | ✅ success |
| Unit Tests | ✅ success |
| E2E Tests | ✅ success |
| **Overall** | **✅ success** |

### Pokrycie testami
📊 Unit Test Coverage: **62.45%** ⚠️

### Szczegóły
- **Workflow Run:** [#47](https://github.com/user/repo/actions/runs/8374653915)
- **Commit:** pqr678stu901234
- **Branch:** `feature/new-analytics`

🎉 Wszystkie sprawdzenia przeszły pomyślnie! PR jest gotowy do przeglądu.

**Uwaga:** Pokrycie testami spadło poniżej 70%. Rozważ dodanie testów dla nowego kodu.

---

## Jak workflow decyduje o statusie?

### Status emoji

```javascript
const getStatusEmoji = (status) => {
  switch(status) {
    case 'success': return '✅';
    case 'failure': return '❌';
    case 'cancelled': return '⚠️';
    case 'skipped': return '⏭️';
    default: return '❓';
  }
};
```

### Overall status

```bash
if [[ "$LINT_STATUS" == "success" && 
      "$UNIT_STATUS" == "success" && 
      "$E2E_STATUS" == "success" ]]; then
  overall_status=success
  status_emoji=✅
else
  overall_status=failure
  status_emoji=❌
fi
```

### Coverage calculation

```bash
LINES_FOUND=$(grep -E "^LF:" coverage/lcov.info | awk -F: '{sum += $2} END {print sum}')
LINES_HIT=$(grep -E "^LH:" coverage/lcov.info | awk -F: '{sum += $2} END {print sum}')
COVERAGE=$(awk "BEGIN {printf \"%.2f\", ($LINES_HIT / $LINES_FOUND) * 100}")
```

---

## Interakcja z komentarzem

### 🔄 Aktualizacja automatyczna

Workflow NIE tworzy nowego komentarza przy każdym pushu. Zamiast tego:

1. **Pierwszy push do PR:**
   - Tworzy nowy komentarz

2. **Kolejne pushe do PR:**
   - Znajduje istniejący komentarz bota
   - Aktualizuje treść tego samego komentarza

**Dzięki temu:** PR pozostaje czytelny, bez spamu od bota.

### 🔍 Jak workflow znajduje istniejący komentarz?

```javascript
const botComment = comments.find(comment => 
  comment.user.type === 'Bot' && 
  comment.body.includes('Pull Request Validation Results')
);
```

### 📝 Ręczna edycja komentarza

⚠️ **Nie edytuj ręcznie komentarza od bota!**

Jeśli edytujesz komentarz ręcznie:
- Następny push **nadpisze** twoje zmiany
- Workflow **nie rozpozna** komentarza (jeśli usuniesz "Pull Request Validation Results")
- Zostanie utworzony **nowy komentarz**

---

## Linki w komentarzu

### Workflow Run
```
[#42](https://github.com/user/repo/actions/runs/8374653910)
```
Prowadzi do: Strona szczegółów workflow run w Actions

**Co zobaczysz:**
- Status wszystkich jobs (Lint, Unit Tests, E2E Tests)
- Logi każdego stepa
- Artifacts do pobrania
- Czas wykonania

### Commit SHA
```
abc123def456789
```
Prowadzi do: Strona commita w GitHub

**Co zobaczysz:**
- Pełny diff zmian
- Commit message
- Files changed
- Komentarze do commita

### Branch
```
`feature/add-user-authentication`
```
Tekst (nie link), pokazuje nazwę branch'a źródłowego PR.

---

## Artifacts dostępne po workflow

Po zakończeniu workflow, w sekcji **Summary** znajdziesz:

### 📦 Artifacts

#### 1. `unit-coverage` (z job: unit-tests)
**Zawiera:**
- `coverage/lcov.info` - Plik LCOV z danymi pokrycia
- `coverage/index.html` - Raport HTML (otwórz w przeglądarce)
- `coverage/coverage-final.json` - JSON z danymi pokrycia

**Jak otworzyć:**
1. Pobierz artifact (ZIP)
2. Rozpakuj
3. Otwórz `coverage/index.html` w przeglądarce
4. Zobacz interaktywny raport z % pokrycia dla każdego pliku

#### 2. `playwright-report-chromium` (z job: e2e-tests)
**Zawiera:**
- `playwright-report/index.html` - Raport HTML testów
- Screenshoty błędów (jeśli były)
- Traces (jeśli były retries)

**Jak otworzyć:**
1. Pobierz artifact (ZIP)
2. Rozpakuj
3. Otwórz `playwright-report/index.html`
4. Zobacz szczegółowe wyniki testów E2E dla Chromium

#### 3. `playwright-report-firefox`
Analogicznie jak chromium, dla Firefox.

#### 4. `playwright-report-webkit`
Analogicznie jak chromium, dla WebKit (Safari).

#### 5. `test-results-{browser}` (dla każdej przeglądarki)
**Zawiera:**
- Screenshoty failujących testów
- Videos failujących testów
- Traces do debugowania w Playwright Trace Viewer

**Jak otworzyć traces:**
```bash
npx playwright show-trace test-results/.../trace.zip
```

---

## FAQ

### Q: Dlaczego komentarz nie pokazuje coverage dla E2E?
**A:** Playwright domyślnie nie zbiera code coverage. To wymaga dodatkowej konfiguracji instrumentation code. Obecnie workflow pokazuje tylko unit test coverage z Vitest.

### Q: Co jeśli chcę inny format komentarza?
**A:** Edytuj sekcję `script:` w job'ie `status-comment`. Możesz zmienić template markdown, dodać emoji, sekcje, etc.

### Q: Czy mogę wyłączyć komentarze?
**A:** Tak, zakomentuj cały job `status-comment` w `pull-request.yml`. Statusy nadal będą widoczne w checks.

### Q: Komentarz pojawia się 2 razy, dlaczego?
**A:** Prawdopodobnie workflow nie znajduje istniejącego komentarza. Sprawdź czy tekst "Pull Request Validation Results" nie został zmieniony.

### Q: Jak zmienić emoji w komentarzu?
**A:** Edytuj funkcję `getStatusEmoji()` w sekcji `script:` lub zmienić `status_emoji` w step'ie `Check job statuses`.

---

## Customizacja komentarza

### Dodanie sekcji "Next Steps":

```javascript
const commentBody = `## ${statusEmoji} Pull Request Validation Results

### Status podsumowania
...

### Next Steps
${overallStatus === 'success' 
  ? '✅ Request review from @team-leads\\n✅ Update documentation if needed' 
  : '❌ Fix failing tests\\n❌ Run tests locally: \`npm run test\` & \`npm run test:e2e\`'}

...
`;
```

### Dodanie linku do Codecov:

```javascript
### Pokrycie testami
${coverage !== 'N/A' 
  ? `📊 Unit Test Coverage: **${coverage}%**
     [View full report on Codecov](https://codecov.io/gh/${context.repo.owner}/${context.repo.repo})` 
  : '📊 Coverage data not available'}
```

### Dodanie tagów dla reviewerów:

```javascript
${overallStatus === 'success' 
  ? '🎉 Wszystkie sprawdzenia przeszły pomyślnie! PR jest gotowy do przeglądu.\\n\\n@reviewer1 @reviewer2 Ready for review!' 
  : '⚠️ Niektóre sprawdzenia nie powiodły się. @author Please fix before requesting review.'}
```

---

**Note:** Ten plik pokazuje przykłady komentarzy. Rzeczywiste komentarze w PR będą generowane automatycznie przez workflow.

