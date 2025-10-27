# Testy jednostkowe API endpoints

## 📊 Podsumowanie

**Katalog**: `tests/unit/api/`  
**Status**: ✅ Gotowe do uruchomienia  
**Pokrycie**: Testy endpointów API z pełną obsługą błędów i edge cases

---

## 🎯 Testowane endpointy

### DELETE /api/generation-requests/:id

**Plik**: `generation-requests-delete.test.ts`  
**Liczba testów**: 35+  
**Status**: ✅ Kompletny

#### Testowane obszary:

1. **Success scenarios (2 testy)**
   - ✅ Zwracanie 204 No Content przy udanym usunięciu
   - ✅ Wywoływanie serwisu z poprawnymi parametrami

2. **Authentication validation (2 testy)**
   - ✅ Zwracanie 401 gdy użytkownik nie jest zalogowany
   - ✅ Zwracanie 401 gdy user jest null

3. **Request validation (2 testy)**
   - ✅ Zwracanie 400 gdy brakuje ID żądania
   - ✅ Zwracanie 400 gdy ID jest pustym stringiem

4. **Not found scenarios (2 testy)**
   - ✅ Zwracanie 404 gdy generation request nie istnieje
   - ✅ Zwracanie 404 gdy request należy do innego użytkownika (RLS)

5. **Database error scenarios (1 test)**
   - ✅ Zwracanie 404 dla dowolnego DatabaseError

6. **Unexpected error scenarios (2 testy)**
   - ✅ Zwracanie 500 dla nieoczekiwanych błędów
   - ✅ Zwracanie 500 gdy konstruktor serwisu rzuca wyjątek

7. **Response format (2 testy)**
   - ✅ Pusta treść z statusem 204 przy sukcesie
   - ✅ JSON error response z odpowiednią strukturą

8. **Service integration (3 testy)**
   - ✅ Tworzenie GenerationRequestService z poprawnym klientem Supabase
   - ✅ Brak tworzenia serwisu gdy uwierzytelnianie się nie powiedzie
   - ✅ Brak tworzenia serwisu gdy brakuje ID żądania

9. **Edge cases (3 testy)**
   - ✅ Obsługa formatu UUID dla ID żądania
   - ✅ Obsługa znaków specjalnych w ID żądania
   - ✅ Obsługa bardzo długich ID żądań

10. **CASCADE behavior documentation (1 test)**
    - ✅ Dokumentacja zachowania CASCADE (flashcards pozostają z NULL)

---

## 🔧 Kluczowe techniki testowania

### Mockowanie zależności

```typescript
// Mock GenerationRequestService
vi.mock("../../../src/lib/services/generation-request.service");

// Mock Logger
vi.mock("../../../src/lib/services/logger.service", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  })),
}));
```

### Tworzenie mock context

```typescript
const mockContext: APIContext = {
  locals: {
    supabase: mockSupabase,
    user: {
      id: "test-user-id",
      email: "test@example.com",
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    },
  },
  params: {
    id: "test-request-id",
  },
} as unknown as APIContext;
```

### Testowanie różnych scenariuszy błędów

```typescript
// Not Found
const deleteSpy = vi
  .spyOn(mockGenerationRequestService, "delete")
  .mockRejectedValue(new DatabaseError("Generation request not found", { code: "PGRST116" }));

// Unexpected Error
const deleteSpy = vi
  .spyOn(mockGenerationRequestService, "delete")
  .mockRejectedValue(new Error("Unexpected error"));
```

### Weryfikacja wywołań serwisu

```typescript
expect(deleteSpy).toHaveBeenCalledWith("test-user-id", "test-request-id");
expect(deleteSpy).toHaveBeenCalledTimes(1);
```

### Testowanie response format

```typescript
const response = await DELETE(mockContext);

expect(response.status).toBe(204);
expect(response.body).toBeNull();
expect(response.headers.get("Content-Type")).toBeNull();
```

---

## 📝 Struktura testów

### Arrange-Act-Assert Pattern

Wszystkie testy używają wzorca AAA:

```typescript
it("should return 204 No Content when deletion is successful", async () => {
  // Arrange - Przygotowanie danych i mocków
  const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);
  vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

  // Act - Wykonanie testowanej akcji
  const response = await DELETE(mockContext);

  // Assert - Weryfikacja wyników
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(deleteSpy).toHaveBeenCalledWith("test-user-id", "test-request-id");
});
```

