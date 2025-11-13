# 🚀 Quick Start - Testowanie

## Uruchamianie testów lokalnie

### Testy jednostkowe
```bash
npm run test              # Uruchom raz
npm run test:watch        # Tryb watch (auto-reload)
npm run test:ui           # Interfejs graficzny
npm run test:coverage     # Z pokryciem kodu
```

### Testy E2E
```bash
# Przygotowanie (tylko pierwszy raz)
npm run playwright:install

# Uruchomienie
npm run test:e2e          # Wszystkie przeglądarki
npm run test:e2e:ui       # Interfejs graficzny
npm run test:e2e:headed   # Z widoczną przeglądarką
npm run test:e2e:debug    # Tryb debugowania
```

## ⚙️ Konfiguracja (pierwszy raz)

### Testy jednostkowe
Działają od razu - nie wymagają konfiguracji! ✅

### Testy E2E
Wymagają pliku `.env.test`:

```bash
# 1. Skopiuj plik przykładowy
copy .env.test.example .env.test

# 2. Otwórz .env.test i wypełnij wartości
# (użyj tych samych wartości co w .env)

# 3. Uruchom testy
npm run test:e2e
```

## 🔧 CI/CD na GitHub

### Problem: Testy nie przechodzą na GitHubie?

**Rozwiązanie:** Dodaj sekrety do GitHub Actions

1. Otwórz: https://github.com/TWOJE_KONTO/AIxCards/settings/secrets/actions
2. Dodaj wymagane sekrety (szczegóły w `GITHUB-SECRETS-SETUP-INSTRUCTIONS.md`)
3. Zrób push - testy powinny przejść! ✅

## 📊 Status testów

### Lokalnie (zweryfikowane ✅)
- ✅ Testy jednostkowe: 90 passed
- ✅ Testy coverage: 90 passed  
- ✅ Testy E2E: 2 passed

### Na GitHub Actions
- ⏳ Wymaga konfiguracji sekretów (instrukcje powyżej)

## 📚 Więcej informacji

- `GITHUB-SECRETS-SETUP-INSTRUCTIONS.md` - Jak dodać sekrety do GitHub
- `TEST-RESULTS-SUMMARY.md` - Szczegółowe wyniki i analiza
- `.github/SETUP-SECRETS.md` - Pełna dokumentacja sekretów
- `tests/README.md` - Szczegóły o strukturze testów

## 🐛 Problemy?

### Lokalne testy E2E nie działają
```bash
# Upewnij się że:
1. Masz plik .env.test
2. Plik zawiera poprawne wartości SUPABASE_URL i SUPABASE_KEY
3. Zainstalowałeś przeglądarki: npm run playwright:install
```

### Testy w CI nie przechodzą
```bash
# Sprawdź czy dodałeś wszystkie sekrety:
- SUPABASE_URL
- SUPABASE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENROUTER_API_KEY
```

## ✨ Wskazówki

- Używaj `test:watch` podczas developmentu - automatycznie rerunnuje testy
- Używaj `test:ui` dla Vitest lub `test:e2e:ui` dla Playwright - wygodny GUI
- Testy E2E automatycznie startują serwer dev - nie musisz go uruchamiać ręcznie
- Coverage report jest w folderze `coverage/` - otwórz `index.html` w przeglądarce

