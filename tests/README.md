# Testing Guide

Ten katalog zawiera wszystkie testy dla projektu 10xCards.

## Struktura katalogów

```
tests/
├── unit/               # Testy jednostkowe
│   ├── components/     # Testy komponentów React
│   └── services/       # Testy serwisów
├── e2e/                # Testy End-to-End
│   ├── fixtures/       # Fixtures dla testów E2E (np. auth)
│   └── helpers/        # Helpery dla testów E2E
├── helpers/            # Współdzielone helpery testowe
│   ├── test-utils.tsx  # Utilities do renderowania komponentów
│   └── mock-data.ts    # Mockowane dane
├── mocks/              # MSW handlers dla mockowania API
└── setup/              # Pliki konfiguracyjne testów
    ├── vitest.setup.ts # Setup dla Vitest
    └── msw.setup.ts    # Setup dla MSW
```

## Uruchamianie testów

### Testy jednostkowe (Vitest)

```bash
# Uruchom wszystkie testy jednostkowe
npm run test

# Uruchom testy w trybie watch
npm run test:watch

# Uruchom testy z UI
npm run test:ui

# Uruchom testy z pokryciem kodu
npm run test:coverage
```

### Testy E2E (Playwright)

```bash
# Najpierw zainstaluj przeglądarki (tylko raz)
npm run playwright:install

# Uruchom testy E2E
npm run test:e2e

# Uruchom testy E2E z UI
npm run test:e2e:ui

# Uruchom testy E2E z widocznymi przeglądarkami
npm run test:e2e:headed

# Debuguj testy E2E
npm run test:e2e:debug
```

**📚 Dokumentacja E2E:**
- [Quick Start Guide](./e2e/QUICKSTART.md) - Szybki start w 5 minut
- [Pełna dokumentacja E2E](./e2e/README.md) - Szczegółowy opis testów, fixtures, i best practices

**Zaimplementowane scenariusze E2E (~80 testów):**
- ✅ Autentykacja (rejestracja, logowanie, reset hasła, wylogowanie, usuwanie konta)
- ✅ Generowanie fiszek AI (happy path, walidacja, zarządzanie, rate limiting)
- ✅ Zarządzanie fiszkami (CRUD, filtrowanie, sortowanie, paginacja)
- ✅ Sesja nauki (start, przebieg, oceny jakości, zakończenie)
- ✅ Dostępność (WCAG 2.1 AA compliance)

## Pisanie testów

### Testy jednostkowe

Testy jednostkowe powinny być umieszczone w katalogu `tests/unit` i mieć rozszerzenie `.test.ts` lub `.test.tsx`.

```typescript
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    // Test implementation
  });
});
```

### Testy komponentów React

Używaj `test-utils.tsx` do renderowania komponentów z providerami:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../helpers/test-utils';
import MyComponent from '../../../src/components/MyComponent';

describe('MyComponent', () => {
  it('should render with providers', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Testy E2E

Testy E2E powinny być umieszczone w katalogu `tests/e2e` i mieć rozszerzenie `.spec.ts`.

```typescript
import { test, expect } from '@playwright/test';

test('should navigate to login page', async ({ page }) => {
  await page.goto('/');
  await page.click('a[href="/login"]');
  await expect(page).toHaveURL('/login');
});
```

### Testowanie dostępności

Używaj helpera `assertNoAccessibilityViolations` do testowania dostępności:

```typescript
import { test, expect } from '@playwright/test';
import { assertNoAccessibilityViolations } from './helpers/accessibility';

test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const violations = await assertNoAccessibilityViolations(page);
  expect(violations).toHaveLength(0);
});
```

## Mockowanie API

### MSW dla testów jednostkowych

Dodaj handlery w `tests/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/endpoint', () => {
    return HttpResponse.json({ data: 'mocked' });
  }),
];
```

### Mockowanie w testach E2E

W testach E2E możesz mockować odpowiedzi API używając Playwright:

```typescript
test('should mock API response', async ({ page }) => {
  await page.route('/api/endpoint', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ data: 'mocked' }),
    });
  });
  
  await page.goto('/');
});
```

## Best Practices

### Testy jednostkowe
- Używaj wzorca Arrange-Act-Assert
- Testuj zachowania, nie implementację
- Używaj `describe` do grupowania powiązanych testów
- Używaj znaczących nazw testów
- Mockuj zależności zewnętrzne

### Testy E2E
- Testuj krytyczne ścieżki użytkownika
- Używaj selektorów semantycznych (role, label)
- Nie testuj szczegółów implementacji
- Czekaj na elementy zamiast używać sleep/timeout
- Grupuj testy logicznie

### Mockowanie
- Mockuj API zewnętrzne (OpenRouter)
- Używaj rzeczywistych danych do testów integracyjnych z Supabase
- Twórz realistyczne mock data
- Resetuj mocki między testami

## Continuous Integration

Testy są automatycznie uruchamiane w CI/CD pipeline przy każdym PR i push do main.

Konfiguracja CI powinna zawierać:
- `npm run test` - testy jednostkowe
- `npm run test:e2e` - testy E2E
- `npm run test:coverage` - raport pokrycia kodu

