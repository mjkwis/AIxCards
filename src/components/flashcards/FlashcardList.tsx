/**
 * Flashcard List Component
 *
 * Main component for displaying, filtering and sorting flashcards
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashcardCard } from "./FlashcardCard";
import { CreateFlashcardModal } from "./CreateFlashcardModal";
import type { FlashcardsListResponse, FlashcardStatus, FlashcardSource } from "@/types";

type SortOption = "created_at" | "updated_at" | "next_review_at";
type OrderOption = "asc" | "desc";

export function FlashcardList() {
  const [status, setStatus] = useState<FlashcardStatus | "all">("active");
  const [source, setSource] = useState<FlashcardSource | "all">("all");
  const [sort, setSort] = useState<SortOption>("created_at");
  const [order, setOrder] = useState<OrderOption>("desc");
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const limit = 20;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "flashcards",
      {
        status: status !== "all" ? status : undefined,
        source: source !== "all" ? source : undefined,
        sort,
        order,
        page,
        limit,
      },
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = { sort, order, page, limit };
      if (status !== "all") params.status = status;
      if (source !== "all") params.source = source;

      const response = await apiClient.get<FlashcardsListResponse>("/flashcards", { params });
      return response.data;
    },
  });

  const flashcards = data?.flashcards || [];
  const pagination = data?.pagination;

  const handleStatusChange = (value: string) => {
    setStatus(value as FlashcardStatus | "all");
    setPage(1);
  };

  const handleTabChange = (value: string) => {
    handleStatusChange(value);
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Moje fiszki</h2>
          <p className="text-sm text-muted-foreground mt-1">{pagination?.total || 0} fiszek w sumie</p>
        </div>
        <CreateFlashcardModal
          trigger={
            <Button>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Utwórz fiszkę
            </Button>
          }
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status Tabs */}
        <Tabs value={status} onValueChange={handleTabChange} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Wszystkie</TabsTrigger>
            <TabsTrigger value="active">Aktywne</TabsTrigger>
            <TabsTrigger value="pending_review">Oczekujące</TabsTrigger>
            <TabsTrigger value="rejected">Odrzucone</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Source Filter */}
        <Select
          value={source}
          onValueChange={(v) => {
            setSource(v as FlashcardSource | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Źródło" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie źródła</SelectItem>
            <SelectItem value="ai_generated">AI</SelectItem>
            <SelectItem value="manual">Ręczne</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={`${sort}-${order}`}
          onValueChange={(v) => {
            const [s, o] = v.split("-");
            setSort(s as SortOption);
            setOrder(o as OrderOption);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sortuj" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at-desc">Ostatnio dodane</SelectItem>
            <SelectItem value="created_at-asc">Najstarsze</SelectItem>
            <SelectItem value="next_review_at-asc">Najbliższa powtórka</SelectItem>
            <SelectItem value="updated_at-desc">Ostatnio edytowane</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Flashcards Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : flashcards.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-muted-foreground"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Brak fiszek</h3>
          <p className="text-muted-foreground mb-4">
            {status === "all"
              ? "Zacznij od wygenerowania fiszek z tekstu lub utwórz własne."
              : `Nie masz fiszek ze statusem "${status}".`}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => (window.location.href = "/dashboard/generate")}>Generuj fiszki</Button>
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              Utwórz fiszkę
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flashcards.map((flashcard) => (
              <FlashcardCard key={flashcard.id} flashcard={flashcard} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Strona {pagination.page} z {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  Poprzednia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pagination.total_pages || isFetching}
                >
                  Następna
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
