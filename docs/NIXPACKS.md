## Nixpacks — Build & usage notes for prismaflow-api

This repository includes a `nixpacks.toml` file with the build plan for Nixpacks.

Quick notes:

- Runtime: Node 20 (specified in `nixpacks.toml` as `nodejs-20_x`).
- Build: runs `npx prisma generate` and `npm run build` (this runs `tsc` + `prisma generate` defined in `package.json`).
- Start: `node dist/server.js` (the `start` phase in the config).

Typical workflow with the Nixpacks CLI:

1. Install nixpacks (see https://nixpacks.com/docs/install)

   curl -sSf https://get.nixpacks.com | sh

2. Build an image for the app (from repository root):

   nixpacks build -t prismaflow-api .

3. Run the resulting image locally (you must provide at least the DB url and other secrets):

   docker run -p 3000:3000 \
     -e DATABASE_URL='postgresql://user:pass@host:5432/db' \
     -e JWT_SECRET='your_secret' \
     prismaflow-api

Environment variables to consider:

- DATABASE_URL — required by Prisma at runtime (must point to your database)
- JWT_SECRET — used by the application for token signing
- NODE_ENV — set to `production` by default in the `nixpacks.toml` config

Note: `prisma generate` runs during the build phase so the generated client is included in the final image. However, at runtime the app still needs a reachable database for normal operation.
