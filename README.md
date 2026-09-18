# Digest GitHub Trending feeds

Maintained fork of [isboyjc/github-trending-api](https://github.com/isboyjc/github-trending-api), preserving its JSON/RSS format and MIT license.

Only Digest's existing options refresh: `all`, `javascript`, `typescript`, `python`, `go`, `rust`, each for `daily`, `weekly`, `monthly` (18 feeds). `all` remains the unfiltered GitHub Trending list.

Feed base URL: `https://raw.githubusercontent.com/usedigestinc/github-trending-api/main/data`

Example: `/daily/all.json`. Other inherited language files are historical and **not maintained**.

## Refreshing

The Fetch GitHub Trending workflow runs four times daily and can be dispatched manually. It pins pnpm, disables dependency lifecycle scripts (the feed generator does not need them), spaces requests, uses timeouts and bounded retries, validates all 18 results, and only then commits outputs. A blocked request or invalid page fails the run; it never intentionally publishes an empty or partially refreshed feed set.

Run locally:

```sh
pnpm install --frozen-lockfile --ignore-scripts
node --test test/*.test.js
pnpm build
```

Watch GitHub Actions failures and check JSON `pubDate` for freshness. Repository owners must keep scheduled Actions enabled. GitHub can disable scheduled workflows on inactive public repositories.
