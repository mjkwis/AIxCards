# Testy jednostkowe komponentów FlashcardCard

## 📊 Podsumowanie

**Plik**: `FlashcardCard.test.tsx`  
**Liczba testów**: 47  
**Status**: ✅ Wszystkie testy przechodzą  
**Pokrycie**: Kompleksowe testy logiki biznesowej, mutacji API i accessibility

---

## 🎯 Testowane obszary

### 1. Renderowanie podstawowe (3 testy)
- ✅ Wyświetlanie treści fiszki (front i back)
- ✅ Przycisk Edytuj
- ✅ Przycisk Usuń

### 2. Renderowanie statusów (5 testów)
- ✅ Badge "Aktywna" dla statusu `active`
- ✅ Badge "Oczekuje" dla statusu `pending_review`
- ✅ Badge "Odrzucona" dla statusu `rejected`
- ✅ Poprawne klasy CSS dla statusu `active`
- ✅ Poprawne klasy CSS dla statusu `pending_review`

### 3. Renderowanie źródeł (2 testy)
- ✅ Badge "Ręczna" dla źródła `manual`
- ✅ Badge "AI" dla źródła `ai_generated`

### 4. Przyciski warunkowe (3 testy)
- ✅ Wyświetlanie przycisków Zatwierdź/Odrzuć dla `pending_review`
- ✅ Brak przycisków Zatwierdź/Odrzuć dla `active`
- ✅ Brak przycisków Zatwierdź/Odrzuć dla `rejected`

### 5. Formatowanie dat (3 testy)
- ✅ Wyświetlanie sformatowanej daty `next_review_at`
- ✅ Ukrywanie `next_review_at` gdy jest `null`
- ✅ Obsługa różnych formatów dat ISO

### 6. Dialog usuwania (3 testy)
- ✅ Otwieranie dialogu po kliknięciu Usuń
- ✅ Zamykanie dialogu po kliknięciu Anuluj
- ✅ Wyświetlanie opisu konsekwencji

### 7. Edytor fiszki (3 testy)
- ✅ Otwieranie edytora po kliknięciu Edytuj
- ✅ Przekazywanie poprawnej fiszki do edytora
- ✅ Brak edytora domyślnie

### 8. Mutacja DELETE (4 testy)
- ✅ Wywołanie DELETE endpoint z poprawnym ID
- ✅ Toast sukcesu po udanym usunięciu
- ✅ Toast błędu gdy DELETE się nie powiedzie
- ✅ Zamykanie dialogu po kliknięciu Usuń

### 9. Mutacja APPROVE (3 testy)
- ✅ Wywołanie POST `/approve` dla `pending_review`
- ✅ Toast sukcesu po zatwierdzeniu
- ✅ Blokowanie przycisku podczas pending mutation

### 10. Mutacja REJECT (3 testy)
- ✅ Wywołanie POST `/reject` dla `pending_review`
- ✅ Toast sukcesu po odrzuceniu
- ✅ Blokowanie przycisku podczas pending mutation

### 11. Warunki brzegowe (7 testów)
- ✅ Bardzo długi tekst w `front` (500 znaków)
- ✅ Bardzo długi tekst w `back` (2000 znaków)
- ✅ Znaki specjalne w treści (XSS protection)
- ✅ Fiszka AI bez `generation_request_id`
- ✅ Fiszka AI z `generation_request_id`
- ✅ Data w przeszłości
- ✅ Data w przyszłości

### 12. Accessibility (3 testy)
- ✅ Dostępne przyciski z rolą `button`
- ✅ Opisowe etykiety na przyciskach
- ✅ Dialog z poprawną strukturą ARIA (`alertdialog`)

### 13. React Query cache invalidation (3 testy)
- ✅ Inwalidacja cache po usunięciu
- ✅ Inwalidacja cache po zatwierdzeniu
- ✅ Inwalidacja cache po odrzuceniu

### 14. Wielokrotne mutacje (2 testy)
- ✅ Blokowanie przycisku Anuluj podczas DELETE
- ✅ Tylko jedna mutacja mimo szybkich kliknięć

---

## 🔧 Kluczowe techniki testowania

### Mockowanie modułów

