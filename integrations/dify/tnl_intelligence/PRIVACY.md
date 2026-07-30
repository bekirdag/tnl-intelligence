# Privacy Disclosure

## Scope

This Dify plugin is a read-only client for The Neural Ledger (TNL). The plugin
has no database and does not independently retain user data, API credentials,
tool inputs, or tool results.

## Data Sent to TNL

Depending on the selected tool, the plugin sends the following data over HTTPS
to the fixed TNL API or MCP service:

- the TNL API key in an authorization header;
- search terms and research questions;
- story, entity, asset, or impact-path identifiers;
- cursor and page-size values;
- timestamps and requested time windows;
- selected exposure kinds and enumerated research workflow names; and
- optional category or geography filters.

The plugin never places the API key in a URL, result, log message, or raised
error. It does not send data to any service other than the fixed TNL hosts.

## Storage, Logging, and Retention

Dify controls storage of the configured credential, workflow inputs, execution
history, and outputs according to the operator's Dify deployment and policies.
The plugin itself does not add storage or logging.

TNL may process and retain API request metadata and submitted query content for
security, abuse prevention, quota enforcement, reliability, and service
operation under the [TNL privacy policy](https://theneuralledger.com/privacy).
Account, retention, and deletion requests should be directed to
`tnladmin@theneuralledger.com`.

## External Sources in Results

TNL results may contain citations and URLs to independent publishers. Opening
those links is outside this plugin and is governed by the publisher's own terms
and privacy policy.

## Contact

- Privacy and support: `tnladmin@theneuralledger.com`
- Website: https://theneuralledger.com
- Terms: https://theneuralledger.com/terms
- Source: https://github.com/bekirdag/tnl-intelligence

