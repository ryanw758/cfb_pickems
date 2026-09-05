# CFB Pick'em

A skeleton project for a college football pick'em app.

- Every **Tuesday**, a scheduled job pulls the week's CFB games from the ESPN API,
  and selects games for a pick'em pool.
- Users log in with a username and password
- Each user picks a winner for all games.
- Scores are updated in (psuedo) real time and displayed on the standings page.

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
The Rules button displays a popup modal with the rules set by the commissioner.
