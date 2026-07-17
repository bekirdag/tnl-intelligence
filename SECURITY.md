# Security Policy

## Reporting

Do not open public issues for suspected credential exposure or exploitable vulnerabilities. Report security issues through The Neural Ledger's private support channel at https://theneuralledger.com/contact.

## Credential Handling

- Supply `TNL_API_KEY` through the environment or an approved secret manager.
- Never commit keys to source control or MCP configuration files.
- Do not pass keys as command-line arguments.
- Treat local MCP servers as executable code and review their package provenance before installation.

## Supported Versions

Security fixes are provided for the latest minor release until a formal support schedule is published.
