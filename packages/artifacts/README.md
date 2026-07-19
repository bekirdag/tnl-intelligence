# TNL MCP Distribution Artifacts

This private workspace package generates deterministic MCP installation metadata and provides the read-only `tnl-doctor` diagnostic command. It is consumed locally by the Tool 06 qualification pipeline and does not require registry publication.

```bash
npm run distribution:generate
npm run distribution:check
npm run distribution:pack
npm run distribution:doctor -- --mode local --entrypoint /path/to/tnl-mcp/dist/bin.js
```

The doctor reports credential presence but never prints credential values. Marketplace publication and release signing remain owner-controlled promotion steps.
