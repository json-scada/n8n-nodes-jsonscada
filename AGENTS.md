# DOX: src/n8n-nodes-jsonscada — n8n community nodes

## Purpose

npm package `n8n-nodes-jsonscada` (MIT) providing two n8n nodes:
- **JSON-SCADA** action node — read values, browse, issue commands, ack alarms/events
  (over `server_realtime_auth` `POST /Invoke`), and Send Values (over the `N8N` driver
  listener `POST /n8n/updates`).
- **JSON-SCADA Trigger** — webhook receiver for the `N8N` driver's outbound notifications.

## Ownership

- Owns the operator/API path from n8n into JSON-SCADA (auth, RBAC, audit go through
  `/Invoke`, not the driver). The driver `src/n8n-client` owns the transport/streams.

## Local Contracts

- **Language:** TypeScript, standard n8n-nodes-starter layout. Build: `npm run build`
  (`tsc` + `gulp build:icons`) → `dist/`. Discovery via the `n8n` field in package.json.
- **Auth:** `GenericFunctions.login()` calls `/Invoke/auth/signin`, captures the
  `x-access-token` cookie, caches per baseUrl|username, re-logins once on OPC auth-failure
  ServiceResults. `/Invoke` envelopes mirror `src/AdminUI/src/lib/opcClient.js`; OPC codes
  are copied into `nodes/JsonScada/OpcCodes.ts` (keep in sync if opcCodes.js changes).
- **Publishing:** never bundle n8n itself. Package is our own code; publish to npm on tag.

## Work Guidance

- ReadRequest=629, WriteRequest=671, browse=100000001, namespace=2. Numeric point keys use
  IdType 0, tags use IdType 1. Command value type Double(11)/String(12); ack uses
  AttributeId ExtendedAlarmEventsAck(100000004) with OpcAcknowledge bitmask.
- Keep operations `continueOnFail`-aware and item-paired.

## Verification

- `npm install && npm run build` — compiles clean, icon copied to dist.
- Runtime smoke: mock `this.helpers.request` + a stub `/Invoke` server and call
  `readValues`/`browse`/`issueCommand`/`writeAck` (see git history for the throwaway
  `_gf_test.js`).
- `npm run lint` — eslint-plugin-n8n-nodes-base rules.
