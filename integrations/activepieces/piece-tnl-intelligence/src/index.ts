import { createPiece } from '@activepieces/pieces-framework';
import { getExposure } from './lib/actions/get-exposure';
import { getIntelligence } from './lib/actions/get-intelligence';
import { getWeeklyEdition } from './lib/actions/get-weekly-edition';
import { listRecentChanges } from './lib/actions/list-recent-changes';
import { runResearch } from './lib/actions/run-research';
import { searchIntelligence } from './lib/actions/search-intelligence';
import { tnlIntelligenceAuth } from './lib/auth';

export const tnlIntelligence = createPiece({
  displayName: 'TNL Intelligence',
  description:
    'Search cited intelligence, monitor revisions and exposure, and run evidence-backed research workflows.',
  auth: tnlIntelligenceAuth,
  minimumSupportedRelease: '0.36.1',
  logoUrl:
    'https://raw.githubusercontent.com/bekirdag/tnl-intelligence/main/integrations/cursor/tnl-intelligence/assets/tnl-int-logo.png',
  authors: ['bekirdag'],
  actions: [
    searchIntelligence,
    getIntelligence,
    listRecentChanges,
    getExposure,
    runResearch,
    getWeeklyEdition,
  ],
  triggers: [],
});
