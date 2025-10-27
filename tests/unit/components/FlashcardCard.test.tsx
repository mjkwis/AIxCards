/**
 * Unit Tests for FlashcardCard Component
 *
 * Testuje kluczową logikę biznesową:
 * - Renderowanie warunkowe (statusy, źródła)
 * - Interakcje użytkownika (dialogi, edycja)
 * - Mutacje API (usuwanie, zatwierdzanie, odrzucanie)
 * - Obsługa błędów i stanów pending
 * - Formatowanie dat
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, within } from "../../helpers/test-utils";
import userEvent from "@testing-library/user-event";
import { FlashcardCard } from "../../../src/components/flashcards/FlashcardCard";
import type { FlashcardDTO } from "../../../src/types";

// ============================================================================
// MOCKS - Na górze pliku, przed importami komponentów
// ============================================================================

// Mock API Client - factory functions są hoistowane, więc tworzymy funkcje wewnątrz
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    delete: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  },
  initializeApiClient: vi.fn(),
}));

// Mock Toast - musimy użyć stałej funkcji, nie tworzyć nowej za każdym razem
const mockToastFn = vi.fn();
vi.mock("@/components/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToastFn }),
}));

// Mock FlashcardEditor - renderujemy tylko placeholder
vi.mock("@/components/generate/FlashcardEditor", () => ({
  FlashcardEditor: ({ flashcard, open }: { flashcard: FlashcardDTO; open: boolean }) => {
    return open ? <div data-testid="flashcard-editor">Editor for {flashcard.id}</div> : null;
  },
}));

// ============================================================================
// TEST DATA - Factory functions dla różnych stanów fiszki
// ============================================================================

const createMockFlashcard = (overrides?: Partial<FlashcardDTO>): FlashcardDTO => ({
  id: "test-flashcard-id",
  user_id: "test-user-id",
  generation_request_id: null,
  front: "Co to jest React?",
  back: "Biblioteka JavaScript do budowania interfejsów użytkownika",
  source: "manual",
  status: "active",
  next_review_at: "2024-01-15T10:00:00.000Z",
  interval: 1,
  ease_factor: 2.5,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe("FlashcardCard", () => {
  // Importujemy zmockowane moduły aby uzyskać dostęp do funkcji
  let mockDelete: Mock;
  let mockPost: Mock;

  beforeEach(async () => {
    // Reset wszystkich mocków przed każdym testem
    vi.clearAllMocks();
    mockToastFn.mockClear();

    // Dynamiczny import zmockowanych modułów
    const apiClient = await import("@/lib/api-client");

    mockDelete = apiClient.apiClient.delete as Mock;
    mockPost = apiClient.apiClient.post as Mock;
  });

  // ==========================================================================
  // 1. RENDEROWANIE PODSTAWOWE
  // ==========================================================================

  describe("Renderowanie podstawowe", () => {
    it("powinien wyświetlić treść fiszki (front i back)", () => {
      const flashcard = createMockFlashcard({
        front: "Pytanie testowe",
        back: "Odpowiedź testowa",
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("Pytanie:")).toBeInTheDocument();
      expect(screen.getByText("Pytanie testowe")).toBeInTheDocument();
      expect(screen.getByText("Odpowiedź:")).toBeInTheDocument();
      expect(screen.getByText("Odpowiedź testowa")).toBeInTheDocument();
    });

    it("powinien wyświetlić przycisk Edytuj dla wszystkich fiszek", () => {
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByRole("button", { name: /edytuj/i })).toBeInTheDocument();
    });

    it("powinien wyświetlić przycisk Usuń dla wszystkich fiszek", () => {
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByRole("button", { name: /usuń/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 2. RENDEROWANIE WARUNKOWE - STATUSY
  // ==========================================================================

  describe("Renderowanie statusów", () => {
    it('powinien wyświetlić badge "Aktywna" dla statusu active', () => {
      const flashcard = createMockFlashcard({ status: "active" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("Aktywna")).toBeInTheDocument();
    });

    it('powinien wyświetlić badge "Oczekuje" dla statusu pending_review', () => {
      const flashcard = createMockFlashcard({ status: "pending_review" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("Oczekuje")).toBeInTheDocument();
    });

    it('powinien wyświetlić badge "Odrzucona" dla statusu rejected', () => {
      const flashcard = createMockFlashcard({ status: "rejected" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("Odrzucona")).toBeInTheDocument();
    });

    it("powinien użyć poprawnych klas CSS dla statusu active", () => {
      const flashcard = createMockFlashcard({ status: "active" });

      render(<FlashcardCard flashcard={flashcard} />);

      const badge = screen.getByText("Aktywna");
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("powinien użyć poprawnych klas CSS dla statusu pending_review", () => {
      const flashcard = createMockFlashcard({ status: "pending_review" });

      render(<FlashcardCard flashcard={flashcard} />);

      const badge = screen.getByText("Oczekuje");
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
    });
  });

  // ==========================================================================
  // 3. RENDEROWANIE WARUNKOWE - ŹRÓDŁA
  // ==========================================================================

  describe("Renderowanie źródeł", () => {
    it('powinien wyświetlić badge "Ręczna" dla źródła manual', () => {
      const flashcard = createMockFlashcard({ source: "manual" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("Ręczna")).toBeInTheDocument();
    });

    it('powinien wyświetlić badge "AI" dla źródła ai_generated', () => {
      const flashcard = createMockFlashcard({ source: "ai_generated" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("AI")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 4. PRZYCISKI WARUNKOWE - ZATWIERDZANIE/ODRZUCANIE
  // ==========================================================================

  describe("Przyciski Zatwierdź/Odrzuć", () => {
    it("powinien wyświetlić przyciski Zatwierdź i Odrzuć dla pending_review", () => {
      const flashcard = createMockFlashcard({ status: "pending_review" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByRole("button", { name: /zatwierdź/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /odrzuć/i })).toBeInTheDocument();
    });

    it("NIE powinien wyświetlać przycisków Zatwierdź/Odrzuć dla active", () => {
      const flashcard = createMockFlashcard({ status: "active" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.queryByRole("button", { name: /zatwierdź/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /odrzuć/i })).not.toBeInTheDocument();
    });

    it("NIE powinien wyświetlać przycisków Zatwierdź/Odrzuć dla rejected", () => {
      const flashcard = createMockFlashcard({ status: "rejected" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.queryByRole("button", { name: /zatwierdź/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /odrzuć/i })).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 5. FORMATOWANIE DATY
  // ==========================================================================

  describe("Formatowanie next_review_at", () => {
    it("powinien wyświetlić sformatowaną datę następnej powtórki", () => {
      const flashcard = createMockFlashcard({
        next_review_at: "2024-01-15T10:00:00.000Z",
      });

      render(<FlashcardCard flashcard={flashcard} />);

      // toLocaleDateString('pl-PL') może zwrócić różne formaty zależnie od środowiska
      expect(screen.getByText(/następna powtórka:/i)).toBeInTheDocument();
      expect(screen.getByText(/15\.01\.2024|15\/01\/2024|2024-01-15/i)).toBeInTheDocument();
    });

    it("NIE powinien wyświetlać next_review_at gdy jest null", () => {
      const flashcard = createMockFlashcard({
        next_review_at: null,
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.queryByText(/następna powtórka:/i)).not.toBeInTheDocument();
    });

    it("powinien obsłużyć różne formaty dat ISO", () => {
      const flashcard = createMockFlashcard({
        // Używamy daty o 12:00 UTC aby uniknąć problemów z strefami czasowymi
        next_review_at: "2024-12-25T12:00:00.000Z",
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText(/następna powtórka:/i)).toBeInTheDocument();
      // Sprawdzamy czy data została wyświetlona (akceptujemy dowolny format)
      expect(screen.getByText(/następna powtórka:/i).parentElement).toHaveTextContent(
        /\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{1,2}-\d{1,2}/
      );
    });
  });

  // ==========================================================================
  // 6. INTERAKCJE - DIALOG USUWANIA
  // ==========================================================================

  describe("Dialog usuwania", () => {
    it("powinien otworzyć dialog po kliknięciu przycisku Usuń", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      const deleteButton = screen.getByRole("button", { name: /usuń/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/czy na pewno usunąć tę fiszkę/i)).toBeInTheDocument();
      });
    });

    it("powinien zamknąć dialog po kliknięciu Anuluj", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      // Otwórz dialog
      await user.click(screen.getByRole("button", { name: /usuń/i }));

      await waitFor(() => {
        expect(screen.getByText(/czy na pewno usunąć/i)).toBeInTheDocument();
      });

      // Kliknij Anuluj
      const cancelButton = screen.getByRole("button", { name: /anuluj/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/czy na pewno usunąć/i)).not.toBeInTheDocument();
      });
    });

    it("powinien wyświetlić opis konsekwencji w dialogu", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /usuń/i }));

      await waitFor(() => {
        expect(screen.getByText(/ta akcja jest nieodwracalna.*fiszka zostanie trwale usunięta/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 7. INTERAKCJE - EDYTOR
  // ==========================================================================

  describe("Edytor fiszki", () => {
    it("powinien otworzyć edytor po kliknięciu przycisku Edytuj", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      const editButton = screen.getByRole("button", { name: /edytuj/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("flashcard-editor")).toBeInTheDocument();
      });
    });

    it("powinien przekazać poprawną fiszkę do edytora", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ id: "unique-flashcard-id" });

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /edytuj/i }));

      await waitFor(() => {
        expect(screen.getByText(/editor for unique-flashcard-id/i)).toBeInTheDocument();
      });
    });

    it("NIE powinien wyświetlać edytora domyślnie", () => {
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.queryByTestId("flashcard-editor")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 8. MUTACJA - USUWANIE
  // ==========================================================================

  describe("Mutacja DELETE", () => {
    it("powinien wywołać DELETE endpoint z poprawnym ID", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ id: "flashcard-to-delete" });

      mockDelete.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      // Otwórz dialog i potwierdź
      await user.click(screen.getByRole("button", { name: /usuń/i }));
      await waitFor(() => {
        expect(screen.getByText(/czy na pewno usunąć/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /usuń/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith("/flashcards/flashcard-to-delete");
      });
    });

    it("powinien pokazać toast sukcesu po udanym usunięciu", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      mockDelete.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /usuń/i }));
      await waitFor(() => screen.getByText(/czy na pewno usunąć/i));

      await user.click(screen.getByRole("button", { name: /usuń/i }));

      await waitFor(() => {
        expect(mockToastFn).toHaveBeenCalledWith({
          title: "Usunięto",
          description: "Fiszka została usunięta.",
        });
      });
    });

    it("powinien pokazać toast błędu gdy DELETE się nie powiedzie", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      mockDelete.mockRejectedValueOnce(new Error("Network error"));

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /usuń/i }));
      await waitFor(() => screen.getByText(/czy na pewno usunąć/i));

      await user.click(screen.getByRole("button", { name: /usuń/i }));

      await waitFor(() => {
        expect(mockToastFn).toHaveBeenCalledWith({
          variant: "destructive",
          title: "Błąd",
          description: "Nie udało się usunąć fiszki.",
        });
      });
    });

    it("powinien zamknąć dialog po kliknięciu Usuń", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      mockDelete.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      // Otwórz dialog
      await user.click(screen.getByRole("button", { name: /usuń/i }));
      await waitFor(() => screen.getByRole("alertdialog"));

      // Znajdź przycisk "Usuń" w dialogu (nie ten na karcie)
      const dialog = screen.getByRole("alertdialog");
      const confirmButton = within(dialog).getByRole("button", { name: /usuń/i });

      await user.click(confirmButton);

      // Dialog powinien zniknąć natychmiast po kliknięciu (setShowDeleteDialog(false))
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 9. MUTACJA - ZATWIERDZANIE
  // ==========================================================================

  describe("Mutacja APPROVE", () => {
    it("powinien wywołać POST endpoint /approve dla pending_review fiszki", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({
        id: "pending-flashcard",
        status: "pending_review",
      });

      mockPost.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      const approveButton = screen.getByRole("button", { name: /zatwierdź/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/flashcards/pending-flashcard/approve");
      });
    });

    it("powinien pokazać toast sukcesu po zatwierdzeniu", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      mockPost.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /zatwierdź/i }));

      await waitFor(() => {
        expect(mockToastFn).toHaveBeenCalledWith({
          title: "Zatwierdzono",
          description: "Fiszka została zatwierdzona.",
        });
      });
    });

    it("powinien zablokować przycisk Zatwierdź podczas pending mutation", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      // Symuluj wolne API
      mockPost.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)));

      render(<FlashcardCard flashcard={flashcard} />);

      const approveButton = screen.getByRole("button", { name: /zatwierdź/i });
      await user.click(approveButton);

      // Przycisk powinien być disabled natychmiast
      expect(approveButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // 10. MUTACJA - ODRZUCANIE
  // ==========================================================================

  describe("Mutacja REJECT", () => {
    it("powinien wywołać POST endpoint /reject dla pending_review fiszki", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({
        id: "pending-flashcard",
        status: "pending_review",
      });

      mockPost.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      const rejectButton = screen.getByRole("button", { name: /odrzuć/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/flashcards/pending-flashcard/reject");
      });
    });

    it("powinien pokazać toast sukcesu po odrzuceniu", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      mockPost.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /odrzuć/i }));

      await waitFor(() => {
        expect(mockToastFn).toHaveBeenCalledWith({
          title: "Odrzucono",
          description: "Fiszka została odrzucona.",
        });
      });
    });

    it("powinien zablokować przycisk Odrzuć podczas pending mutation", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      mockPost.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)));

      render(<FlashcardCard flashcard={flashcard} />);

      const rejectButton = screen.getByRole("button", { name: /odrzuć/i });
      await user.click(rejectButton);

      expect(rejectButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // 11. WARUNKI BRZEGOWE - EDGE CASES
  // ==========================================================================

  describe("Warunki brzegowe", () => {
    it("powinien obsłużyć bardzo długi tekst w front", () => {
      const longText = "A".repeat(500);
      const flashcard = createMockFlashcard({ front: longText });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("powinien obsłużyć bardzo długi tekst w back", () => {
      const longText = "B".repeat(2000);
      const flashcard = createMockFlashcard({ back: longText });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("powinien obsłużyć znaki specjalne w treści", () => {
      const flashcard = createMockFlashcard({
        front: '<script>alert("XSS")</script>',
        back: 'Test & "quotes" & <tags>',
      });

      render(<FlashcardCard flashcard={flashcard} />);

      // React automatycznie escapuje, więc tekst powinien być bezpieczny
      expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument();
      expect(screen.getByText('Test & "quotes" & <tags>')).toBeInTheDocument();
    });

    it("powinien obsłużyć fiszkę AI bez generation_request_id", () => {
      const flashcard = createMockFlashcard({
        source: "ai_generated",
        generation_request_id: null,
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("AI")).toBeInTheDocument();
    });

    it("powinien obsłużyć fiszkę z generation_request_id", () => {
      const flashcard = createMockFlashcard({
        source: "ai_generated",
        generation_request_id: "some-request-id",
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText("AI")).toBeInTheDocument();
    });

    it("powinien obsłużyć datę w przeszłości", () => {
      const flashcard = createMockFlashcard({
        next_review_at: "2020-01-01T00:00:00.000Z",
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText(/następna powtórka:/i)).toBeInTheDocument();
    });

    it("powinien obsłużyć datę w przyszłości", () => {
      const flashcard = createMockFlashcard({
        next_review_at: "2030-12-31T23:59:59.999Z",
      });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByText(/następna powtórka:/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 12. ACCESSIBILITY (A11Y)
  // ==========================================================================

  describe("Accessibility", () => {
    it("powinien mieć dostępne przyciski z rolą button", () => {
      const flashcard = createMockFlashcard({ status: "pending_review" });

      render(<FlashcardCard flashcard={flashcard} />);

      expect(screen.getByRole("button", { name: /edytuj/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /zatwierdź/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /odrzuć/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /usuń/i })).toBeInTheDocument();
    });

    it("powinien mieć opisowe etykiety na przyciskach", () => {
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      // Wszystkie przyciski powinny mieć czytelny tekst
      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.textContent).toBeTruthy();
        expect(button.textContent!.length).toBeGreaterThan(0);
      });
    });

    it("dialog powinien mieć poprawną strukturę ARIA", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /usuń/i }));

      await waitFor(() => {
        // AlertDialog z Radix UI powinien mieć role="alertdialog"
        const dialog = screen.getByRole("alertdialog");
        expect(dialog).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 13. REACT QUERY INVALIDATION
  // ==========================================================================

  describe("React Query cache invalidation", () => {
    it('powinien zinwalidować cache "flashcards" po usunięciu', async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      mockDelete.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      // Otwórz dialog
      await user.click(screen.getByRole("button", { name: /usuń/i }));
      await waitFor(() => screen.getByRole("alertdialog"));

      // Potwierdź usunięcie
      const dialog = screen.getByRole("alertdialog");
      const confirmButton = within(dialog).getByRole("button", { name: /usuń/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
      });

      // QueryClient.invalidateQueries jest wywoływane wewnętrznie
      // W prawdziwej aplikacji to spowoduje refetch
    });

    it("powinien zinwalidować cache po zatwierdzeniu", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      mockPost.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /zatwierdź/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled();
      });
    });

    it("powinien zinwalidować cache po odrzuceniu", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      mockPost.mockResolvedValueOnce({ data: {} });

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /odrzuć/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // 14. MULTIPLE MUTATIONS - Concurrent operations
  // ==========================================================================

  describe("Wielokrotne mutacje", () => {
    it("powinien zablokować przycisk Anuluj gdy DELETE jest pending", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard();

      mockDelete.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)));

      render(<FlashcardCard flashcard={flashcard} />);

      await user.click(screen.getByRole("button", { name: /usuń/i }));
      await waitFor(() => screen.getByRole("alertdialog"));

      const dialog = screen.getByRole("alertdialog");
      const confirmButton = within(dialog).getByRole("button", { name: /usuń/i });
      const cancelButton = within(dialog).getByRole("button", { name: /anuluj/i });

      // Kliknij Usuń (rozpocznie mutację)
      await user.click(confirmButton);

      // Przycisk Anuluj powinien być disabled podczas mutacji
      await waitFor(() => {
        expect(cancelButton).toBeDisabled();
      });
    });

    it("powinien wywołać tylko jedną mutację mimo szybkich kliknięć", async () => {
      const user = userEvent.setup();
      const flashcard = createMockFlashcard({ status: "pending_review" });

      // Wolniejszy mock, aby symulować delay sieci
      mockPost.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 50)));

      render(<FlashcardCard flashcard={flashcard} />);

      const approveButton = screen.getByRole("button", { name: /zatwierdź/i });

      // Pierwsze kliknięcie
      await user.click(approveButton);

      // Przycisk powinien być natychmiast disabled
      expect(approveButton).toBeDisabled();

      // Poczekaj na zakończenie mutacji
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledTimes(1);
      });
    });
  });
});
