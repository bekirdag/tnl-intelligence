import type { ResearchResult } from '@theneuralledger/research';

export function renderResearchMarkdown(result: ResearchResult): string {
  const citationByEvidence = new Map(
    result.citations.map((citation) => [citation.evidenceId, citation] as const),
  );
  const claims = result.claims.length
    ? result.claims
        .map((claim) => {
          const citations = claim.supportingEvidenceIds
            .map((id) => citationByEvidence.get(id))
            .filter((value) => value !== undefined)
            .map((citation) => citationLink(citation.label, citation.url))
            .join(' ');
          return `- **${label(claim.classification)} (${Math.round(claim.confidence * 100)}% confidence):** ${plain(claim.statement)}${citations ? ` ${citations}` : ''}`;
        })
        .join('\n')
    : '- No supported claims were produced.';
  const unknowns = result.unknowns.length
    ? result.unknowns.map((item) => `- ${plain(item)}`).join('\n')
    : '- No material unknowns were reported.';
  const sources = result.citations.length
    ? result.citations
        .map(
          (citation) =>
            `- ${citationLink(citation.label, citation.url)} (${plain(citation.evidenceId)})`,
        )
        .join('\n')
    : '- No external sources were available.';
  const warnings = result.warnings.length
    ? `\n\n## Warnings\n\n${result.warnings.map((item) => `- ${plain(item)}`).join('\n')}`
    : '';
  return `# ${plain(result.skill.id)}\n\n${plain(result.directAnswer)}\n\n## Claims\n\n${claims}\n\n## Unknowns\n\n${unknowns}\n\n## Sources\n\n${sources}${warnings}\n\n_Automated by [TNL Bot](${result.automatedAuthor.profileUrl}). As of ${plain(result.asOf)}. This is research, not investment advice._\n`;
}

function citationLink(value: string, url?: string): string {
  const safeLabel = plain(value).replace(/[\[\]]/g, '');
  if (!url) return `[${safeLabel}]`;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return `[${safeLabel}]`;
    return `[${safeLabel}](${parsed.toString().replace(/[()]/g, encodeURIComponent)})`;
  } catch {
    return `[${safeLabel}]`;
  }
}

function plain(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
