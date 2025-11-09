# 🚀 Quick Start - CI/CD Pipeline

Minimalistyczny przewodnik po uruchomieniu CI/CD dla projektu.

## ⚡ 2-minutowy setup

### Krok 1: Sprawdź czy masz wymagane secrets

```bash
# Przejdź do: Settings → Secrets and variables → Actions
```

Wymagane secrets:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_KEY`
- ✅ `OPENROUTER_API_KEY`

❌ **Nie masz?** → Zobacz [SETUP-SECRETS.md](../SETUP-SECRETS.md)

### Krok 2: Push do master

```bash
git add .
git commit -m "feat: add CI/CD workflow"
git push origin master
```

### Krok 3: Obserwuj wykonanie

1. Przejdź do zakładki **Actions**
2. Zobacz uruchomiony workflow **CI/CD Pipeline**
3. Kliknij na niego aby zobaczyć szczegóły

✅ **Gotowe!** Workflow będzie się uruchamiać automatycznie przy każdym pushu do master.

---

## 🎯 Uruchomienie manualne

### Krok 1: Przejdź do Actions

```
Repository → Actions → CI/CD Pipeline → Run workflow
```

### Krok 2: Wybierz opcje

![Manual Trigger](https://docs.github.com/assets/cb-33618/images/help/actions/workflow-dispatch-event.png)

**Opcje:**
- `Branch`: wybierz `master` (lub inny branch)
- `Pomiń testy jednostkowe`: zaznacz jeśli chcesz tylko build
- `Pomiń build produkcyjny`: zaznacz jeśli chcesz tylko testy

### Krok 3: Kliknij "Run workflow"

✅ Workflow zostanie uruchomiony w ciągu kilku sekund.

---

## 📊 Interpretacja wyników

### ✅ Sukces (wszystko zielone)

```
✅ Testy jednostkowe
✅ Build produkcyjny
✅ Podsumowanie
```

**Co to znaczy:**
- Wszystkie testy przeszły
- Build się powiódł
- Możesz bezpiecznie wdrożyć kod

**Co dalej:**
- Sprawdź artifacts (coverage report, build)
- Wdróż na produkcję

### ⚠️ Częściowy sukces

```
✅ Testy jednostkowe
⏭️ Build produkcyjny (pominięto)
✅ Podsumowanie
```

**Co to znaczy:**
- Zaznaczyłeś opcję "skip" przy manualnym uruchomieniu
- Lub warunek `if:` nie został spełniony

**Co dalej:**
- Sprawdź czy celowo pominąłeś ten krok
- Jeśli nie, uruchom ponownie bez opcji skip

### ❌ Błąd

```
❌ Testy jednostkowe (failed)
⏭️ Build produkcyjny (skipped)
✅ Podsumowanie
```

**Co to znaczy:**
- Testy jednostkowe się nie powiodły
- Build został pominięty (zależność od testów)

**Co dalej:**
1. Kliknij na czerwony job "Testy jednostkowe"
2. Rozwiń failed step
3. Przeczytaj error message
4. Napraw błąd lokalnie
5. Push ponownie

---

## 🔧 Typowe problemy

### Problem: "Build failed: Missing environment variables"

**Rozwiązanie:**
```bash
# Dodaj wymagane secrets w GitHub:
Settings → Secrets → New repository secret

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGc...
OPENROUTER_API_KEY=sk-...
```

### Problem: "Tests failing in CI but pass locally"

**Rozwiązanie:**
```bash
# Uruchom testy lokalnie z tymi samymi env:
NODE_ENV=test npm run test

# Sprawdź czy używasz tej samej wersji Node:
node --version  # Powinno być v20
```

### Problem: "Workflow not appearing in Actions"

**Rozwiązanie:**
```bash
# Sprawdź czy plik workflow jest w master:
git branch  # Sprawdź czy jesteś na master
git push origin master  # Push workflow file

