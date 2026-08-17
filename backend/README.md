# CFB Pick'em — Backend (AWS SAM)

Serverless backend: API Gateway (HTTP API) + Lambda (Node.js 20) + DynamoDB +
EventBridge scheduled jobs. No auth service — logins are just a name stored
in the `Users` table.

## Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- An AWS account with credentials configured (`aws configure`)
- Node.js 20+

## Deploy

```bash
cd backend
npm install
sam build
sam deploy --guided
```

`sam deploy --guided` will walk you through picking a stack name, region,
and will save your answers to `samconfig.toml` for next time. When it
finishes, copy the `ApiUrl` output — that's your `VITE_API_BASE_URL` for
the frontend.

## Local development

```bash
sam local start-api
```

Runs the API on `http://localhost:3000`. Note: `sam local` runs each
request in a fresh Docker container, so it's fine for testing individual
endpoints but won't run the scheduled (`fetchWeeklyGames` / `gradeWeek`)
functions — invoke those directly instead:

```bash
sam local invoke FetchWeeklyGamesFunction
sam local invoke GradeWeekFunction
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/login` | `{ "name": "Jordan" }` — creates the user if new |
| GET | `/games/current` | This week's 10 selected games |
| POST | `/picks` | `{ "userName", "picks": [{ "gameId", "pickedSide" }] }` |
| GET | `/picks/{weekId}/{userName}` | A user's picks for a given week |
| GET | `/leaderboard` | Season standings |

## Scheduled jobs

- **`fetchWeeklyGames`** — Mondays 8am UTC. Pulls the week's FBS games from
  ESPN, selects the 10 with the closest point spreads, stores them.
- **`gradeWeek`** — Sundays 11pm UTC. Pulls final scores, grades every
  submitted pick.

Adjust the `cron(...)` expressions in `template.yaml` if you want different
times, or if your slate regularly includes Monday-night games (in which case
you may want to move grading to Tuesday, or run it twice).

## Data model

- **Users**: `name` (PK)
- **Games**: `weekId` (PK, e.g. `2026-09-07`), `gameId` (SK, ESPN event id),
  team info, spread, kickoff time, score, status
- **Picks**: `weekUser` (PK, `"{weekId}#{userName}"`), `gameId` (SK),
  `pickedSide` (`home`/`away`), `correct` (`null` until graded)

## Known gaps to fill in (marked `// TODO` in code)

- Locking picks once a game kicks off
- Tie handling (currently a tied final score leaves that game's picks
  ungraded)
- Leaderboard is computed with a full table scan — fine for a small group,
  but swap for an incrementally-updated standings table if it grows
- Confidence-point scoring, if that's how your spreadsheet currently scores
  (right now it's straight-up correct/incorrect)
