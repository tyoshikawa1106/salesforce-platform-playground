# scripts guide

`scripts/` contains repository-managed helper scripts and query files.

- `scripts/setup/`: Node entrypoints and plans for initial org setup.
- `scripts/apex/`: Anonymous Apex scripts, grouped by purpose.
- `scripts/soql/`: SOQL files used for setup verification and object-level checks.
- `scripts/deployment/`: Deployment and org rebuild helper scripts.

Generated export files do not belong in `scripts/`. Write local Salesforce CLI
export output to `export-out/` instead.

See [test-data-import.md](../docs/development/test-data-import.md) for standard
object setup and export examples.
