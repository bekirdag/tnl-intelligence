import source from '../new-or-updated-intelligence/new-or-updated-intelligence.mjs';

export default {
  ...source,
  key: 'tnl_intelligence-weekly-edition',
  name: 'TNL Weekly Consequential Edition Published',
  description: 'Emit verified and deduplicated weekly consequential-edition events.',
  version: '0.1.0',
  props: {
    ...source.props,
    eventTypes: {
      type: 'string[]',
      label: 'Event Types',
      options: ['digest.weekly_published'],
      default: ['digest.weekly_published'],
      disabled: true,
    },
  },
};
