# Schemat bazy danych PostgreSQL – AIxCards

## 1. Tabele z kolumnami, typami danych i ograniczeniami

### 1.1. Tabela: `auth.users` (Supabase wbudowana)

Tabela zarządzana przez Supabase Auth. Nie wymaga tworzenia w migracji.

**Kluczowe kolumny:**

- `id` (UUID) – PRIMARY KEY
- `email` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

### 1.2. Typy wyliczeniowe (ENUM)

#### `flashcard_source_enum`

```sql
CREATE TYPE flashcard_source_enum AS ENUM ('manual', 'ai_generated');
```

#### `flashcard_status_enum`

```sql
CREATE TYPE flashcard_status_enum AS ENUM ('active', 'pending_review', 'rejected');
```

---

### 1.3. Tabela: `generation_requests`

Przechowuje teksty źródłowe przesłane przez użytkowników do generowania fiszek przez AI.

| Kolumna       | Typ         | Ograniczenia                                             | Opis                              |
| ------------- | ----------- | -------------------------------------------------------- | --------------------------------- |
| `id`          | UUID        | PRIMARY KEY, DEFAULT uuid_generate_v4()                  | Unikalny identyfikator żądania    |
| `user_id`     | UUID        | NOT NULL, FOREIGN KEY → auth.users(id) ON DELETE CASCADE | Identyfikator użytkownika         |
| `source_text` | TEXT        | NOT NULL                                                 | Oryginalny tekst przesłany do AI  |
| `created_at`  | TIMESTAMPTZ | NOT NULL, DEFAULT now()                                  | Data i czas utworzenia            |
| `updated_at`  | TIMESTAMPTZ | NOT NULL, DEFAULT now()                                  | Data i czas ostatniej modyfikacji |

**Ograniczenia:**

- Długość `source_text` powinna być walidowana na poziomie aplikacji (1000-10000 znaków zgodnie z US-003)

---

### 1.4. Tabela: `flashcards`

Główna tabela przechowująca wszystkie fiszki użytkowników (zarówno ręczne, jak i wygenerowane przez AI).

| Kolumna                 | Typ                   | Ograniczenia                                                   | Opis                                                            |
| ----------------------- | --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `id`                    | UUID                  | PRIMARY KEY, DEFAULT uuid_generate_v4()                        | Unikalny identyfikator fiszki                                   |
| `user_id`               | UUID                  | NOT NULL, FOREIGN KEY → auth.users(id) ON DELETE CASCADE       | Identyfikator właściciela fiszki                                |
| `generation_request_id` | UUID                  | NULL, FOREIGN KEY → generation_requests(id) ON DELETE SET NULL | Opcjonalny identyfikator żądania AI                             |
| `front`                 | TEXT                  | NOT NULL                                                       | Treść przodu fiszki (pytanie)                                   |
| `back`                  | TEXT                  | NOT NULL                                                       | Treść tyłu fiszki (odpowiedź)                                   |
| `source`                | flashcard_source_enum | NOT NULL                                                       | Pochodzenie fiszki                                              |
| `status`                | flashcard_status_enum | NOT NULL, DEFAULT 'pending_review'                             | Status fiszki w cyklu życia                                     |
| `next_review_at`        | TIMESTAMPTZ           | NULL                                                           | Data następnej sesji powtórki (dla algorytmu spaced repetition) |
| `interval`              | INTEGER               | NULL, DEFAULT 0                                                | Interwał w dniach dla algorytmu powtórek                        |
| `ease_factor`           | DECIMAL(3,2)          | NULL, DEFAULT 2.5                                              | Współczynnik łatwości dla algorytmu powtórek                    |
| `created_at`            | TIMESTAMPTZ           | NOT NULL, DEFAULT now()                                        | Data i czas utworzenia                                          |
| `updated_at`            | TIMESTAMPTZ           | NOT NULL, DEFAULT now()                                        | Data i czas ostatniej modyfikacji                               |

**Uwagi:**

- `generation_request_id` jest NULL dla fiszek tworzonych ręcznie
- `status` = 'pending_review' dla fiszek wygenerowanych przez AI przed ich zaakceptowaniem
- `status` = 'active' dla fiszek zaakceptowanych i gotowych do nauki
- `status` = 'rejected' dla fiszek odrzuconych przez użytkownika
- Kolumny `next_review_at`, `interval`, `ease_factor` są używane przez algorytm spaced repetition

---

## 2. Relacje między tabelami

