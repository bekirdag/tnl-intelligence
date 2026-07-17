import type { TnlNewsQuery, TnlStoryQuery } from './types.js';

type QueryValue = string | number | boolean | readonly string[] | null | undefined;

export function buildNewsQuery(query: TnlNewsQuery = {}): URLSearchParams {
  return buildQuery({
    page: query.page,
    page_size: query.pageSize,
    cursor: query.cursor,
    offset: query.offset,
    fields: query.fields,
    include: query.include,
    sort: query.sort,
    country: query.country,
    category: query.category,
    entity: query.entity,
    impact_path: query.impactPath,
    tag: query.tag,
    q: query.query,
    published_since: query.publishedSince,
    published_until: query.publishedUntil,
    updated_since: query.updatedSince,
    updated_until: query.updatedUntil,
  });
}

export function buildStoryQuery(query: TnlStoryQuery = {}): URLSearchParams {
  return buildQuery({
    fields: query.fields,
    include: query.include,
  });
}

export function buildQuery(values: Record<string, QueryValue>): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    result.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return result;
}
