import { readFileSync } from 'node:fs';

export interface SampleManifest {
  dataset: string;
  version: string;
  schemaVersion: string;
  generatedAt: string;
  license: string;
  provenance: string;
  staticOnly: true;
}

export interface SampleStory {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  country: string;
  impactedAssets: readonly string[];
  impactPaths: readonly string[];
  entities: readonly { id: string; name: string; type: string }[];
  [key: string]: unknown;
}

interface SampleFile {
  data: SampleStory[];
}

export class SampleCatalog {
  readonly manifest: SampleManifest;
  readonly stories: readonly SampleStory[];

  constructor(
    manifest: SampleManifest = loadJson<SampleManifest>('manifest.json'),
    stories: readonly SampleStory[] = loadJson<SampleFile>('news.json').data,
  ) {
    if (manifest.staticOnly !== true) throw new TypeError('Sample catalog must be static-only');
    this.manifest = structuredClone(manifest);
    this.stories = structuredClone(stories);
  }

  page(
    query: {
      query?: string;
      category?: string;
      country?: string;
      asset?: string;
      entity?: string;
      impactPath?: string;
      pageSize?: number;
      cursor?: string;
    } = {},
  ) {
    const normalized = query.query?.trim().toLowerCase();
    const filtered = this.stories.filter((story) => {
      if (
        normalized &&
        ![story.title, story.excerpt, story.category, story.country].some((value) =>
          value.toLowerCase().includes(normalized),
        )
      )
        return false;
      if (query.category && story.category.toLowerCase() !== query.category.toLowerCase())
        return false;
      if (query.country && story.country.toLowerCase() !== query.country.toLowerCase())
        return false;
      if (
        query.asset &&
        !story.impactedAssets.some((asset) => asset.toLowerCase() === query.asset?.toLowerCase())
      )
        return false;
      if (
        query.entity &&
        !story.entities.some(
          (entity) =>
            entity.id === query.entity || entity.name.toLowerCase() === query.entity?.toLowerCase(),
        )
      )
        return false;
      if (query.impactPath && !story.impactPaths.includes(query.impactPath)) return false;
      return true;
    });
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 20);
    const offset = decodeCursor(query.cursor);
    const data = filtered.slice(offset, offset + pageSize);
    const nextOffset = offset + data.length;
    const hasMore = nextOffset < filtered.length;
    return {
      data,
      page: {
        page: Math.floor(offset / pageSize) + 1,
        page_size: pageSize,
        offset,
        total_count: filtered.length,
        total_pages: Math.ceil(filtered.length / pageSize),
        has_more: hasMore,
        cursor: query.cursor ?? null,
        next_cursor: hasMore ? encodeCursor(nextOffset) : null,
      },
      sample: this.manifest,
    };
  }

  story(idOrSlug: string): SampleStory | undefined {
    return this.stories.find((story) => story.id === idOrSlug || story.slug === idOrSlug);
  }

  entities() {
    const values = new Map<
      string,
      { id: string; value: string; type: string; storyCount: number }
    >();
    for (const story of this.stories) {
      for (const entity of story.entities) {
        const current = values.get(entity.id);
        values.set(entity.id, {
          id: entity.id,
          value: entity.name,
          type: entity.type,
          storyCount: (current?.storyCount ?? 0) + 1,
        });
      }
    }
    return { data: [...values.values()], sample: this.manifest };
  }

  impactPaths() {
    const values = [...new Set(this.stories.flatMap((story) => story.impactPaths))];
    return {
      data: values.map((value, index) => ({ id: `sample-impact-${index + 1}`, value })),
      sample: this.manifest,
    };
  }
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../sample/v1/${name}`, import.meta.url), 'utf8')) as T;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const value = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
