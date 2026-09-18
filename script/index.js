const axios = require('axios');
const { parse } = require('./parse');
const { save } = require('./save');
const { BASE_URL } = require('./base');

const LANGUAGES = ['all', 'javascript', 'typescript', 'python', 'go', 'rust'];
const PERIODS = ['daily', 'weekly', 'monthly'];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'User-Agent': 'DigestTrendingFeed/1.0 (+https://github.com/usedigestinc/github-trending-api)' },
});

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Trending page contained no repositories');
  const seen = new Set();
  for (const item of items) {
    if (!/^[^/\s]+\/[^/\s]+$/.test(item.title) || item.url !== `${BASE_URL}/${item.title}` || seen.has(item.title)) {
      throw new Error('Invalid or duplicate repository');
    }
    seen.add(item.title);
    for (const field of ['stars', 'forks', 'addStars']) {
      if (typeof item[field] !== 'string' || !/^\d[\d,]*$/.test(item[field])) throw new Error(`Invalid ${field} for ${item.title}`);
    }
    for (const field of ['description', 'language', 'languageColor']) {
      if (typeof item[field] !== 'string') throw new Error(`Missing ${field} for ${item.title}`);
    }
  }
}

async function fetchFeed(since, language, { get = url => client.get(url), sleep = delay } = {}) {
  const url = `/trending${language === 'all' ? '' : '/' + language}?since=${since}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await get(url);
    } catch (error) {
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt === 2) throw error;
      const retryAfter = error.response?.headers?.['retry-after'];
      let pause = Number(retryAfter) * 1000;
      if (!Number.isFinite(pause)) pause = Date.parse(retryAfter) - Date.now();
      if (!Number.isFinite(pause) || pause < 0) pause = 10000 * 2 ** attempt;
      // Stop rather than retry earlier than a long server-requested delay.
      if (pause > 120000) throw error;
      await sleep(Math.max(pause, 10000 * 2 ** attempt));
      continue;
    }
    const items = parse(response.data);
    validateItems(items);
    return items;
  }
}

async function run({ fetch = fetchFeed, write = save, sleep = delay } = {}) {
  const feeds = [];
  for (const language of LANGUAGES) {
    for (const since of PERIODS) {
      if (feeds.length) await sleep(3000);
      const items = await fetch(since, language);
      validateItems(items);
      feeds.push({ since, language, items });
      console.log(`${since}/${language}: ${items.length} repositories`);
    }
  }
  // Fetch and validate the entire set before replacing any output files.
  for (const { since, language, items } of feeds) await write(items, since, language);
}

if (require.main === module) {
  run().catch(error => {
    console.error(`Trending refresh failed: ${error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { LANGUAGES, PERIODS, validateItems, fetchFeed, run };
