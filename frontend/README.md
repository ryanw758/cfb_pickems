# CFB Pick'em — Frontend

React + Vite app with three screens:

- **Login** (`/login`) — enter your name, no password.
- **This Week** (`/picks`) — the 10 games selected for the current week;
  pick a team per game and submit. Once the week is graded, this view
  shows results instead of the picker.
- **Standings** (`/leaderboard`) — season-long standings.

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your deployed backend
npm run dev
```

## Build for deployment

```bash
npm run build
```

Outputs static files to `dist/` — deploy those to S3 + CloudFront, Amplify
Hosting, or any static host.
