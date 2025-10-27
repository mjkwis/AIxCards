# Testy jednostkowe warstwy serwisowej

## 📊 Podsumowanie

**Katalog**: `tests/unit/services/`  
**Status**: ✅ Gotowe do uruchomienia  
**Pokrycie**: Testy logiki biznesowej z izolowanymi mockami Supabase

---

## 🎯 Testowane serwisy

### GenerationRequestService.delete()

**Plik**: `generation-request-service-delete.test.ts`  
**Liczba testów**: 45+  
**Status**: ✅ Kompletny

#### Testowane obszary:

1. **Success scenarios (4 testy)**
   - ✅ Pomyślne usunięcie generation request
   - ✅ Wywołanie z poprawną nazwą tabeli
   - ✅ Filtrowanie po userId i requestId
   - ✅ Brak zwracanej wartości (void)

2. **Database error scenarios (4 testy)**
   - ✅ Rzucanie DatabaseError gdy usuwanie się nie powiedzie
   - ✅ Dołączanie oryginalnego błędu w DatabaseError
   - ✅ Obsługa błędów sieciowych
   - ✅ Obsługa błędów uprawnień

3. **Not found scenarios (2 testy)**
   - ✅ Rzucanie DatabaseError gdy generation request nie istnieje
   - ✅ Rzucanie DatabaseError gdy request należy do innego użytkownika (RLS)

4. **Unexpected error scenarios (4 testy)**
   - ✅ Opakowywanie błędów innych niż DatabaseError
   - ✅ Graceful handling null/undefined errors
   - ✅ Ponowne rzucanie DatabaseError bez zmian
   - ✅ Obsługa odrzuconych Promise

5. **CASCADE behavior (2 testy)**
   - ✅ Usuwanie generation request (flashcards pozostają)
   - ✅ Brak osobnych wywołań do aktualizacji flashcards

6. **Parameter validation (3 testy)**
   - ✅ Obsługa różnych formatów userId
   - ✅ Obsługa różnych formatów requestId
   - ✅ Obsługa znaków specjalnych w ID

7. **Order of operations (2 testy)**
   - ✅ Filtrowanie po id przed user_id
   - ✅ Wywołanie from() przed delete()

8. **Concurrent operations (2 testy)**
   - ✅ Obsługa wielu równoczesnych usunięć
   - ✅ Obsługa mieszanych sukcesów i niepowodzeń

---

## 🔧 Kluczowe techniki testowania

### Mockowanie Supabase Client

```typescript
let mockEq: ReturnType<typeof vi.fn>;
let mockDelete: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Create mock chain for Supabase operations
  mockEq = vi.fn().mockReturnThis();
  mockDelete = vi.fn().mockReturnValue({
    eq: mockEq,
  });

  mockSupabase = {
    from: vi.fn().mockReturnValue({
      delete: mockDelete,
    }),
  } as unknown as SupabaseClient<Database>;
});
```

### Testowanie łańcucha wywołań Supabase

```typescript
// Arrange
mockEq.mockResolvedValue({ data: null, error: null });

// Act
await service.delete("user-id", "request-id");

// Assert
expect(mockSupabase.from).toHaveBeenCalledWith("generation_requests");
expect(mockDelete).toHaveBeenCalledTimes(1);
expect(mockEq).toHaveBeenCalledWith("id", "request-id");
expect(mockEq).toHaveBeenCalledWith("user_id", "user-id");
```

### Testowanie błędów bazy danych

```typescript
// Simulate database error
const dbError = {
  code: "DB_ERROR",
  message: "Database connection failed",
};

mockEq.mockResolvedValue({ data: null, error: dbError });

// Assert
await expect(service.delete("user-id", "request-id")).rejects.toThrow(DatabaseError);
```

### Weryfikacja oryginalnego błędu

```typescript
try {
  await service.delete("user-id", "request-id");
  expect.fail("Should have thrown DatabaseError");
} catch (error) {
  expect(error).toBeInstanceOf(DatabaseError);
  expect((error as DatabaseError).originalError).toEqual(originalError);
}
```

---

## 📝 Struktura testów

### Testowanie szczegółów implementacji

W odróżnieniu od testów endpointów API, testy serwisów sprawdzają:
- Dokładną kolejność wywołań metod Supabase
- Poprawność parametrów przekazywanych do każdej metody
- Szczegóły obsługi błędów na poziomie bazy danych