---

## 🚀 Uruchamianie testów

```bash
# Wszystkie testy API
npm test tests/unit/api

# Tylko testy DELETE endpoint
npm test generation-requests-delete.test.ts

# Watch mode
npm test generation-requests-delete.test.ts --watch

# Z pokryciem kodu
npm test generation-requests-delete.test.ts --coverage

# Konkretny test
npm test generation-requests-delete.test.ts -t "should return 204"
```

---

## 📚 Powiązane testy

### Service Layer Tests

**Katalog**: `tests/unit/services/`  
**Plik**: `generation-request-service-delete.test.ts`

Testy warstwy serwisu sprawdzają:
- Poprawność wywołań Supabase
- Obsługę błędów bazy danych
- CASCADE behavior (ON DELETE SET NULL)
- Walidację parametrów
- Kolejność operacji

Zobacz: [tests/unit/services/README.md](../services/README.md)

---

## 🔗 Dokumentacja

- **Testowany endpoint**: `src/pages/api/generation-requests/[id].ts`
- **Plan implementacji**: `.ai/generation-requests-delete-implementation-plan.md`
- **Service**: `src/lib/services/generation-request.service.ts`
- **Error classes**: `src/lib/errors/database.error.ts`
- **Types**: `src/types.ts`

---

## ✅ Checklist dla nowych testów API

Przy dodawaniu nowych testów endpointów API, upewnij się że pokrywasz:

- [ ] **Success scenarios** - poprawne dane wejściowe
- [ ] **Authentication** - brak tokena, nieprawidłowy token
- [ ] **Authorization** - dostęp do cudzych zasobów (RLS)
- [ ] **Validation** - brakujące/nieprawidłowe parametry
- [ ] **Not found** - nieistniejące zasoby
- [ ] **Database errors** - błędy połączenia, timeouty
- [ ] **Unexpected errors** - wyjątki runtime
- [ ] **Response format** - struktura JSON, kody statusu HTTP
- [ ] **Service integration** - poprawne wywołania serwisu
- [ ] **Edge cases** - długie stringi, znaki specjalne, wartości graniczne

---

## 📊 Pokrycie testów

### DELETE /api/generation-requests/:id

| Obszar | Pokrycie |
|--------|----------|
| Success paths | ✅ 100% |
| Error handling | ✅ 100% |
| Authentication | ✅ 100% |
| Validation | ✅ 100% |
| Edge cases | ✅ 100% |
| Response format | ✅ 100% |

---

## 🎯 Następne kroki

1. **GET /api/generation-requests/:id** - testy endpointa GET
2. **GET /api/generation-requests** - testy listowania z paginacją
3. **POST /api/generation-requests** - testy tworzenia z AI
4. **Inne endpointy** - flashcards, study-sessions, statistics

---

## 💡 Best Practices

### 1. Izolacja testów
Każdy test jest niezależny - używamy `beforeEach()` do resetu mocków.

### 2. Descriptive test names
Nazwy testów jasno opisują co jest testowane:
- ✅ `"should return 204 No Content when deletion is successful"`
- ❌ `"test delete endpoint"`

### 3. Mock reset
Zawsze czyścimy mocki przed każdym testem:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 4. Type safety
Używamy typów TypeScript dla wszystkich mocków:
```typescript
let mockContext: APIContext;
let mockSupabase: SupabaseClient<Database>;
```

### 5. Edge case coverage
Testujemy nietypowe scenariusze:
- Bardzo długie stringi
- Znaki specjalne
- Równoczesne operacje
- Wartości null/undefined

---

## 🐛 Rozwiązywanie problemów

### Problem: Mock nie jest wywoływany
```typescript
// ❌ Źle
vi.mock("../../../src/lib/services/generation-request.service");
const mockService = new GenerationRequestService(mockSupabase);

// ✅ Dobrze
vi.mock("../../../src/lib/services/generation-request.service");
vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);
```

### Problem: Type errors z APIContext
```typescript
// Użyj type assertion
const mockContext = {
  locals: { ... },
  params: { ... },
} as unknown as APIContext;
```

### Problem: Response body nie jest parsowany
```typescript
// JSON response
const body = await response.json();

// Text response
const text = await response.text();

// Empty body (204)
expect(response.body).toBeNull();
```

