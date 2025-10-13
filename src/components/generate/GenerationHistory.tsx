/**
 * Generation History Component
 * 
 * Collapsible section showing recent generation requests
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GenerationRequestListResponse } from '@/types';

interface GenerationHistoryProps {
  onSelectRequest?: (requestId: string) => void;
}

export function GenerationHistory({ onSelectRequest }: GenerationHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['generation-requests', { limit: 5, page: 1 }],
    queryFn: async () => {
      const response = await apiClient.get<GenerationRequestListResponse>(
        '/generation-requests',
        { params: { limit: 5, page: 1, sort: 'created_at', order: 'desc' } }
      );
      return response.data;
    },
    enabled: isOpen,
  });

  const requests = data?.generation_requests || [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span>Historia generowania ({requests.length || '...'} ostatnich)</span>
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
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-2 mt-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Brak wcześniejszych generowań
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card
              key={request.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelectRequest?.(request.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1">
                      {new Date(request.created_at).toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {request.source_text.substring(0, 150)}...
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">{request.flashcard_count}</p>
                    <p className="text-xs text-muted-foreground">fiszek</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

