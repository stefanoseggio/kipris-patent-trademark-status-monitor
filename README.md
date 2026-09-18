<div align="center">

# KIPRIS Patent & Trademark Status-Change Monitor

**Bring-your-own-key delta monitoring for Korean (KIPRIS Plus) patent and utility-model filings — get an event the moment a tracked application's status changes, on whatever Apify schedule you configure, never a KIPRIS Plus license markup. Pay-per-event, $0.00 on unchanged runs.**

[![Run on Apify Store](https://img.shields.io/badge/Run%20on-Apify%20Store-FF9012?style=for-the-badge&logo=apify&logoColor=white)](https://apify.com/stefano_seggio/kipris-patent-trademark-status-monitor)
[![Apify Store](https://img.shields.io/badge/Apify%20Store-View%20Listing-FF9012?style=for-the-badge&logo=apify&logoColor=white)](https://apify.com/stefano_seggio/kipris-patent-trademark-status-monitor)
[![Pay-Per-Event](https://img.shields.io/badge/Pay--Per--Event-from%20%240.008-brightgreen?style=for-the-badge)](#cost--byok-disclosure)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Delta Engine Verified](https://img.shields.io/badge/Delta%20Engine-Verified-1a1a2e?style=for-the-badge)](#architecture)

</div>

## What this is

Polls Korea's official KIPRIS Plus Open API (Korea Intellectual Property Rights Information Service, operated by KIPO/KIPI) against a caller-supplied watchlist of applicant names or exact application numbers, and emits an event only when a tracked filing is new or its status actually changes. It extends this operator's existing USPTO/EPO patent-dispute monitor into a jurisdiction neither of those two sources touches — instead of someone on a docketing or IP-ops team re-running KIPRIS searches by hand, or writing and babysitting a cron script against an unfamiliar Korean-government XML API, this runs on a schedule and only ever surfaces what changed.

## An important, upfront disclosure about this build's verification

KIPRIS Plus is **not** a free-developer-registration API like USPTO ODP or EPO OPS. It is a paid product license — a flat annual service fee, independently confirmed live against the official KIPRIS Plus fee page during this build: *"Open API: A flat-rate annual service fee is $1,783 (searching for up to 1,000 cases a month for free)"* — or a roughly $445/yr discounted rate not confirmed eligible for any particular account. This build does not hold a paid, registered KIPRIS Plus service key, and creating a paid government-service account is outside what it is authorized to do on its own.

What this means concretely:

- The real base endpoint (`http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/...`) and its XML error envelope were **independently confirmed live** — an unauthenticated request genuinely returns `HTTP 200` with `<response><header><resultCode>30</resultCode><resultMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</resultMsg></header></response>`. This Actor's transport, retry, and error-classification logic is built and tested against that real, live-observed behavior.
- The exact field names inside a **successful** response (`applicationNumber`, `inventionTitle`, `applicantName`, `registerStatus`, etc.) could **not** be independently verified against a real successful call. They are modeled on a real, independently-published third-party reference implementation (the npm package `kipris-mcp-server`, inspected during this build) that wraps the same confirmed endpoint — itself an unofficial community source, not KIPRIS's own specification.
- The live end-to-end smoke test performed for this Actor proves the transport layer, the real XML envelope parsing, and its graceful-error-handling path against the genuine live server — not the full success-path data mapping, which remains unverified pending a real paid key.

This is disclosed here deliberately: never claim "zero-defect" or "live-verified" for something that wasn't actually run against real success-case data.

## Architecture

```mermaid
flowchart LR
    A["KIPRIS Plus Open API\n(patUtiModInfoSearchSevice)"] -->|"Got + retry\n429/5xx"| B["kiprisClient.ts\naccessKey, XML envelope\n(envelope: REAL · fields: MODELED)"]
    B --> C["normalizeStatus()\n출원/공개/등록/거절/취하 →\nFILED/PUBLISHED/REGISTERED/\nREJECTED/WITHDRAWN"]
    C --> D["deltaEngine.ts\nstatus + content SHA-256\nfingerprints, per watchlist entry"]
    D -->|"unseen, first baseline"| E["BASELINE_SNAPSHOT\nfree"]
    D -->|"unseen, already baselined"| F["NEW_APPLICATION\nresult · $0.02"]
    D -->|"status_code changed"| G["STATUS_CHANGE\nresult · $0.02"]
    D -->|"other field changed"| H["UPDATED\nresult-summary · $0.008"]
    D -->|"nothing differs"| I["SNAPSHOT_NO_DIFF\nfree, onlyNew=false only"]
```

Cold start is per-watchlist-entry, not a single global flag: adding a new applicant to an already-running watchlist gets its own free baseline run, independent of whatever state the rest of the watchlist is already in.

## Features

| Capability | Detail |
|---|---|
| Applicant-name watchlist | Track Korean or English applicant/company names (e.g. `한빛전자 주식회사`) against KIPRIS Plus's applicant-name search field. |
| Exact application-number watchlist | Track individual filings directly by KIPO-format application number (e.g. `1020220114820`) instead of an applicant's whole portfolio. |
| Patent / utility-model toggles | `includePatents` and `includeUtilityModels` independently include or exclude each filing type from the watchlist walk. |
| Delta mode (`onlyNew`) | Off by default so you can validate output for free against `BASELINE_SNAPSHOT`/`SNAPSHOT_NO_DIFF` records; on, it persists seen-record state and only charges for what actually changed. |
| Per-entry item cap | `maxItemsPerWatchlistEntry` bounds how many records KIPRIS Plus can return for any single watchlist entry in one run. |
| Named, resettable delta state | `deltaStateName` isolates multiple watchlists' baselines from each other; `resetState` clears one and re-baselines it from scratch. |
| Normalized status vocabulary | Raw KIPRIS status text is keyword-matched into a stable `FILED / PUBLISHED / REGISTERED / REJECTED / WITHDRAWN / UNKNOWN` enum. |
| Configurable transport resilience | `requestDelayMs`, `maxRetries`, and `requestTimeoutSecs` tune the pacing and retry behavior of every KIPRIS Plus request independently. |

## Quick start

1. Get an Apify API token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).
2. Have your own KIPRIS Plus service key ready — register directly with KIPRIS (see [Cost & BYOK Disclosure](#cost--byok-disclosure) below for why this Actor requires it).
3. Run it with the input schema below, leaving `onlyNew` at its default `false` for the first run — every matched record comes back as a free `BASELINE_SNAPSHOT`/`SNAPSHOT_NO_DIFF`, so you can confirm the watchlist matches what you expect before switching it on.

```json
{
  "watchlistApplicants": ["Samsung Electronics"],
  "includePatents": true,
  "includeUtilityModels": false,
  "onlyNew": false,
  "byoKiprisServiceKey": "<your KIPRIS Plus service key>"
}
```

### cURL — instant terminal run

Runs synchronously and returns the resulting dataset items directly in the response, no polling needed:

```bash
curl -X POST "https://api.apify.com/v2/acts/9Wg73rplxFqgVq6fY/run-sync-get-dataset-items?token=<YOUR_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "watchlistApplicants": ["Samsung Electronics"],
  "includePatents": true,
  "includeUtilityModels": false,
  "byoKiprisServiceKey": "<your KIPRIS Plus service key>"
}'
```

### Python — `apify-client` SDK

```python
from apify_client import ApifyClient

client = ApifyClient("<YOUR_API_TOKEN>")

run_input = {
    "watchlistApplicants": ["Samsung Electronics"],
    "includePatents": True,
    "includeUtilityModels": False,
    "byoKiprisServiceKey": "<your KIPRIS Plus service key>",
}

run = client.actor("9Wg73rplxFqgVq6fY").call(run_input=run_input)

for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)
```

A full, runnable copy of this script lives at [`examples/run_kipris_monitor.py`](examples/run_kipris_monitor.py).

### Node.js — `apify-client` SDK

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const input = {
  watchlistApplicants: ['Samsung Electronics'],
  includePatents: true,
  includeUtilityModels: false,
  byoKiprisServiceKey: process.env.KIPRIS_PLUS_SERVICE_KEY,
};

const run = await client.actor('9Wg73rplxFqgVq6fY').call(input);
const { items } = await client.dataset(run.defaultDatasetId).listItems();

for (const item of items) {
  console.log(item);
}
```

A full, runnable copy of this script lives at [`examples/run-kipris-monitor.js`](examples/run-kipris-monitor.js).

### Apify CLI

```bash
apify call stefano_seggio/kipris-patent-trademark-status-monitor \
  --input '{
    "watchlistApplicants": ["Hanbit Electronics Co., Ltd."],
    "watchlistApplicationNumbers": ["1020220114820"],
    "includePatents": true,
    "includeUtilityModels": true,
    "onlyNew": false,
    "byoKiprisServiceKey": "YOUR_KIPRIS_PLUS_SERVICE_KEY"
  }'
```

## Use this from Claude Desktop, Cursor, or Windsurf (via MCP)

This Actor is also reachable as an MCP server through Apify's own hosted `@apify/actors-mcp-server`, scoped to just this Actor via a `?tools=` query string - not the full Delta Registry fleet.

**Claude Desktop** (via the `mcp-remote` stdio bridge):

```json
{
  "mcpServers": {
    "delta-registry-kipris-patent-trademark-status-monitor": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.apify.com/?tools=stefano_seggio/kipris-patent-trademark-status-monitor",
        "--header",
        "Authorization: Bearer ${APIFY_TOKEN}"
      ]
    }
  }
}
```

**Cursor** (native HTTP transport):

```json
{
  "mcpServers": {
    "delta-registry-kipris-patent-trademark-status-monitor": {
      "url": "https://mcp.apify.com/?tools=stefano_seggio/kipris-patent-trademark-status-monitor",
      "headers": {
        "Authorization": "Bearer ${APIFY_TOKEN}"
      }
    }
  }
}
```

**Windsurf** (uses `serverUrl`, not `url`):

```json
{
  "mcpServers": {
    "delta-registry-kipris-patent-trademark-status-monitor": {
      "serverUrl": "https://mcp.apify.com/?tools=stefano_seggio/kipris-patent-trademark-status-monitor",
      "headers": {
        "Authorization": "Bearer ${env:APIFY_TOKEN}"
      }
    }
  }
}
```

Replace `${APIFY_TOKEN}` with a real token from [Apify Console → Settings → Integrations](https://console.apify.com/settings/integrations). Note that `mcp-remote` does not expand shell environment variables inside the JSON string itself - paste the literal token and keep this file out of version control; Windsurf's `${env:APIFY_TOKEN}` genuinely does resolve from your environment. For the full 28-actor Delta Registry MCP configuration across all three clients, see [MCP_INTEGRATION.md](https://github.com/stefanoseggio/delta-registry-website/blob/main/MCP_INTEGRATION.md).

## Input & Output Schema

This repository is a documentation and integration wrapper (see [License](#license) below), so there is no `.actor/input_schema.json` checked into GitHub — the fields below are the real ones used throughout the Quickstart examples above and the Features table.

### Input

| Field | Type | Description |
|---|---|---|
| `watchlistApplicants` | string[] | Applicant/company names to track (Korean or English), matched against KIPRIS Plus's applicant-name search field. |
| `watchlistApplicationNumbers` | string[] | Exact KIPO-format application numbers to track individually, e.g. `1020220114820`. |
| `includePatents` | boolean | Include patent filings in the watchlist walk. |
| `includeUtilityModels` | boolean | Include utility-model filings in the watchlist walk. |
| `onlyNew` | boolean | Delta mode. Default `false`: every matched record returns as a free `BASELINE_SNAPSHOT`/`SNAPSHOT_NO_DIFF`. Set `true` to persist seen-record state and start paying only for genuine `NEW_APPLICATION`/`STATUS_CHANGE`/`UPDATED` events. |
| `byoKiprisServiceKey` | string | **Required.** Your own KIPRIS Plus service key — see [Cost & BYOK Disclosure](#cost--byok-disclosure) above. |
| `maxItemsPerWatchlistEntry` | integer | Bounds how many records KIPRIS Plus can return for any single watchlist entry in one run. |
| `deltaStateName` | string | Names the delta-state memory so multiple watchlists' baselines stay isolated from each other. |
| `resetState` | boolean | Clears the named delta state and re-baselines it from scratch. |
| `requestDelayMs` | integer | Pacing delay between KIPRIS Plus requests. |
| `maxRetries` | integer | Retry budget for 429/5xx responses from KIPRIS Plus. |
| `requestTimeoutSecs` | integer | Per-request timeout against KIPRIS Plus. |

### Output

One real record shape from this Actor's dataset, matching `.actor/dataset_schema.json`:

```json
{
  "record_id": "1020260045123",
  "event_id": "f0b3d8f2a1c9d3e6b47058a1c4e9f2b5d8a1c4e7",
  "event_type": "STATUS_CHANGE",
  "scraped_at": "2026-09-15T14:25:00.000Z",
  "is_new": false,
  "source_url": "http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/applicationNumberSearchInfo",
  "application_number": "1020260045123",
  "invention_title": "Method and apparatus for adaptive display refresh rate control",
  "applicant_name": "Samsung Electronics Co., Ltd.",
  "ip_type": "patent",
  "status_code": "REGISTERED"
}
```

`event_type` tells you immediately whether this is a fresh baseline, a new filing, a status change, or a non-status update — see [Architecture](#architecture) for exactly which of those triggers billing.

| Field | Description |
|---|---|
| `record_id` | Stable identifier for this filing, same value as `application_number`. |
| `event_id` | SHA-256-derived fingerprint identifying this specific delta event. |
| `event_type` | `BASELINE_SNAPSHOT`, `NEW_APPLICATION`, `STATUS_CHANGE`, `UPDATED`, or `SNAPSHOT_NO_DIFF` — see [Architecture](#architecture) above. |
| `scraped_at` | ISO-8601 UTC timestamp of this extraction. |
| `is_new` | `true` when this filing was never delivered by a previous run of this delta state. |
| `source_url` | The KIPRIS Plus endpoint this record was retrieved from. |
| `application_number` | KIPO-format application number. |
| `invention_title` | Filing title as registered with KIPRIS. |
| `applicant_name` | Applicant/company name as registered with KIPRIS. |
| `ip_type` | `patent` or `utility_model`. |
| `status_code` | Normalized status: `FILED`, `PUBLISHED`, `REGISTERED`, `REJECTED`, `WITHDRAWN`, or `UNKNOWN`. |
| `status_description_raw` | Raw, un-normalized status description text as returned by KIPRIS Plus, when available. |
| `application_date` | The filing's application date as recorded with KIPRIS, when available. |
| `changed_fields` | On `UPDATED` events, the list of non-status fields that changed since the previous run. |
| `content_fingerprint` | Internal SHA-256 content fingerprint used to detect non-status changes across runs. |
| `watchlist_entry` | The specific watchlist entry (applicant name or application number) that matched this record. |

As disclosed above, these output field names are modeled on a third-party reference implementation, not independently confirmed against a real successful KIPRIS Plus response — see [the verification disclosure](#an-important-upfront-disclosure-about-this-builds-verification).

## Cost & BYOK Disclosure

**BYOK status: required.** This is the fleet's flagship bring-your-own-key example — it cannot run at all without your own **KIPRIS Plus service key**, a paid annual license billed directly by KIPRIS, never pooled or resold. This Actor is **pure bring-your-own-key**: you hold and pay for your own KIPRIS Plus subscription directly — KIPRIS bills you, not this Actor. The events below cover only the delta-monitoring service itself, not a markup on KIPRIS Plus's own license.

Privacy and no-pooling, stated plainly: your `byoKiprisServiceKey` is used only to call KIPRIS Plus on your behalf for the watchlist entries you configure, is never logged in plaintext, and is never shared or pooled with any other customer's key or run. Each customer's KIPRIS Plus usage is billed by KIPRIS to that customer's own account.

| Event | Price | Charged when |
|---|---|---|
| `NEW_APPLICATION` / `STATUS_CHANGE` (`result`) | **$0.02** | A tracked filing is new (post-baseline), or its normalized status changes. |
| `UPDATED` (`result-summary`) | **$0.008** | A non-status field changes (title, applicant name) with status unchanged. |
| `BASELINE_SNAPSHOT` / `SNAPSHOT_NO_DIFF` | Free | Only delivered when `onlyNew: false`; never charged. |
| Actor start | $0.00005 | One-time per run (per GB-memory), not per record. |

This Actor carries no KIPRIS Plus licensing cost of its own — `byoKiprisServiceKey` is required input precisely so that every customer's own KIPRIS Plus subscription (its real $1,783/yr fee, or the unconfirmed ~$445/yr discounted rate) is billed directly between that customer and KIPRIS, never passed through this Actor. With no license cost to recoup, pricing here is set to match this fleet's other delta-monitor rates, not scaled to a six-figure break-even volume the way an operator-absorbed-license model would require.

Billing implementation detail: `Actor.pushData(record, eventName)` performs the charge directly; `Actor.charge()` is never called in addition.

## Why not just scrape it yourself

- **Zero infrastructure** — no server, cron box, or container to keep patched and running just to poll a government API on a schedule.
- **Managed scheduling** — Apify's built-in scheduler runs the watchlist walk on your cadence; you don't write or monitor the cron job.
- **No transport babysitting** — retry/backoff for 429s and 5xxs, per-request timeouts, and KIPRIS's own XML error envelope (including the real, live-confirmed `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` response) are already handled.
- **Built-in delta detection across runs** — the SHA-256 status/content fingerprint pair and per-watchlist-entry baseline state mean cross-run change detection is the default, not something you'd design and persist yourself.

## FAQ

**Is there a KIPRIS Plus API quota or rate limit I should know about?**
KIPRIS Plus's real per-key rate ceiling has not been independently confirmed by KIPRIS's own documentation. Rather than guess at an unverified number, this Actor defaults to a conservative, fixed `requestDelayMs` between requests — the same policy this operator's other actors use whenever a source's real rate limit isn't confirmable. `requestDelayMs`, `maxRetries`, and `requestTimeoutSecs` are all adjustable if your own key's real ceiling turns out to be higher.

**Are the output field names guaranteed to match a real KIPRIS Plus response?**
No — see the verification disclosure above. They're modeled on an independently-published third-party reference (`kipris-mcp-server`), not confirmed against a real successful KIPRIS Plus call, because this build doesn't hold a paid, registered service key. If they differ once you run this against a real key, `toSnapshot()` in `main.ts` and the `RawKiprisItem` shape in `types.ts` are the two places to correct.

**Do unchanged runs really cost $0.00?**
Yes. `BASELINE_SNAPSHOT` and `SNAPSHOT_NO_DIFF` events are never billed, regardless of watchlist size — you only pay for `NEW_APPLICATION`, `STATUS_CHANGE`, or `UPDATED` events, which only fire when something in KIPRIS Plus's own data actually moved.

**What happens if KIPRIS Plus itself is down or returns an error?**
The transport layer retries 429/5xx responses with backoff (`maxRetries`, configurable) and distinguishes a network/upstream failure from this Actor's own logic errors in its run log, rather than surfacing one generic failure for both.

## Known limitations, disclosed rather than hidden

- The exact KIPRIS Plus success-response field names are modeled, not independently verified — see the disclosure above.
- This Actor requires your own paid KIPRIS Plus service key, by design, not as a stopgap. There is deliberately no operator-held shared key.
- Applicant-name matching is inherently fuzzy for Korean legal-entity names (romanization/translation variants) — prefer exact application numbers wherever precision matters.
- KIPRIS Plus refreshes on its own agency cadence, not in real time — this Actor cannot report a change faster than KIPRIS itself republishes it.
- Demand for this category is genuinely unproven — the one comparable Apify Store actor found in research for this build sits at 1 total user, 0 monthly actives, no reviews.
- Not a substitute for a patent or trademark attorney's own docketing system or legal judgment.

## Support & Enterprise SLA

Independently developed and maintained by Stefano Seggio — not a managed enterprise product, and there is no contractual uptime SLA. Issues and feature requests: open an issue against this Actor's Store listing. Typical triage time: within 48 hours.

## Contributing & Local Setup

This repository is a **documentation and integration wrapper**: it holds the README, license, and integration examples (`examples/`), but not the Actor's proprietary monitoring logic (`kiprisClient.ts`, `deltaEngine.ts`, `main.ts`, etc.), which runs privately on Apify's platform and is not checked into GitHub. There is no `src/`, `package.json`, or buildable project here — cloning this repo will not give you a runnable copy of the KIPRIS client or delta-engine logic.

What you *can* do here:
- Open an issue or PR against the documentation, the `examples/` scripts, or this README — including, per the verification disclosure above, a correction to the output field names once someone runs this against a real paid KIPRIS Plus key and confirms the actual response shape.
- Run the actual Actor against your own KIPRIS Plus key via the Apify Console, CLI, or API, as shown in Quickstart above — that always runs the real, currently-deployed logic, not a local copy.

Bug reports and feature requests for the Actor's behavior itself are best filed through the Apify Store **Issues** tab on the [Store listing](https://apify.com/stefano_seggio/kipris-patent-trademark-status-monitor), since that is where paying users of the published Actor already are.

## License

The wrapper code, documentation, and integration examples in the [GitHub repository](https://github.com/stefanoseggio/kipris-patent-trademark-status-monitor) are MIT licensed. This repository does not contain the Actor's proprietary monitoring logic, which runs privately on Apify's platform.

---

### About Delta Registry

This Actor is part of **Delta Registry** — pay-per-event regulatory & compliance data infrastructure spanning patent, trademark, and enforcement monitoring across multiple jurisdictions. For professional inquiries or enterprise licensing, reach out on [LinkedIn](https://www.linkedin.com/in/stefanoseggio-deltaregistry). For the rest of the fleet, see [github.com/stefanoseggio](https://github.com/stefanoseggio).
