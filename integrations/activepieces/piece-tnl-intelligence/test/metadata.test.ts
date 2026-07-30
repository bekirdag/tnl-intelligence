import assert from 'node:assert/strict';
import test from 'node:test';
import { tnlIntelligence } from '../src';
import { tnlIntelligenceAuth } from '../src/lib/auth';

test('exports the expected six read-only actions', () => {
  const names = Object.keys(tnlIntelligence.actions());
  assert.deepEqual(names, [
    'search_intelligence',
    'get_intelligence',
    'list_recent_changes',
    'get_exposure',
    'run_research',
    'get_weekly_edition',
  ]);
  assert.equal(tnlIntelligence.triggers.length, 0);
});

test('uses a fixed public logo and masked auth', () => {
  assert.match(tnlIntelligence.logoUrl, /^https:\/\/raw\.githubusercontent\.com\//);
  assert.equal(tnlIntelligenceAuth.type, 'SECRET_TEXT');
});
