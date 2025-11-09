# Testowanie CI/CD lokalnie

Przewodnik jak przetestować kroki z workflow lokalnie przed pushem.

## 🎯 Cel

Lokalnie przetestuj te same kroki co w CI/CD, aby:
- Wykryć błędy przed pushem
- Zaoszczędzić GitHub Actions minutes
- Przyspieszyć development cycle

---

## 🔧 Setup

### Wymagania

- Node.js 20 (taka sama wersja jak w CI)
- npm
- Pliki `.env` z odpowiednimi zmiennymi

### Sprawdź wersję Node.js

```bash
node --version
# Powinno być: v20.x.x
```

Jeśli masz inną wersję:

```bash
# Użyj nvm (Node Version Manager)
nvm install 20
nvm use 20
```

---

## 🧪 Symulacja Job 1: Unit Tests

### Krok po kroku

```bash
# 1. Czysta instalacja (jak npm ci w CI)
rm -rf node_modules package-lock.json
npm install

# 2. Uruchomienie testów z właściwym env
NODE_ENV=test npm run test

# 3. Generowanie coverage
NODE_ENV=test npm run test:coverage

# 4. Sprawdź wyniki
open coverage/lcov-report/index.html  # macOS
# LUB
start coverage/lcov-report/index.html  # Windows
# LUB
xdg-open coverage/lcov-report/index.html  # Linux
```

### Skrypt automatyczny

Stwórz plik `scripts/test-like-ci.sh`:

```bash
#!/bin/bash

echo "🧪 Symulacja CI/CD - Unit Tests"
echo "================================"

echo "1. Instalacja zależności..."
npm ci

echo ""
echo "2. Uruchamianie testów..."
NODE_ENV=test npm run test

if [ $? -ne 0 ]; then
    echo "❌ Testy nie przeszły!"
    exit 1
fi

echo ""
echo "3. Generowanie coverage..."
NODE_ENV=test npm run test:coverage

if [ $? -ne 0 ]; then
    echo "⚠️ Coverage generation failed (but continuing...)"
fi

echo ""
echo "✅ Unit Tests - OK!"
```

Uruchom:

```bash
chmod +x scripts/test-like-ci.sh
./scripts/test-like-ci.sh
```

---

## 🏗️ Symulacja Job 2: Production Build

### Krok po kroku

```bash
# 1. Czysta instalacja
npm ci

# 2. Linting
npm run lint

# 3. Build z env variables
NODE_ENV=production \
SUPABASE_URL="your-url" \
SUPABASE_KEY="your-key" \
OPENROUTER_API_KEY="your-key" \
npm run build

# 4. Sprawdź czy build się powiódł
ls -la dist/

# 5. (Opcjonalnie) Przetestuj build lokalnie
npm run preview
```

### Skrypt automatyczny

Stwórz plik `scripts/build-like-ci.sh`:

```bash
#!/bin/bash

echo "🏗️ Symulacja CI/CD - Production Build"
echo "======================================"

# Sprawdź czy .env istnieje
if [ ! -f .env ]; then
    echo "❌ Brak pliku .env!"
    echo "Skopiuj .env.example do .env i wypełnij wartościami."
    exit 1
fi

# Załaduj zmienne z .env
export $(cat .env | xargs)

echo "1. Instalacja zależności..."
npm ci

echo ""
echo "2. Linting kodu..."
npm run lint

if [ $? -ne 0 ]; then
    echo "⚠️ Linting errors found (but continuing...)"
fi

echo ""
echo "3. Building aplikacji..."
NODE_ENV=production npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "4. Weryfikacja buildu..."
if [ -d "dist" ]; then
    echo "✅ Folder dist/ istnieje"
    du -sh dist/
else
    echo "❌ Folder dist/ nie został utworzony!"
    exit 1
fi

echo ""
echo "✅ Production Build - OK!"
echo ""
echo "Możesz przetestować build lokalnie:"
echo "  npm run preview"
```

Uruchom:

```bash
chmod +x scripts/build-like-ci.sh
./scripts/build-like-ci.sh
```

---

## 🔄 Pełna symulacja pipeline

Stwórz plik `scripts/full-ci-cd-simulation.sh`:

