# Substation catalog destination

This demo Airbyte destination writes one catalog stream to the existing SingleStore database through its HTTPS Data API. It avoids the generic MySQL destination's database-creation checks, which the shared starter database does not permit.

The connector supports append mode and idempotently stores each source observation in `substation_airbyte_catalog`. It preserves the original Airbyte RECORD JSON, its `emitted_at` timestamp, and the destination write time. Every write is read back before an Airbyte STATE message is acknowledged. It does not create databases or touch `substation_runs`.

Build the local image with `docker build -t substation/airbyte-singlestore:0.1.0 integrations/airbyte-singlestore`. For abctl, load that image into the existing kind node's container runtime and register it as a workspace custom destination. Its configuration needs the SingleStore HTTPS server, database name, database username, and database password. Keep credentials in Airbyte's secret storage.

The demo source is `/catalog/2026-11-19.csv`: the authorized Thursday Target price snapshot, collected November 19 at 9:40 p.m. Pacific with minute precision. Airbyte's File connector reads it with `reader_options` set to `{"dtype":"str"}`. Use a manual schedule, full-refresh source mode, and append destination mode.

After a successful sync, configure the Site runtime names `AIRBYTE_CONNECTION_ID` and `AIRBYTE_JOB_ID` with the actual connection and job identifiers. The hosted agent reads the committed records from SingleStore. Older observations contribute historical price comparisons and retain their provenance; they never replace newer merchant prices or establish current pickup inventory.

The connector is intentionally limited to this catalog table and one demo stream. The Node base image and local image must remain available to the Airbyte cluster for later manual syncs.
