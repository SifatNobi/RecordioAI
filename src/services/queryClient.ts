import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  agents: ['agents'] as const,
  agent: (id: string) => ['agents', id] as const,
  conversations: (filters?: Record<string, unknown>) => ['conversations', filters] as const,
  conversation: (id: string) => ['conversations', id] as const,
  transcript: (conversationId: string) => ['transcript', conversationId] as const,
  analysis: (conversationId: string) => ['analysis', conversationId] as const,
  receipt: (conversationId: string) => ['receipt', conversationId] as const,
  quality: (conversationId: string) => ['quality', conversationId] as const,
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  disputes: ['disputes'] as const,
  dispute: (id: string) => ['disputes', id] as const,
  evidence: (conversationId: string) => ['evidence', conversationId] as const,
  audit: (recordType: string, recordId: string) => ['audit', recordType, recordId] as const,
  search: (query: string) => ['search', query] as const,
  entitlements: ['entitlements'] as const,
  offerings: ['offerings'] as const,
} as const;