```bash
#!/bin/bash

set -e  # Exit on error

echo "🚀 Pełna Symulacja CI/CD Pipeline"
echo "================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track status
UNIT_TESTS_STATUS="⏳"
BUILD_STATUS="⏳"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "JOB 1: UNIT TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Job 1: Unit Tests
echo "📦 Instalacja zależności..."
npm ci > /dev/null 2>&1

echo "🧪 Uruchamianie testów jednostkowych..."
if NODE_ENV=test npm run test > /dev/null 2>&1; then
    UNIT_TESTS_STATUS="${GREEN}✅${NC}"
    echo -e "${GREEN}✅ Testy jednostkowe przeszły${NC}"
else
    UNIT_TESTS_STATUS="${RED}❌${NC}"
    echo -e "${RED}❌ Testy jednostkowe nie przeszły${NC}"
    echo ""
    echo "Uruchom ponownie z pełnymi logami:"
    echo "  NODE_ENV=test npm run test"
    exit 1
fi

echo "📊 Generowanie coverage..."
NODE_ENV=test npm run test:coverage > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Coverage generation failed${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "JOB 2: PRODUCTION BUILD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Brak pliku .env!${NC}"
    echo "Skopiuj .env.example do .env"
    exit 1
fi

# Load env
export $(cat .env | xargs)

echo "🔍 Linting kodu..."
npm run lint > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Linting warnings${NC}"

echo "🏗️ Building aplikacji (production)..."
if NODE_ENV=production npm run build > /dev/null 2>&1; then
    BUILD_STATUS="${GREEN}✅${NC}"
    echo -e "${GREEN}✅ Build produkcyjny zakończony sukcesem${NC}"
    
    if [ -d "dist" ]; then
        echo "📦 Build size: $(du -sh dist/ | cut -f1)"
    fi
else
    BUILD_STATUS="${RED}❌${NC}"
    echo -e "${RED}❌ Build failed${NC}"
    echo ""
    echo "Uruchom ponownie z pełnymi logami:"
    echo "  npm run build"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PODSUMOWANIE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "┌─────────────────────────┬──────────┐"
echo "│ Zadanie                 │ Status   │"
echo "├─────────────────────────┼──────────┤"
echo -e "│ Testy jednostkowe       │ $UNIT_TESTS_STATUS        │"
echo -e "│ Build produkcyjny       │ $BUILD_STATUS        │"
echo "└─────────────────────────┴──────────┘"
echo ""

if [[ "$UNIT_TESTS_STATUS" == *"✅"* && "$BUILD_STATUS" == *"✅"* ]]; then
    echo -e "${GREEN}✅ Pipeline zakończony sukcesem!${NC}"
    echo ""
    echo "Możesz teraz:"
    echo "  1. Przetestować build:  npm run preview"
    echo "  2. Pushować na master:  git push origin master"
    exit 0
else
    echo -e "${RED}❌ Pipeline zakończony błędem${NC}"
    exit 1
fi
```

Uruchom:

```bash
chmod +x scripts/full-ci-cd-simulation.sh
./scripts/full-ci-cd-simulation.sh
```

---

## 📝 Windows PowerShell Scripts

Dla użytkowników Windows, stwórz `scripts/test-like-ci.ps1`:

```powershell
Write-Host "🧪 Symulacja CI/CD - Unit Tests" -ForegroundColor Cyan
Write-Host "================================"

Write-Host "`n1. Instalacja zależności..." -ForegroundColor Yellow
npm ci

Write-Host "`n2. Uruchamianie testów..." -ForegroundColor Yellow
$env:NODE_ENV = "test"
npm run test

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Testy nie przeszły!" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Generowanie coverage..." -ForegroundColor Yellow
$env:NODE_ENV = "test"
npm run test:coverage

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Coverage generation failed (but continuing...)" -ForegroundColor Yellow
}

Write-Host "`n✅ Unit Tests - OK!" -ForegroundColor Green
```

I `scripts/build-like-ci.ps1`:

```powershell
Write-Host "🏗️ Symulacja CI/CD - Production Build" -ForegroundColor Cyan
Write-Host "======================================"

# Sprawdź czy .env istnieje
if (-Not (Test-Path .env)) {
    Write-Host "❌ Brak pliku .env!" -ForegroundColor Red
    Write-Host "Skopiuj .env.example do .env i wypełnij wartościami."
    exit 1
}

# Załaduj zmienne z .env
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

Write-Host "`n1. Instalacja zależności..." -ForegroundColor Yellow
npm ci

Write-Host "`n2. Linting kodu..." -ForegroundColor Yellow
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Linting errors found (but continuing...)" -ForegroundColor Yellow
}