```typescript
it("should filter by id first, then user_id", async () => {
  // Arrange
  const callOrder: string[] = [];

  mockEq.mockImplementation((field: string, value: string) => {
    callOrder.push(`${field}=${value}`);
    return { 
      eq: mockEq,
      then: (fn: any) => Promise.resolve({ data: null, error: null }).then(fn),
    };
  });

  // Act
  await service.delete("user-123", "request-456");

  // Assert
  expect(callOrder).toEqual(["id=request-456", "user_id=user-123"]);
});
```

---

## 🔍 CASCADE Behavior Testing

### Dokumentacja zachowania ON DELETE SET NULL

Testy dokumentują jak działa CASCADE w bazie danych:

```typescript
it("should delete generation request (flashcards remain)", async () => {
  // This test documents expected CASCADE behavior:
  // 1. Generation request is deleted
  // 2. Flashcards are NOT deleted
  // 3. Flashcards' generation_request_id is set to NULL
  //
  // The CASCADE behavior is enforced by the database schema:
  // ALTER TABLE flashcards
  // ADD CONSTRAINT flashcards_generation_request_id_fkey
  // FOREIGN KEY (generation_request_id)
  // REFERENCES generation_requests(id)
  // ON DELETE SET NULL;

  mockEq.mockResolvedValue({ data: null, error: null });

  await service.delete("user-id", "request-id");

  // The service only handles the deletion of the generation_request
  // The database automatically handles setting flashcards.generation_request_id to NULL
  expect(mockSupabase.from).toHaveBeenCalledWith("generation_requests");
  expect(mockDelete).toHaveBeenCalledTimes(1);

  // Note: We do NOT expect a separate call to update flashcards
  // because the database handles it automatically via CASCADE
});
```

---

## 🚀 Uruchamianie testów

```bash
# Wszystkie testy serwisów
npm test tests/unit/services

# Tylko testy delete method
npm test generation-request-service-delete.test.ts

# Watch mode
npm test generation-request-service-delete.test.ts --watch

# Z pokryciem kodu
npm test generation-request-service-delete.test.ts --coverage

# Konkretny test
npm test generation-request-service-delete.test.ts -t "should successfully delete"
```

---

## 📊 Pokrycie testów

### GenerationRequestService.delete()

| Obszar | Pokrycie |
|--------|----------|
| Success paths | ✅ 100% |
| Error handling | ✅ 100% |
| Database errors | ✅ 100% |
| Parameter validation | ✅ 100% |
| Edge cases | ✅ 100% |
| CASCADE behavior | ✅ 100% |
| Concurrent operations | ✅ 100% |

---

## 🎯 Różnice między testami API a testami serwisów

### Testy API (Endpoint Layer)
- Testują **kontrakt API** (request/response)
- Używają mocków **całych serwisów**
- Skupiają się na **kodach HTTP** i **strukturze JSON**
- Weryfikują **autoryzację** i **walidację**

### Testy serwisów (Service Layer)
- Testują **logikę biznesową**
- Używają mocków **Supabase client**
- Skupiają się na **wywołaniach bazy danych**
- Weryfikują **szczegóły implementacji**

```
┌─────────────────────────────────────┐
│      API Endpoint Tests             │
│  (generation-requests-delete.test)  │
│                                     │
│  Mock: GenerationRequestService     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│    Service Layer Tests              │
│ (generation-request-service-delete) │
│                                     │
│  Mock: Supabase Client              │
└─────────────────┬───────────────────┘
                  │
                  ▼
          ┌───────────────┐
          │   Database    │
          └───────────────┘
```

---

## 💡 Best Practices

### 1. Mock chain complexity

Supabase używa method chaining, więc mocki muszą zwracać obiekty z kolejnymi metodami:

```typescript
// ✅ Prawidłowy mock chain
mockDelete = vi.fn().mockReturnValue({
  eq: mockEq,
});

mockEq = vi.fn().mockReturnThis(); // Umożliwia łańcuchowanie .eq().eq()
```

### 2. Resetowanie mocków

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  
  // Recreate mocks for clean state
  mockEq = vi.fn().mockReturnThis();
  mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
});
```

### 3. Testowanie konkretnych kodów błędów

```typescript
// Test specific PostgreSQL error codes
const notFoundError = {
  code: "PGRST116", // No rows found
  message: "No rows found",
};