### 2.1. `auth.users` ← `generation_requests`

- **Typ relacji:** Jeden-do-wielu (1:N)
- **Klucz obcy:** `generation_requests.user_id` → `auth.users.id`
- **Kardynalność:** Jeden użytkownik może mieć wiele żądań generowania
- **ON DELETE:** CASCADE (usunięcie konta usuwa wszystkie żądania)

### 2.2. `auth.users` ← `flashcards`

- **Typ relacji:** Jeden-do-wielu (1:N)
- **Klucz obcy:** `flashcards.user_id` → `auth.users.id`
- **Kardynalność:** Jeden użytkownik może mieć wiele fiszek
- **ON DELETE:** CASCADE (usunięcie konta usuwa wszystkie fiszki - zgodność z RODO)

### 2.3. `generation_requests` ← `flashcards`

- **Typ relacji:** Jeden-do-wielu (1:N)
- **Klucz obcy:** `flashcards.generation_request_id` → `generation_requests.id`
- **Kardynalność:** Jedno żądanie może wygenerować wiele fiszek
- **ON DELETE:** SET NULL (usunięcie żądania nie usuwa fiszek, tylko usuwa powiązanie)

---

## 3. Indeksy

### 3.1. Indeksy na kluczach obcych

```sql
CREATE INDEX idx_generation_requests_user_id ON generation_requests(user_id);
CREATE INDEX idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX idx_flashcards_generation_request_id ON flashcards(generation_request_id);
```

**Uzasadnienie:** Przyspieszają zapytania pobierające dane dla konkretnego użytkownika.

### 3.2. Indeksy na kolumnach wykorzystywanych w sesji nauki

```sql
CREATE INDEX idx_flashcards_next_review_at ON flashcards(next_review_at) WHERE status = 'active';
```

**Uzasadnienie:** Optymalizacja zapytań pobierających fiszki do powtórki w danym dniu. Indeks częściowy (partial index) obejmuje tylko aktywne fiszki.

### 3.3. Indeks na kolumnie status

```sql
CREATE INDEX idx_flashcards_status ON flashcards(status);
```

**Uzasadnienie:** Przyspieszenie filtrowania fiszek według statusu (np. dla widoku "Moje fiszki").

### 3.4. Indeks kompozytowy dla sesji nauki

```sql
CREATE INDEX idx_flashcards_user_next_review ON flashcards(user_id, next_review_at, status)
WHERE status = 'active';
```

**Uzasadnienie:** Optymalizacja głównego zapytania sesji nauki: pobieranie aktywnych fiszek użytkownika gotowych do powtórki.

---

## 4. Zasady PostgreSQL Row-Level Security (RLS)

### 4.1. Włączenie RLS dla tabel

```sql
ALTER TABLE generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
```

### 4.2. Polityki dla tabeli `generation_requests`

#### Polityka SELECT

```sql
CREATE POLICY "Users can view only their own generation requests"
ON generation_requests
FOR SELECT
USING (auth.uid() = user_id);
```

#### Polityka INSERT

```sql
CREATE POLICY "Users can insert their own generation requests"
ON generation_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

#### Polityka UPDATE

```sql
CREATE POLICY "Users can update only their own generation requests"
ON generation_requests
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### Polityka DELETE

```sql
CREATE POLICY "Users can delete only their own generation requests"
ON generation_requests
FOR DELETE
USING (auth.uid() = user_id);
```

### 4.3. Polityki dla tabeli `flashcards`

#### Polityka SELECT

```sql
CREATE POLICY "Users can view only their own flashcards"
ON flashcards
FOR SELECT
USING (auth.uid() = user_id);
```

#### Polityka INSERT

```sql
CREATE POLICY "Users can insert their own flashcards"
ON flashcards
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

#### Polityka UPDATE

```sql
CREATE POLICY "Users can update only their own flashcards"
ON flashcards
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### Polityka DELETE

```sql
CREATE POLICY "Users can delete only their own flashcards"
ON flashcards
FOR DELETE
USING (auth.uid() = user_id);
```

---

## 5. Triggery i funkcje

### 5.1. Funkcja aktualizacji `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5.2. Triggery dla automatycznej aktualizacji `updated_at`

