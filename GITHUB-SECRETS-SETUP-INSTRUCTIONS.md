# Instrukcja konfiguracji GitHub Secrets

## 🎯 Co musisz zrobić

Aby testy CI/CD działały na GitHubie, musisz dodać następujące sekrety do swojego repozytorium.

## 📋 Lista wymaganych sekretów

Otwórz swój lokalny plik `.env` i skopiuj z niego następujące wartości:

| Secret Name | Wartość z Twojego `.env` | Czy obowiązkowy? |
|-------------|--------------------------|------------------|
| `SUPABASE_URL` | Wartość z `SUPABASE_URL` | ✅ TAK |
| `SUPABASE_KEY` | Wartość z `SUPABASE_KEY` | ✅ TAK |
| `SUPABASE_SERVICE_ROLE_KEY` | Wartość z `SUPABASE_SERVICE_ROLE_KEY` | ✅ TAK |
| `OPENROUTER_API_KEY` | Wartość z `OPENROUTER_API_KEY` | ✅ TAK |
| `E2E_USERNAME` | `test@example.com` | ❌ Opcjonalny |
| `E2E_PASSWORD` | `TestPassword123!` | ❌ Opcjonalny |
| `CODECOV_TOKEN` | Token z Codecov.io | ❌ Opcjonalny |

## 🔧 Jak dodać sekrety krok po kroku

### 1. Przejdź do ustawień repozytorium

Otwórz swoje repozytorium na GitHub:
```
https://github.com/mjkwis/AIxCards
```

### 2. Otwórz sekcję Secrets

1. Kliknij zakładkę **Settings** (Ustawienia)
2. W menu po lewej stronie znajdź **Secrets and variables**
3. Kliknij **Actions**

### 3. Dodaj każdy sekret

Dla każdego sekretu z tabeli powyżej:

1. Kliknij przycisk **New repository secret**
2. W polu **Name** wpisz dokładną nazwę z tabeli (np. `SUPABASE_URL`)
3. W polu **Secret** wklej wartość z Twojego pliku `.env`
4. Kliknij **Add secret**

### 4. Powtórz dla wszystkich sekretów

Po dodaniu wszystkich sekretów powinieneś zobaczyć listę:
- ✅ SUPABASE_URL
- ✅ SUPABASE_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ OPENROUTER_API_KEY
- (opcjonalnie) E2E_USERNAME
- (opcjonalnie) E2E_PASSWORD
- (opcjonalnie) CODECOV_TOKEN

## 🚀 Test konfiguracji

Po dodaniu sekretów:

1. Zrób commit i push zmian do repozytorium
2. Przejdź do zakładki **Actions** na GitHubie
3. Sprawdź czy workflow się uruchomił
4. Sprawdź czy testy przechodzą (zielony checkmark ✅)

## ❓ Problemy?

Jeśli testy nadal nie przechodzą:

1. Sprawdź czy nazwy sekretów są **DOKŁADNIE** takie jak w tabeli (wielkie litery!)
2. Sprawdź czy nie ma dodatkowych spacji na początku lub końcu wartości
3. Sprawdź logi w zakładce Actions → kliknij na failed test → sprawdź output

## 📚 Więcej informacji

Zobacz plik `.github/SETUP-SECRETS.md` dla szczegółowych informacji o każdym sekrecie.

## ✅ Podsumowanie zmian

Zaktualizowałem następujące pliki:
- ✅ `.github/workflows/test.yml` - naprawiony port i dodane tworzenie `.env.test`
- ✅ `.env.test.example` - utworzony plik wzorcowy
- ✅ `.github/SETUP-SECRETS.md` - zaktualizowana dokumentacja sekretów

Wszystkie testy **przechodzą lokalnie** ✅:
- Testy jednostkowe: 90 passed
- Testy coverage: 90 passed  
- Testy E2E: 2 passed

Problem leżał tylko w konfiguracji CI/CD (zły port i brak pliku `.env.test` w GitHub Actions).