# Sprawdź syntax:
# Użyj online YAML validator: yamllint.com
```

### Problem: "Cannot download artifacts"

**Rozwiązanie:**
- Artifacts są dostępne tylko przez 7 dni
- Sprawdź czy job się zakończył sukcesem
- Artifacts pojawią się w sekcji "Artifacts" na dole strony runa

---

## 📦 Co robić z artifacts?

### Coverage Report

**Gdzie:** Actions → Run → Artifacts → `coverage-report`

**Co zawiera:**
- `coverage/lcov-report/index.html` - HTML raport
- `coverage/lcov.info` - LCOV format (dla narzędzi)

**Jak użyć:**
```bash
# Pobierz artifact
# Rozpakuj ZIP
# Otwórz coverage/lcov-report/index.html w przeglądarce
```

### Production Build

**Gdzie:** Actions → Run → Artifacts → `production-build`

**Co zawiera:**
- Folder `dist/` - zbudowana aplikacja

**Jak użyć:**
```bash
# Pobierz artifact
# Rozpakuj ZIP
# Deploy na serwer:
scp -r dist/* user@server:/var/www/app/
```

---

## ⚙️ Dostosowanie workflow

### Zmień gałąź triggera

W pliku `.github/workflows/ci-cd.yml`:

```yaml
on:
  push:
    branches:
      - master
      - main      # Dodaj main
```

### Zmień retencję artifacts

```yaml
- name: Upload artefaktów buildu
  uses: actions/upload-artifact@v4
  with:
    retention-days: 30  # Zmień na 1-90
```

### Dodaj powiadomienia

Dodaj na końcu workflow:

```yaml
      - name: Notify on failure
        if: failure()
        run: |
          # Tutaj dodaj kod do powiadomienia (np. Slack, Email)
          echo "Build failed! Notify team."
```

### Skip workflow dla dokumentacji

```yaml
on:
  push:
    branches: [master]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

---

## 📈 Best Practices

### ✅ DO:

1. **Commituj często, ale sensownie**
   ```bash
   git commit -m "feat: add user authentication"
   # ✅ Dobry commit - workflow sprawdzi czy nie zepsułeś niczego
   ```

2. **Sprawdzaj logi jeśli coś nie działa**
   ```
   Actions → Run → Job → Step → Logi
   ```

3. **Używaj manual trigger do debugowania**
   ```
   Run workflow → Skip tests → Zobacz tylko build
   ```

4. **Zachowuj artifacts lokalnie jeśli potrzebne**
   ```bash
   # Pobierz przed upływem 7 dni
   ```

### ❌ DON'T:

1. **Nie pushuj nieprzetestowanego kodu na master**
   ```bash
   # BAD: git commit -m "wip" && git push origin master
   # GOOD: Przetestuj lokalnie najpierw
   ```

2. **Nie ignoruj failed testów**
   ```bash
   # Nie rób: git commit --allow-empty "retry CI"
   # Napraw problem zamiast tego
   ```

3. **Nie commituj secrets do kodu**
   ```javascript
   // BAD:
   const API_KEY = "sk-real-key-123";
   
   // GOOD:
   const API_KEY = process.env.OPENROUTER_API_KEY;
   ```

---

## 🎓 Następne kroki

### Poziom 1: Podstawy ✅
- [x] Uruchomić pierwszy workflow
- [x] Zobaczyć zielone buildy
- [x] Pobrać artifacts

### Poziom 2: Optymalizacja
- [ ] Dodać branch protection rules
- [ ] Skonfigurować automatyczne deployment
- [ ] Dodać notyfikacje (Slack/Email)

### Poziom 3: Zaawansowane
- [ ] Dodać matrix strategy (test na różnych Node versions)
- [ ] Integracja z Codecov
- [ ] Automatyczne release notes

---

## 📚 Dodatkowe zasoby

**Dokumentacja:**
- [CI-CD-README.md](./CI-CD-README.md) - Pełna dokumentacja
- [SETUP-SECRETS.md](../SETUP-SECRETS.md) - Setup secrets
- [GitHub Actions Docs](https://docs.github.com/en/actions)

**Inne workflows:**
- [pull-request.yml](./PULL-REQUEST-WORKFLOW.md) - Dla PRów
- [e2e.yml](./) - Dla testów E2E

**Support:**
- GitHub Issues
- Team chat
- [GitHub Community Forum](https://github.community/)

---

## 🏁 Checklist

Zanim zaczniesz używać CI/CD:

- [ ] Dodałem wszystkie wymagane secrets
- [ ] Sprawdziłem że workflow file jest na master
- [ ] Przetestowałem testy lokalnie (`npm run test`)
- [ ] Przetestowałem build lokalnie (`npm run build`)
- [ ] Przeczytałem dokumentację (CI-CD-README.md)
- [ ] Wiem gdzie znaleźć logi i artifacts
- [ ] Wiem jak uruchomić workflow manualnie

✅ **Gotowe!** Możesz zacząć używać CI/CD.

---

**Utworzono:** 2025-11-09  
**Wersja:** 1.0.0  
**Czas czytania:** ~5 minut  
**Poziom:** Beginner → Intermediate