```sql
CREATE TRIGGER update_generation_requests_updated_at
BEFORE UPDATE ON generation_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flashcards_updated_at
BEFORE UPDATE ON flashcards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. Rozszerzenia PostgreSQL

### 6.1. Wymagane rozszerzenie dla UUID

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Uzasadnienie:** Umożliwia generowanie UUID dla kluczy głównych przy użyciu `uuid_generate_v4()`.

---

## 7. Dodatkowe uwagi i decyzje projektowe

### 7.1. Normalizacja

Schemat jest znormalizowany do 3NF (Trzecia Postać Normalna):

- Każda tabela reprezentuje jedną encję
- Wszystkie atrybuty są atomowe
- Brak zależności przechodnich
- Relacje są prawidłowo zdefiniowane przez klucze obce

### 7.2. Skalowalność

- **UUID jako klucze główne:** Umożliwia łatwe skalowanie horyzontalne i unikanie konfliktów ID przy replikacji
- **Indeksy strategiczne:** Zoptymalizowane pod kątem głównych zapytań aplikacji
- **Indeksy częściowe:** Zmniejszają rozmiar indeksów i poprawiają wydajność dla specyficznych zapytań

### 7.3. Bezpieczeństwo

- **RLS (Row-Level Security):** Zapewnia, że użytkownicy mają dostęp tylko do swoich danych na poziomie bazy danych
- **ON DELETE CASCADE:** Automatyczne usuwanie danych użytkownika zgodnie z RODO (prawo do bycia zapomnianym)
- **Wykorzystanie auth.uid():** Funkcja Supabase do bezpiecznego identyfikowania zalogowanego użytkownika

### 7.4. Metryki i analityka

Schemat umożliwia zbieranie następujących metryk (zgodnie z wymaganiami PRD):

- Liczba fiszek wygenerowanych przez AI: `COUNT(*) WHERE source = 'ai_generated'`
- Liczba zaakceptowanych fiszek AI: `COUNT(*) WHERE source = 'ai_generated' AND status = 'active'`
- Procent akceptacji: ratio zaakceptowanych do wygenerowanych
- Porównanie fiszek AI vs. ręcznych: agregacja według kolumny `source`

### 7.5. Algorytm Spaced Repetition

Kolumny `next_review_at`, `interval` i `ease_factor` są przygotowane do integracji z biblioteką spaced repetition:

- `next_review_at`: Data następnej sesji powtórki
- `interval`: Liczba dni do następnej powtórki
- `ease_factor`: Współczynnik trudności fiszki (domyślnie 2.5, zgodnie z algorytmem SM-2)

### 7.6. Cykl życia fiszki

Status fiszki przechodzi przez następujące stany:

1. **pending_review** – Fiszka wygenerowana przez AI, czeka na akceptację użytkownika
2. **active** – Fiszka zaakceptowana i gotowa do nauki
3. **rejected** – Fiszka odrzucona przez użytkownika (przechowywana dla metryk)

Fiszki tworzone ręcznie mogą być od razu ustawiane jako 'active'.

### 7.7. Obsługa ON DELETE SET NULL

`generation_request_id` w tabeli `flashcards` ma `ON DELETE SET NULL`, aby:

- Zachować fiszki nawet po usunięciu żądania generowania
- Umożliwić opcjonalne czyszczenie starych żądań bez utraty fiszek
- Zachować powiązanie dla celów analitycznych, gdy jest dostępne

### 7.8. Walidacja na poziomie aplikacji

Następujące walidacje powinny być zaimplementowane w kodzie aplikacji:

- Długość `source_text` w `generation_requests`: 1000-10000 znaków
- Długość `front` i `back` w `flashcards`: maksymalna długość do ustalenia
- Format i zakres wartości dla `ease_factor`: typowo 1.3-2.5
- Wartość `interval` jako liczba nieujemna

### 7.9. Zgodność z Supabase

Schemat jest w pełni kompatybilny z Supabase:

- Wykorzystuje wbudowany system auth (auth.users)
- Używa `auth.uid()` w politykach RLS
- Kompatybilny z Supabase Realtime (opcjonalnie do włączenia)
- Gotowy do użycia z Supabase SDK

---

## 8. Kolejność tworzenia obiektów w migracji

Zalecana kolejność tworzenia obiektów:

1. Rozszerzenia (`uuid-ossp`)
2. Typy ENUM (`flashcard_source_enum`, `flashcard_status_enum`)
3. Tabela `generation_requests`
4. Tabela `flashcards`
5. Indeksy
6. Funkcja `update_updated_at_column()`
7. Triggery
8. Włączenie RLS
9. Polityki RLS

Ta kolejność zapewnia, że wszystkie zależności są spełnione podczas tworzenia każdego obiektu.
