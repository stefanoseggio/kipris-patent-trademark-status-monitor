// run-kipris-monitor.js
// npm install apify-client
const { ApifyClient } = require('apify-client');

// Reads your Apify API token from the environment — get one from
// https://console.apify.com/account/integrations. Never hardcode it.
const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Minimal realistic input matching the Actor's real input_schema.json.
// byoKiprisServiceKey is required: this Actor is deliberately bring-your-own-key,
// so you register your own KIPRIS Plus subscription and pay KIPRIS directly.
const input = {
  watchlistApplicants: ['Hanbit Electronics Co., Ltd.'],
  watchlistApplicationNumbers: ['1020220114820'],
  includePatents: true,
  includeUtilityModels: true,
  onlyNew: false, // start free (baseline/no-diff events) to validate the watchlist
  byoKiprisServiceKey: process.env.KIPRIS_PLUS_SERVICE_KEY,
};

async function main() {
  // Call the Actor by its stable ID and wait for the run to finish.
  const run = await client.actor('9Wg73rplxFqgVq6fY').call(input);

  console.log(`Run ${run.id} finished with status: ${run.status}`);

  // Pull every record the run wrote to its default dataset.
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  for (const item of items) {
    console.log(
      `[${item.event_type}] ${item.application_number} — ` +
      `${item.invention_title ?? '(no title)'} (${item.status_code ?? 'UNKNOWN'})`
    );
  }

  console.log(`Total records: ${items.length}`);
}

main().catch((err) => {
  console.error('KIPRIS monitor run failed:', err);
  process.exit(1);
});
