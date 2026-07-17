export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface TnlRateLimit {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

export interface TnlPageMetadata {
  page: number;
  page_size: number;
  offset: number;
  total_count: number;
  total_pages: number;
  has_more: boolean;
  cursor: string | null;
  next_cursor: string | null;
}

export interface TnlSource {
  id?: string;
  name?: string;
  label?: string;
  url?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

export interface TnlClaim {
  id?: string;
  text?: string;
  confidence?: number;
  verificationState?: string;
  [key: string]: unknown;
}

export interface TnlStory {
  id: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  category?: string;
  author?: string;
  date?: string;
  imageUrl?: string;
  readTime?: string | number;
  impact?: string;
  score?: string | number;
  countries?: string[];
  tags?: string[];
  body?: string;
  sourceCount?: number;
  claimCount?: number;
  contradictionCount?: number;
  urgencyScore?: number;
  truthPosterior?: number;
  publishedAt?: string;
  updatedAt?: string;
  collectedAt?: string;
  sourceLabel?: string;
  impactedAssets?: string[];
  impactedSectors?: string[];
  impactPaths?: string[];
  impactPathIds?: string[];
  passiveEntities?: string[];
  passiveEntityIds?: string[];
  sources?: TnlSource[];
  claims?: TnlClaim[];
  impactDetails?: unknown;
  primaryLocation?: string;
  primaryActor?: string;
  primaryAction?: string;
  primaryTarget?: string;
  storyStatus?: string;
  storyType?: string;
  signalClass?: string;
  verificationState?: string;
  viewCount?: number;
  recentViewCount?: number;
  popularityScore?: number;
  [key: string]: unknown;
}

export interface TnlSuggestion {
  type?: string;
  value?: string;
  label?: string;
  count?: number;
  [key: string]: unknown;
}

export interface TnlNewsPage {
  data: TnlStory[];
  page: TnlPageMetadata;
  filters?: TnlFilters;
  suggestions?: TnlSuggestion[];
  lastSyncAt?: string | null;
  entity?: string;
  impactPath?: string;
  asset?: string;
  savedSearch?: TnlSavedSearch;
  query?: Record<string, string>;
  [key: string]: unknown;
}

export interface TnlLookupItem {
  id?: string;
  value?: string;
  label?: string;
  type?: string;
  count?: number;
  [key: string]: unknown;
}

export interface TnlLookupResponse {
  data: TnlLookupItem[];
  lastSyncAt?: string | null;
  [key: string]: unknown;
}

export interface TnlFilters {
  categories?: string[];
  countries?: string[];
  lastSyncAt?: string | null;
  [key: string]: unknown;
}

export interface TnlMarketQuote {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  source?: string;
  sourceSymbol?: string;
  updatedAt?: string;
  collectedAt?: string;
  [key: string]: unknown;
}

export interface TnlMarketResponse {
  data: TnlMarketQuote[];
  lastSyncAt?: string | null;
  lastError?: string | null;
  [key: string]: unknown;
}

export interface TnlAccountResponse {
  key?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TnlSavedSearchFilters {
  category?: string;
  country?: string;
  entity?: string;
  impactPath?: string;
  tag?: string;
  sort?: string;
  publishedSince?: string;
  publishedUntil?: string;
  updatedSince?: string;
  updatedUntil?: string;
  fields?: string;
  include?: string;
}

export interface TnlSavedSearch {
  id: string;
  name?: string;
  query?: string;
  filters?: TnlSavedSearchFilters;
  alertEnabled?: boolean;
  webhookUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TnlSavedSearchInput {
  name: string;
  query?: string;
  filters?: TnlSavedSearchFilters;
  alertEnabled?: boolean;
  webhookUrl?: string | null;
}

export interface TnlSavedSearchList {
  data: TnlSavedSearch[];
  maxSavedSearches?: number;
  [key: string]: unknown;
}

export interface TnlDataResponse<T> {
  data: T;
  [key: string]: unknown;
}

export interface TnlAiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TnlAiRequest {
  question: string;
  conversationId?: string;
  messages?: TnlAiMessage[];
}

export interface TnlCitation {
  id?: string;
  title?: string;
  url?: string;
  excerpt?: string;
  [key: string]: unknown;
}

export interface TnlAiResult {
  answer?: string;
  conversation?: Record<string, unknown>;
  message?: Record<string, unknown>;
  citations?: TnlCitation[];
  model?: string;
  agentSlug?: string;
  repoKey?: string;
  context?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TnlAiResponse {
  data: TnlAiResult;
  [key: string]: unknown;
}

export type TnlSort = 'pipeline' | 'popular' | string;

export interface TnlNewsQuery {
  page?: number;
  pageSize?: number;
  cursor?: string;
  offset?: number;
  fields?: string | readonly string[];
  include?: string | readonly string[];
  sort?: TnlSort;
  country?: string;
  category?: string;
  entity?: string;
  impactPath?: string;
  tag?: string;
  query?: string;
  publishedSince?: string;
  publishedUntil?: string;
  updatedSince?: string;
  updatedUntil?: string;
}

export interface TnlSearchQuery extends Omit<TnlNewsQuery, 'query'> {
  query: string;
}

export interface TnlLookupQuery {
  query?: string;
  limit?: number;
}

export interface TnlStoryQuery {
  fields?: string | readonly string[];
  include?: string | readonly string[];
}