Write-Host "`n3. Building aplikacji..." -ForegroundColor Yellow
$env:NODE_ENV = "production"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n4. Weryfikacja buildu..." -ForegroundColor Yellow
if (Test-Path dist) {
    Write-Host "✅ Folder dist/ istnieje" -ForegroundColor Green
    $size = (Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "📦 Build size: $([math]::Round($size, 2)) MB"
} else {
    Write-Host "❌ Folder dist/ nie został utworzony!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Production Build - OK!" -ForegroundColor Green
Write-Host "`nMożesz przetestować build lokalnie:"
Write-Host "  npm run preview" -ForegroundColor Cyan
```

Uruchom w PowerShell:

```powershell
.\scripts\test-like-ci.ps1
.\scripts\build-like-ci.ps1
```

---

## 🐳 Docker Simulation (Advanced)

Dla maksymalnej wierności CI environment, użyj Docker:

Stwórz `Dockerfile.ci-test`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Kopiuj dependency files
COPY package*.json ./

# Instalacja zależności
RUN npm ci

# Kopiuj resztę kodu
COPY . .

# Uruchom testy
CMD ["npm", "run", "test"]
```

Uruchom:

```bash
# Build image
docker build -f Dockerfile.ci-test -t ci-test .

# Uruchom testy
docker run --rm ci-test

# Uruchom z coverage
docker run --rm ci-test npm run test:coverage

# Uruchom build
docker run --rm \
  -e NODE_ENV=production \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_KEY=your-key \
  -e OPENROUTER_API_KEY=your-key \
  ci-test npm run build
```

---

## 🎯 Pre-commit Hook

Automatycznie uruchamiaj testy przed każdym commitem.

Stwórz `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Pre-commit checks..."

# Sprawdź czy tests przechodzą
echo "Running tests..."
NODE_ENV=test npm run test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Commit aborted."
    exit 1
fi

# Sprawdź linting
echo "Running linter..."
npm run lint

if [ $? -ne 0 ]; then
    echo "⚠️ Linting errors found."
    echo "Fix them or use 'git commit --no-verify' to skip (not recommended)"
    exit 1
fi

echo "✅ Pre-commit checks passed!"
```

Instalacja Husky (jeśli jeszcze nie masz):

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm test"
```

---

## 📊 Porównanie: Lokalnie vs CI

| Aspekt | Lokalnie | CI (GitHub Actions) |
|--------|----------|---------------------|
| **Environment** | Twój OS | Ubuntu latest |
| **Node.js** | Może się różnić | v20 (fixed) |
| **Cache** | Może być stary | Fresh lub cached |
| **Env vars** | Z `.env` | Z GitHub Secrets |
| **Czas** | Szybciej (cache) | Wolniej (cold start) |
| **Koszta** | Darmowe | GitHub Actions minutes |

**Rekomendacja:** Zawsze testuj lokalnie przed pushem!

---

## 🔍 Debugging Tips

### Problem: "Testy przechodzą lokalnie ale nie w CI"

**Możliwe przyczyny:**

1. **Różne wersje Node.js**
   ```bash
   # Sprawdź lokalnie
   node --version
   
   # Sprawdź w CI (zobacz logi workflow)
   # Powinno być: v20.x.x
   ```

2. **Różne zmienne środowiskowe**
   ```bash
   # Sprawdź lokalne env
   echo $NODE_ENV
   
   # CI używa: NODE_ENV=test
   ```

3. **Cache node_modules**
   ```bash
   # Wyczyść lokalnie
   rm -rf node_modules package-lock.json
   npm ci
   ```

4. **Timezone differences**
   ```javascript
   // BAD: Zakładanie timezone
   new Date('2024-01-01').getHours()  // Różne wyniki
   
   // GOOD: Używanie UTC
   new Date('2024-01-01T00:00:00Z').getHours()
   ```

### Problem: "Build działa lokalnie ale nie w CI"

**Możliwe przyczyny:**

1. **Brak env variables w CI**
   - Sprawdź GitHub Secrets
   - Sprawdź czy są używane w workflow

2. **Różne wersje dependencies**
   ```bash
   # Lokalnie użyj dokładnie tego samego co CI
   npm ci  # Zamiast npm install
   ```

3. **Path issues (Windows vs Linux)**
   ```javascript
   // BAD:
   const path = 'src\\components\\Button.tsx';
   
   // GOOD:
   const path = require('path').join('src', 'components', 'Button.tsx');
   ```

---

## 📚 Dodatkowe narzędzia

### act - GitHub Actions Locally

[nektos/act](https://github.com/nektos/act) pozwala uruchomić GitHub Actions lokalnie.

**Instalacja:**

```bash
# macOS
brew install act

# Windows (chocolatey)
choco install act-cli

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Użycie:**

```bash
# Uruchom wszystkie workflows
act

# Uruchom konkretny event
act push

# Uruchom konkretny job
act -j unit-tests

# Z secrets
act -s SUPABASE_URL=xxx -s SUPABASE_KEY=yyy
```

**Uwaga:** act używa Docker, więc wymaga Docker Desktop.

---

## ✅ Checklist przed pushem

- [ ] Uruchomiłem testy lokalnie (`npm run test`)
- [ ] Testy przeszły ✅
- [ ] Uruchomiłem linting (`npm run lint`)
- [ ] Linting przeszedł ✅ (lub naprawiłem błędy)
- [ ] Uruchomiłem build (`npm run build`)
- [ ] Build przeszedł ✅
- [ ] Sprawdziłem czy wszystkie zmienne env są w GitHub Secrets
- [ ] Commitowałem sensowne zmiany (nie `git commit -m "wip"`)

Jeśli wszystko ✅ → **Push z pewnością!** 🚀

---

**Utworzono:** 2025-11-09  
**Wersja:** 1.0.0  
**Dla:** Developerów chcących przetestować CI lokalnie


