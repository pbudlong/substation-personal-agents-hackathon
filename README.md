# Substation

A shopper is leaving San Francisco on Saturday. Can an agent establish where to collect the regular matte-black, clear-lens Ray-Ban Meta Wayfarer Gen 2 on Friday evening? Substation matches GTIN 8056262721391 across three merchants, investigates the missing store facts and saves a purchase decision with its sources.

## Run the shopping agent

Requires Node.js 22 or later. The core agent has no package dependencies.

    node task.mjs pickup
    node task.mjs quick

Each command saves and reopens a run. Dated merchant captures retain their original observation time. The inspection time, evidence mode, item price, cart quote, pickup estimate and final payable total are separate fields. Friday captures were made during this event. All dates are November 20, 2026, Pacific time.

The agent tries the product pages in parallel. The optional BESTBUY_API_KEY enables the official product and local-store APIs. An exact product price alone triggers a store-level lookup. A live merchant feed with a verified collection window can change the decision. Unknown facts remain explicit.

## Sponsor services

SingleStore uses its HTTPS Data API through SINGLESTORE_URL, SINGLESTORE_DATABASE, SINGLESTORE_USER and SINGLESTORE_PASSWORD. Run receipts use parameterized SQL and are read back by UUID. AMPLITUDE_API_KEY enables Agent Analytics events. The pickup assessment is checked against both the real decision and a labeled unsupported control. COGNEE_URL and COGNEE_API_KEY enable an isolated graph dataset per run. The agent consumes only source-matched, exact-variant records from Airbyte output. Credentials belong in runtime secrets.

This repo contains event-day work. Thursday's prep materials are kept separately.
