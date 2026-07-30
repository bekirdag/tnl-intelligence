# TNL Intelligence for Dify

The marketplace-ready plugin source is in
[`tnl_intelligence`](tnl_intelligence). It exposes the six normalized,
read-only TNL connector operations.

Run local checks from the repository root:

```bash
python3.12 -m unittest discover -s integrations/dify/test
python3.12 integrations/dify/scripts/validate.py
```

Package with the official Dify CLI:

```bash
dify plugin package ./integrations/dify/tnl_intelligence
```

