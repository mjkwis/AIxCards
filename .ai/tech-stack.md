Frontend - Astro z React dla komponentów interaktywnych:

- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI

Backend - Supabase jako kompleksowe rozwiązanie backendowe:

- Zapewnia bazę danych PostgreSQL
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

Testowanie - Kompleksowa strategia zapewniania jakości:

- **Vitest** jako główny framework do testów jednostkowych i integracyjnych
- **Testing Library** do testowania komponentów React z naciskiem na zachowania użytkownika
- **Playwright** do testów end-to-end, zapewniających weryfikację pełnych przepływów użytkownika
- **MSW (Mock Service Worker)** do mockowania API zewnętrznych (OpenRouter) w testach
- **Supabase Test Client** do testów integracyjnych z rzeczywistą bazą danych
- **axe-core** do automatycznego testowania dostępności (WCAG 2.1 AA)
- **k6** do testów wydajnościowych i obciążeniowych
- **OWASP ZAP** do testów bezpieczeństwa i skanowania vulnerabilities

CI/CD i Hosting:

- Github Actions do tworzenia pipeline'ów CI/CD z automatycznym uruchamianiem testów
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker
- Codecov do raportowania pokrycia kodu testami
- Playwright Report do wizualizacji wyników testów E2E
