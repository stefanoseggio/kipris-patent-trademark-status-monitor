"""run_kipris_monitor.py
pip install apify-client
"""
import os
from apify_client import ApifyClient

# Reads your Apify API token from the environment — get one from
# https://console.apify.com/account/integrations. Never hardcode it.
client = ApifyClient(os.environ["APIFY_API_TOKEN"])

# Minimal realistic input matching the Actor's real input_schema.json.
# byo_kipris_service_key is required: this Actor is deliberately bring-your-own-key,
# so you register your own KIPRIS Plus subscription and pay KIPRIS directly.
run_input = {
    "watchlistApplicants": ["Hanbit Electronics Co., Ltd."],
    "watchlistApplicationNumbers": ["1020220114820"],
    "includePatents": True,
    "includeUtilityModels": True,
    "onlyNew": False,  # start free (baseline/no-diff events) to validate the watchlist
    "byoKiprisServiceKey": os.environ["KIPRIS_PLUS_SERVICE_KEY"],
}

def main():
    # Call the Actor by its stable ID and wait for the run to finish.
    run = client.actor("9Wg73rplxFqgVq6fY").call(run_input=run_input)

    print(f"Run {run['id']} finished with status: {run['status']}")

    # Pull every record the run wrote to its default dataset.
    dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items

    for item in dataset_items:
        title = item.get("invention_title") or "(no title)"
        status = item.get("status_code") or "UNKNOWN"
        print(f"[{item['event_type']}] {item['application_number']} — {title} ({status})")

    print(f"Total records: {len(dataset_items)}")

if __name__ == "__main__":
    main()
