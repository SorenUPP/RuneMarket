# RuneMarket

RuneMarket is a web application for tracking Old School RuneScape (OSRS) Grand Exchange item prices. It provides price history charts, trending items, item search, and the ability for signed-in users to favourite items they want to keep an eye on.

Built with Next.js, Prisma, PostgreSQL, and Supabase authentication. Live price and item data is sourced from the official OSRS Wiki Real-time Prices API.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Set Up the Database](#4-set-up-the-database)
  - [5. Seed the Database](#5-seed-the-database)
  - [6. Run the Development Server](#6-run-the-development-server)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- Search for tradeable OSRS items by name
- View live and historical buy/sell prices with interactive charts
- Browse trending items based on recent price movement
- Sign in with Supabase authentication
- Save and manage a personal list of favourite items
- Server-rendered pages built on the Next.js App Router

## Tech Stack

| Layer         | Technology                                                           |
| -------------- | --------------------------------------------------------------------- |
| Framework      | [Next.js](https://nextjs.org/) (App Router)                          |
| Language       | TypeScript                                                            |
| UI             | React, Tailwind CSS, shadcn/ui components                            |
| Database       | PostgreSQL                                                            |
| ORM            | [Prisma](https://www.prisma.io/) with the PostgreSQL driver adapter  |
| Auth           | [Supabase](https://supabase.com/) (`@supabase/ssr`)                  |
| Charts         | [lightweight-charts](https://github.com/tradingview/lightweight-charts) |
| External data  | [OSRS Wiki Real-time Prices API](https://prices.runescape.wiki/)     |

## Prerequisites

Before you begin, make sure you have the following installed and available:

- [Node.js](https://nodejs.org/) 20 or later
- npm (bundled with Node.js), or an alternative package manager such as yarn, pnpm, or bun
- A PostgreSQL database (a local instance, or a hosted provider such as Supabase, Neon, or Railway)
- A [Supabase](https://supabase.com/) project, used for authentication

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd runemarket
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root. This file is read by both the Next.js application and the Prisma CLI, so keep all required variables in one place.

```bash
# PostgreSQL connection string used by the application at runtime
DATABASE_URL="postgresql://user:password@host:5432/database"

# PostgreSQL connection string used by Prisma for migrations
# (may be identical to DATABASE_URL, or a direct, non-pooled connection)
DIRECT_URL="postgresql://user:password@host:5432/database"

# Supabase project URL and publishable (anon) key
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"

# Base URL used by server components to call the app's own API routes
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

Notes:

- `DATABASE_URL` and `DIRECT_URL` can point to the same database. If you are using a connection pooler (for example Supabase's pooled connection on port 6543), set `DIRECT_URL` to the direct, non-pooled connection instead, since Prisma migrations require a direct connection.
- The Supabase URL and publishable key are found in your Supabase project under **Project Settings > API**.
- `NEXT_PUBLIC_BASE_URL` should match the URL the app is served from in each environment (for example your production domain when deployed).

### 4. Set Up the Database

Apply the existing Prisma migrations to create the database schema:

```bash
npx prisma migrate deploy
```

For local development, `prisma migrate dev` can be used instead, which also keeps the Prisma Client in sync as the schema evolves:

```bash
npx prisma migrate dev
```

The Prisma Client is generated automatically as part of these commands. If you ever need to regenerate it manually, run:

```bash
npx prisma generate
```

### 5. Seed the Database

The seed script fetches the full OSRS item catalogue from the OSRS Wiki API and populates the `Item` table. This is required for search, trending, and item detail pages to have data to display.

```bash
npx prisma db seed
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application. The app will hot-reload as you edit files under `src/`.

## Project Structure

```
.
├── prisma/
│   ├── migrations/        # Database migration history
│   ├── schema.prisma      # Prisma data model
│   └── seed.ts            # Seed script (pulls item data from the OSRS Wiki API)
├── public/                 # Static assets
├── src/
│   ├── app/                 # Next.js App Router pages and API routes
│   │   ├── api/               # Server-side route handlers
│   │   ├── favourites/        # Favourites page
│   │   ├── item/[id]/         # Item detail page
│   │   ├── login/             # Login page
│   │   └── profile/           # Profile page
│   ├── components/          # Reusable React components (including UI primitives)
│   ├── generated/prisma/    # Generated Prisma Client (do not edit by hand)
│   └── lib/                 # Database client, Supabase clients, and OSRS API helpers
├── middleware.ts            # Supabase session refresh middleware
├── prisma.config.ts         # Prisma CLI configuration
└── package.json
```

## Available Scripts

| Command                     | Description                                       |
| ----------------------------- | --------------------------------------------------- |
| `npm run dev`                  | Start the development server                        |
| `npm run build`                | Create a production build                            |
| `npm run start`                | Start the production server (run after `build`)      |
| `npm run lint`                 | Run ESLint against the codebase                      |
| `npx prisma migrate dev`       | Create and apply a new migration in development      |
| `npx prisma migrate deploy`    | Apply existing migrations (production-safe)          |
| `npx prisma db seed`           | Run the seed script                                   |
| `npx prisma studio`            | Open Prisma Studio to browse the database             |

## Database Schema

The data model, defined in `prisma/schema.prisma`, consists of three models:

- **Item** — an OSRS item, including its name, icon URL, and tradeable status.
- **Price** — a timestamped price record for an item, including buy price, sell price, and trading volume.
- **Favourite** — a link between a user and an item they have favourited, unique per user/item pair.

## API Routes

The application exposes the following internal API routes under `src/app/api`:

| Route                              | Description                                |
| ------------------------------------ | --------------------------------------------- |
| `GET /api/items/search`              | Search items by name                          |
| `GET /api/items/search/[id]/price`   | Look up the price for a searched item         |
| `GET /api/items/trending`            | Retrieve currently trending items             |
| `GET /api/items/[id]/price`          | Get the current price for a specific item     |
| `GET /api/items/[id]/stats`          | Get price statistics for a specific item      |
| `GET /api/items/[id]/history`        | Get historical price data for an item         |
| `GET /api/favourites`                | List the current user's favourites            |
| `GET /api/favourites/[itemId]`       | Add or remove a specific favourite            |

## Authentication

RuneMarket uses [Supabase Auth](https://supabase.com/docs/guides/auth) for user sign-in. Session handling is managed in two places:

- `middleware.ts` refreshes the user's session on every request that matches the configured route matcher.
- `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts` provide browser and server Supabase clients respectively, used throughout the app to read the current user.

Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set correctly, and that your Supabase project has an authentication provider configured (for example email/password or a third-party OAuth provider), before testing the login flow.

## Deployment

RuneMarket can be deployed to any platform that supports Next.js, such as [Vercel](https://vercel.com/). When deploying:

1. Set all environment variables listed in [Configure Environment Variables](#3-configure-environment-variables) in your hosting provider's dashboard.
2. Run `npx prisma migrate deploy` against your production database as part of your deployment pipeline, before the application starts serving traffic.
3. Set `NEXT_PUBLIC_BASE_URL` to your production domain.

## Troubleshooting

**Prisma cannot connect to the database**
Confirm that `DATABASE_URL` and `DIRECT_URL` are correct and that the database is reachable from your machine or deployment environment. If you are behind a connection pooler, make sure `DIRECT_URL` uses a direct, non-pooled connection.

**Login does not work / session is not persisted**
Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and confirm that `middleware.ts` is active (it should not be excluded by your deployment configuration).

**No items appear in search or trending**
Run the seed script (`npx prisma db seed`) to populate the `Item` table from the OSRS Wiki API.

**Seed script fails to fetch data**
The OSRS Wiki API requires a descriptive `User-Agent` header, which is already set in `src/lib/osrs-api.ts`. If requests are still failing, check your network connection and confirm the API is reachable at `https://prices.runescape.wiki/api/v1/osrs`.

## License

No license has been specified for this project
