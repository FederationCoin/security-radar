# FederationCoin security radar

Public NestJS OpenAPI `/v1` plus Angular SPA at `radar.federationcoin.org`.
This process is **not** pool-registry and **not** Datadog.

Contract: workspace `docs/epics/03-security-radar.md`. Layout for v1:
`server/` (API) and `ui/` (SPA). Split later if needed. Do not scaffold
Nest or Angular from this README alone. Guide:
`docs/epics/nest-service.md` in the workspace dump.

MIT. `"private": true` when `package.json` exists — GitHub must not
`npm publish` or `docker push`. Runtime images go to private ECR only.

Dummy MAIN is unused. Admin writes are Sparrow-signed P2WPKH. Health is
not a public page.