```typescript
// API Client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

// Toast notifications
const mockToastFn = vi.fn();
vi.mock('@/components/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToastFn }),
}));

// FlashcardEditor
vi.mock('@/components/generate/FlashcardEditor', () => ({
  FlashcardEditor: ({ flashcard, open }: Props) => {
    return open ? <div data-testid="flashcard-editor">Editor for {flashcard.id}</div> : null;
  },
}));
```

### Factory functions dla danych testowych

```typescript
const createMockFlashcard = (overrides?: Partial<FlashcardDTO>): FlashcardDTO => ({
  id: 'test-flashcard-id',
  user_id: 'test-user-id',
  front: 'Co to jest React?',
  back: 'Biblioteka JavaScript do budowania interfejsów użytkownika',
  source: 'manual',
  status: 'active',
  next_review_at: '2024-01-15T10:00:00.000Z',
  interval: 1,
  ease_factor: 2.5,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});
```

### Testowanie interakcji użytkownika

```typescript
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /usuń/i }));
await waitFor(() => screen.getByRole('alertdialog'));
```

### Testowanie mutacji z React Query

```typescript
mockDelete.mockResolvedValueOnce({ data: {} });

await user.click(confirmButton);

await waitFor(() => {
  expect(mockDelete).toHaveBeenCalledWith('/flashcards/test-id');
  expect(mockToastFn).toHaveBeenCalledWith({
    title: 'Usunięto',
    description: 'Fiszka została usunięta.',
  });
});
```

### Testowanie dostępności (A11Y)

```typescript
// Sprawdzanie ról ARIA
expect(screen.getByRole('button', { name: /edytuj/i })).toBeInTheDocument();
expect(screen.getByRole('alertdialog')).toBeInTheDocument();

// Użycie within() do zawężenia zakresu
const dialog = screen.getByRole('alertdialog');
const confirmButton = within(dialog).getByRole('button', { name: /usuń/i });
```

---

## 📝 Lekcje wyciągnięte

### 1. **Problemy z vi.mock() hoisting**
- ❌ **Błąd**: Używanie zmiennych zdefiniowanych poza factory function
- ✅ **Rozwiązanie**: Definiuj mocki bezpośrednio wewnątrz `vi.mock()` lub użyj stałych na poziomie modułu

### 2. **Toast mock musi być stały**
- ❌ **Błąd**: Nowa instancja `vi.fn()` przy każdym wywołaniu `useToast()`
- ✅ **Rozwiązanie**: Użyj jednej stałej `mockToastFn` współdzielonej przez wszystkie testy

### 3. **Disabled przyciski i pointer-events**
- ❌ **Błąd**: Testing Library nie może kliknąć disabled przycisków (`pointer-events: none`)
- ✅ **Rozwiązanie**: Sprawdzaj stan `disabled` przed mutacją, nie próbuj klikać po disable

### 4. **Formatowanie dat i strefy czasowe**
- ❌ **Błąd**: `toLocaleDateString()` zwraca różne formaty w różnych środowiskach/strefach
- ✅ **Rozwiązanie**: Używaj dat o 12:00 UTC lub akceptuj wiele formatów w assertions

### 5. **Selektory w dialogach**
- ❌ **Błąd**: `getAllByRole('button')` zwraca przyciski z całej strony
- ✅ **Rozwiązanie**: Użyj `within(dialog)` aby zawęzić zakres do konkretnego kontenera

---

## 🚀 Uruchamianie testów

```bash
# Wszystkie testy FlashcardCard
npm test -- FlashcardCard.test.tsx

# Watch mode
npm test -- FlashcardCard.test.tsx --watch

# Z pokryciem kodu
npm test -- FlashcardCard.test.tsx --coverage

# Konkretny test
npm test -- FlashcardCard.test.tsx -t "powinien wyświetlić badge Aktywna"
```

---

## 📚 Następne kroki

1. **FlashcardEditor.tsx** - testy walidacji formularza
2. **Type guards** (types.ts) - testy funkcji `isFlashcardStatus`, `isValidQuality`
3. **Utility functions** (lib/utils.ts) - testy funkcji `cn()`
4. **Komponenty list** - FlashcardList, GeneratedFlashcardList

---

## 🔗 Powiązane pliki

- **Testowany komponent**: `src/components/flashcards/FlashcardCard.tsx`
- **Test utils**: `tests/helpers/test-utils.tsx`
- **Mock data**: `tests/helpers/mock-data.ts`
- **Konfiguracja Vitest**: `vitest.config.ts`

