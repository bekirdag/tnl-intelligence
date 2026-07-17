import type { TnlNewsPage, TnlStory } from '@theneuralledger/sdk';

export type Writer = (text: string) => void;

export function writeJson(write: Writer, value: unknown): void {
  write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writeStories(write: Writer, page: TnlNewsPage): void {
  if (page.data.length === 0) {
    write('No matching intelligence found.\n');
    return;
  }
  for (const [index, story] of page.data.entries()) {
    write(`${index + 1}. ${storyLine(story)}\n`);
  }
  write(`Returned ${page.data.length} of ${page.page.total_count}.\n`);
}

function storyLine(story: TnlStory): string {
  const title = story.title || story.slug || story.id;
  const context = [story.category, story.publishedAt || story.date, story.verificationState]
    .filter(Boolean)
    .join(' | ');
  return context ? `${title} (${context})` : title;
}
