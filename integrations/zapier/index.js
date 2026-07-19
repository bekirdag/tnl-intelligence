const authentication = require('./authentication');
const getExposure = require('./creates/get-exposure');
const getResearchResult = require('./creates/get-research-result');
const getWeeklyEdition = require('./creates/get-weekly-edition');
const listRecentChanges = require('./creates/list-recent-changes');
const runResearch = require('./creates/run-research');
const searchIntelligence = require('./creates/search-intelligence');
const findIntelligence = require('./searches/find-intelligence');
const newOrUpdatedIntelligence = require('./triggers/new-or-updated-intelligence');
const weeklyEdition = require('./triggers/weekly-edition');
const packageJson = require('./package.json');
const core = require('zapier-platform-core');

const addAuthorization = (request, _z, bundle) => {
  request.headers = request.headers || {};
  request.headers.authorization = `Bearer ${bundle.authData.api_key}`;
  return request;
};

const App = {
  version: packageJson.version,
  platformVersion: core.version,
  flags: { cleanInputData: false },
  authentication,
  beforeRequest: [addAuthorization],
  afterResponse: [],
  triggers: {
    [newOrUpdatedIntelligence.key]: newOrUpdatedIntelligence,
    [weeklyEdition.key]: weeklyEdition,
  },
  searches: { [findIntelligence.key]: findIntelligence },
  creates: {
    [searchIntelligence.key]: searchIntelligence,
    [getExposure.key]: getExposure,
    [listRecentChanges.key]: listRecentChanges,
    [runResearch.key]: runResearch,
    [getResearchResult.key]: getResearchResult,
    [getWeeklyEdition.key]: getWeeklyEdition,
  },
};

module.exports = App;