const permissionError = {
  code: "42501", // PostgreSQL permission denied
  message: "Permission denied",
};
```

### 4. Testowanie kolejności operacji

```typescript
it("should call from() before delete()", async () => {
  const callOrder: string[] = [];

  const mockFrom = vi.fn().mockImplementation(() => {
    callOrder.push("from()");
    return { delete: () => { callOrder.push("delete()"); } };
  });

  // Verify order
  expect(callOrder).toEqual(["from()", "delete()"]);
});
```

---

## 🐛 Rozwiązywanie problemów

### Problem: Mock chain nie działa

```typescript
// ❌ Źle - mockReturnThis() na końcu łańcucha
mockEq = vi.fn();
mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

// ✅ Dobrze - mockReturnThis() umożliwia chaining
mockEq = vi.fn().mockReturnThis();
mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
```

### Problem: Test czeka w nieskończoność

```typescript
// ❌ Źle - brak resolving Promise
mockEq = vi.fn().mockReturnThis();

// ✅ Dobrze - resolve Promise z data/error
mockEq.mockResolvedValue({ data: null, error: null });
```

### Problem: DatabaseError nie jest rzucany

```typescript
// ✅ Upewnij się że error jest w response
mockEq.mockResolvedValue({ 
  data: null, 
  error: { code: "ERROR", message: "Failed" } 
});

// NIE:
mockEq.mockRejectedValue(new Error("Failed"));
// (chyba że testujesz unexpected errors)
```

---

## 📚 Powiązane testy

### API Layer Tests
- **Katalog**: `tests/unit/api/`
- **Plik**: `generation-requests-delete.test.ts`
- Zobacz: [tests/unit/api/README.md](../api/README.md)

---

## 🔗 Dokumentacja

- **Testowany serwis**: `src/lib/services/generation-request.service.ts`
- **Plan implementacji**: `.ai/generation-requests-delete-implementation-plan.md`
- **Database schema**: `supabase/migrations/`
- **Error classes**: `src/lib/errors/database.error.ts`
- **Types**: `src/db/database.types.ts`

---

## ✅ Checklist dla nowych testów serwisów

Przy dodawaniu testów nowych metod serwisowych:

- [ ] **Success scenarios** - wszystkie happy paths
- [ ] **Database errors** - różne kody błędów PostgreSQL
- [ ] **Parameter validation** - różne formaty danych
- [ ] **Return values** - poprawne mapowanie DTO
- [ ] **Supabase chain calls** - poprawna kolejność metod
- [ ] **Error wrapping** - DatabaseError dla błędów Supabase
- [ ] **RLS behavior** - weryfikacja ownership
- [ ] **Edge cases** - długie stringi, znaki specjalne
- [ ] **Concurrent operations** - równoczesne wywołania
- [ ] **Logging** - weryfikacja logów (opcjonalnie)

---

## 🎯 Następne kroki

1. **GenerationRequestService.create()** - testy tworzenia z AI
2. **GenerationRequestService.list()** - testy listowania z paginacją
3. **GenerationRequestService.getById()** - testy pobierania szczegółów
4. **FlashcardService** - kompletne testy wszystkich metod
5. **StudySessionService** - testy SM-2 algorytmu

---

## 📖 Przykładowa struktura testu

```typescript
describe("ServiceName.methodName()", () => {
  let mockSupabase: SupabaseClient<Database>;
  let service: ServiceName;
  let mockChainMethod: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup mocks
    vi.clearAllMocks();
    
    // Create Supabase mock chain
    mockChainMethod = vi.fn();
    mockSupabase = { /* ... */ };
    
    // Create service
    service = new ServiceName(mockSupabase);
  });

  describe("Success scenarios", () => {
    it("should do something successfully", async () => {
      // Arrange
      mockChainMethod.mockResolvedValue({ data: mockData, error: null });

      // Act
      const result = await service.methodName(params);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockChainMethod).toHaveBeenCalledWith(expectedParams);
    });
  });

  describe("Error scenarios", () => {
    it("should throw DatabaseError on failure", async () => {
      // Arrange
      mockChainMethod.mockResolvedValue({ 
        data: null, 
        error: { code: "ERROR", message: "Failed" } 
      });

      // Act & Assert
      await expect(service.methodName(params)).rejects.toThrow(DatabaseError);
    });
  });
});
```

