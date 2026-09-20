# FederationCoin security radar
#
# server/  NestJS OpenAPI /v1 + collector (same image, collector.main.js)
# ui/      Angular SPA for radar.federationcoin.org
#
# API tests: cd server && npm test
# UI tests:  cd ui && npm test
# Dummy MAIN unused. Health is ClusterIP, not a public page.
#
# Production settings are AWS Secrets Manager JSON blobs
# `federationcoin/radar-api` and `federationcoin/radar-collector`
# (human-maintained). First cluster deploy: CFN `federationcoin-ecr`,
# `federationcoin-radar-secrets` (CAPABILITY_NAMED_IAM), `federationcoin-radar-ui`;
# IRSA for `federationcoin-radar` and `federationcoin-radar-collector`;
# FORCE_REBUILD_RADAR=1 push-images.sh; eks-apply.sh; sync-radar-ui.sh.
# Then `scripts/deploy/dump-radar-fill.sh` (writes /tmp/radar-fill-*; path
# only) and paste into the SM console. Copy maria.password from
# federationcoin-ops DATABASE_PASSWORD (SM does not provision Maria).
# RPC user/pass from federationcoin-rpc (both nodes). xBearer is the X
# App-only Bearer Token, not Consumer Key or the user Access Token.
# Empty GitHub/X/NVD keys skip those collectors.
# First apply: the API pod CrashLoopBackOff / cycles with
# ResourceNotFoundException until the blobs have AWSCURRENT. Expected;
# not a bad image. Collector CronJob fails the same way until filled.
# Then: kubectl -n federationcoin rollout restart deploy/radar
# Optional collector keys (NVD, Nostr, RSS): docs/patterns-for-secrets.md
# `settings.example.json` and `collector.settings.example.json` are
# laptop shape only; copy to gitignored `.settings.json` and
# RADAR_SETTINGS_FILE. Do not paste those files into Helm or git with
# real values.
