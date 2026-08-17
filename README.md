# CFB Pick'em

A skeleton project for a college football pick'em app.

- Every **Monday**, a scheduled job pulls the week's CFB games from the ESPN API,
  finds the 10 games with the closest point spreads, and stores them.
- Users log in with just their **name** (no password — built for a friend group).
- Each user picks a winner for all 10 games.
- Every **Sunday night**, a scheduled job pulls final scores from ESPN, grades
  everyone's picks, and updates the leaderboard.

This is a **skeleton** — the plumbing is wired up end-to-end, but a lot of the
logic is intentionally left simple (marked `// TODO`) for you to flesh out
once you share your spreadsheet's scoring rules (confidence points? straight
up? tiebreakers?).

## Structure

```
cfb-pickem/
  backend/     AWS SAM app (API Gateway + Lambda + DynamoDB + EventBridge)
  frontend/    React + Vite app
```

## Backend (AWS)

The backend is a serverless AWS SAM app. See [`backend/README.md`](backend/README.md)
for deploy instructions. It provisions:

- **DynamoDB tables**: `Users`, `Games`, `Picks`
- **Lambda functions**: login, list games, submit picks, get picks, leaderboard,
  plus two scheduled jobs (`fetchWeeklyGames`, `gradeWeek`)
- **EventBridge rules**: Monday morning fetch, Sunday night grading
- **API Gateway HTTP API**: exposes the Lambdas to the frontend

## Frontend (React)

A Vite + React app with three screens: Login, Picks (this week's 10 games),
and Leaderboard. See [`frontend/README.md`](frontend/README.md).

## Next steps

1. Share your spreadsheet — I'll match the scoring/point-spread rules exactly.
2. Decide on scoring: straight-up wins, or confidence points (rank picks 1-10)?
3. Decide tiebreaker rules for the leaderboard.
4. Deploy the backend, point the frontend's `VITE_API_BASE_URL` at it, deploy
   the frontend (e.g., S3 + CloudFront, or Amplify Hosting).
