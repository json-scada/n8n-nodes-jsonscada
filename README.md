# n8n-nodes-jsonscada

n8n community nodes for [JSON-SCADA](https://github.com/riclolsen/json-scada).

Two nodes:

- **JSON-SCADA** (action node) — read tag values, browse the point database, issue
  commands/setpoints, acknowledge alarms/events, and push values into the SCADA
  (via the N8N driver listener).
- **JSON-SCADA Trigger** — start a workflow on real-time value changes, SOE events,
  integrity snapshots or heartbeats pushed by the JSON-SCADA `N8N` driver.

This package pairs with the `N8N` protocol driver (`src/n8n-client`) in JSON-SCADA:

| Direction | Path | Node |
|-----------|------|------|
| n8n → SCADA (read/command/ack/history) | `server_realtime_auth` `POST /Invoke` (JWT, RBAC, audited) | JSON-SCADA action node |
| n8n → SCADA (push telemetry-style values) | `N8N` driver listener `POST /n8n/updates` (Basic auth) | JSON-SCADA action node, "Send Values" |
| SCADA → n8n (real-time notifications) | `N8N` driver webhook push → n8n webhook | JSON-SCADA Trigger node |

## Installation

In n8n: **Settings → Community Nodes → Install** and enter `n8n-nodes-jsonscada`.

Air-gapped / offline (both Windows and Linux):

```bash
cd ~/.n8n/nodes           # or %USERPROFILE%\.n8n\nodes on Windows
npm install /path/to/n8n-nodes-jsonscada
```

Then restart n8n.

## Credentials

### JSON-SCADA API

Used by the action node (Tag / Command / Alarm resources). Fields:

- **Base URL** — e.g. `https://scada.example.com` (no trailing `/Invoke`).
- **Username / Password** — a dedicated JSON-SCADA automation account. Create a role
  granting only what the workflows need, e.g. `sendCommands`, `ackAlarms`, `ackEvents`,
  and a `group1List` scope. The node logs in (`/Invoke/auth/signin`), caches the JWT and
  refreshes it automatically on expiry.
- **Ignore TLS Certificate Issues** — for self-signed dev servers only.

### JSON-SCADA N8N Listener API

Used by the action node's **Send Values** operation. Fields:

- **Listener URL** — the `ipAddressLocalBind` of the `N8N` connection, e.g.
  `http://scada-host:51930`.
- **Username / Password** — the Basic-auth credentials configured on that connection.

## Action node operations

| Resource | Operation | Notes |
|----------|-----------|-------|
| Tag | Read Values | comma-separated tags or numeric point keys → one item per point |
| Tag | Browse | distinct group1 / group2 / group3 values |
| Command | Issue Command | numeric or string setpoint to a command point key |
| Alarm / Event | Acknowledge | ack/remove point alarms & events, ack all, silence beep |
| Data (Push to Driver) | Send Values | push `{tag, value, invalid, time}` rows to the driver listener |

All operations honour **Continue On Fail** and item pairing.

## Trigger node

The trigger exposes a Production Webhook URL. Registration is **manual**: copy that URL
into the `N8N` connection's **endpointURLs** in the JSON-SCADA AdminUI. If the connection
sets a `passphrase`, enable **Require Bearer Token** and paste the same value.

Options:

- **Emit Mode** — one item per point/event (default) or the whole envelope as one item.
- **Notification Types** — filter to `valueChange`, `soeEvent`, `integrity`, `heartbeat`.

## Example workflows

See `examples/`:

- `alarm-to-notification.json` — Trigger (SOE events) → notification.
- `external-data-to-scada.json` — HTTP/schedule → **Send Values** into SCADA tags.
- `command-with-readback.json` — Trigger → **Issue Command** → **Read Values** readback.

## Security

- Prefer the `/Invoke` command path (this node) over the driver's direct command endpoint:
  it enforces per-role rights and writes `userActions` audit records.
- Keep the automation account least-privileged and scoped by `group1List`.
- Use HTTPS for the API base URL when n8n and SCADA are on different hosts.

## License

MIT
