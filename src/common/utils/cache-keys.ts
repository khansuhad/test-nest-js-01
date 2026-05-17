/**
 * Centralised cache-key builders. Keep all key shapes in one place so that
 * invalidation patterns stay aligned with reads.
 */
export const CacheKeys = {
  dashboard: (storeId: string) => `dashboard:${storeId}`,
  financeSummary: (storeId: string) => `finance:summary:${storeId}`,
  user: (userId: string) => `user:${userId}`,

  // Patterns (used with delByPattern)
  storeAll: (storeId: string) => `*:${storeId}*`,
  dashboardAll: () => `dashboard:*`,
  financeAll: () => `finance:*`,
};
