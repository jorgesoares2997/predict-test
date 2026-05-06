import type { Market } from '@/types';

/** Resolved category label for API payloads that use `category: { id, name }`. */
export function marketCategoryLabel(market: Pick<Market, 'category'>): string {
  const name = market.category?.name?.trim();
  if (name) return name;
  return 'Uncategorized';
}
