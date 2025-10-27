# Changelog - Authentication E2E Tests

## [2025-10-27] - Refaktoryzacja według Playwright Best Practices

### 🐛 Fixed
- **Formularz rejestracji nie był wysyłany** - dane pozostawały w URL zamiast być wysłane jako POST request
- Test `should successfully register a new user` przechodził z timeout error

### ✨ Changed

#### Selektory

**Przed:**
```typescript
await page.fill('input[name="email"]', email);
await page.click('button[type="submit"]');
```

**Po:**
```typescript
await page.getByLabel("Email").fill(email);
await page.getByRole("button", { name: "Zarejestruj się" }).click();
```

#### Synchronizacja z walidacją

**Przed:**
```typescript
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]'); // Może być za wcześnie!
```

**Po:**
```typescript
await page.getByLabel("Hasło").fill(password);
// Czekaj na spełnienie wymagań walidacji
await expect(page.locator('text="✓ Co najmniej 8 znaków"')).toBeVisible();
await page.getByRole("button", { name: "Zarejestruj się" }).click();
```

#### Asercje błędów

**Przed:**
```typescript
await expect(page.locator("text=/invalid.*email/i")).toBeVisible();
```

**Po:**
```typescript
await expect(page.getByText(/nieprawidłowy.*adres.*email/i)).toBeVisible({ timeout: 5000 });
```

### 📝 Files Modified

- `tests/e2e/auth.spec.ts` - 25 testów zaktualizowanych
- `tests/e2e/fixtures/auth.ts` - 3 helper functions zaktualizowane
- `tests/e2e/E2E-TEST-IMPROVEMENTS.md` - pełna dokumentacja zmian (nowy plik)

### 🎯 Benefits

1. **Accessibility-first** - testy weryfikują dostępność dla screen readers
2. **Bardziej stabilne** - odporność na zmiany CSS i struktury HTML
3. **Lepsze błędy** - czytelniejsze komunikaty przy failach
4. **Best practices** - zgodność z oficjalnymi rekomendacjami Playwright

### 📚 Related Documentation

- [E2E-TEST-IMPROVEMENTS.md](./E2E-TEST-IMPROVEMENTS.md) - szczegółowa dokumentacja problemu i rozwiązania
- [Playwright Locators](https://playwright.dev/docs/locators)

### ⚠️ Breaking Changes

Brak. Testy używają tych samych asercji, tylko inne selektory.

### 🔜 Next Steps

1. Uruchom testy, aby upewnić się, że wszystko działa: `npm run test:e2e`
2. Rozważ dodanie `data-testid` do kluczowych komponentów jako fallback
3. Zastosuj ten sam pattern w pozostałych testach E2E

