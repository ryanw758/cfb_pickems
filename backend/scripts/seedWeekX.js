#!/usr/bin/env node
/**
 * Manually seed a week's games from ESPN.
 *
 * Usage:
 *   node scripts/seedWeekX.js <weekId YYYY-MM-DD> <espnGameId1> <espnGameId2> ...
 *
 * Example:
 *   node scripts/seedWeekX.js 2026-09-02 401864495 401866410 401869960 401856636 401856777 401860878 401856660 401864497 401858210 401856661
 *
 * weekId must be a Wednesday (the pick'em week starts Wednesday).
 * ESPN game IDs can be found by running:
 *   node scripts/seedWeekX.js --list <startYYYYMMDD> <endYYYYMMDD>
 */
require('dotenv').config();

const { BatchWriteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../src/lib/dynamo');
const { fetchScoreboard, parseEvent } = require('../src/lib/espnClient');

const GAMES_TABLE = process.env.GAMES_TABLE;

async function listGames(start, end) {
  const events = await fetchScoreboard({ start, end });
  const games = events.map(parseEvent).filter(Boolean);
  console.log(`Found ${games.length} games between ${start} and ${end}:\n`);
  games.forEach((g) =>
    console.log(`  ${g.gameId}  ${g.startTime}  ${g.shortName}  spread: ${g.spread}`)
  );
}

async function deleteExistingGames(weekId) {
  const { Items: existing = [] } = await doc.send(
    new QueryCommand({
      TableName: GAMES_TABLE,
      KeyConditionExpression: 'weekId = :w',
      ExpressionAttributeValues: { ':w': weekId },
    })
  );

  if (existing.length === 0) {
    console.log(`No existing games for week ${weekId}.`);
    return;
  }

  const chunks = [];
  for (let i = 0; i < existing.length; i += 25) chunks.push(existing.slice(i, i + 25));
  for (const chunk of chunks) {
    await doc.send(new BatchWriteCommand({
      RequestItems: {
        [GAMES_TABLE]: chunk.map((g) => ({
          DeleteRequest: { Key: { weekId, gameId: g.gameId } },
        })),
      },
    }));
  }
  console.log(`Deleted ${existing.length} existing games for week ${weekId}.`);
}

async function seedGames(weekId, gameIds) {
  const selectedIds = new Set(gameIds);

  // Fetch a wide enough window to cover Fri-Sun games for the given week
  const wednesday = new Date(`${weekId}T00:00:00Z`);
  const tuesday = new Date(wednesday);
  tuesday.setUTCDate(tuesday.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const start = fmt(wednesday);
  const end = fmt(tuesday);

  const events = await fetchScoreboard({ start, end });
  const allGames = events.map(parseEvent).filter(Boolean);
  const selected = allGames.filter((g) => selectedIds.has(g.gameId));

  if (selected.length !== selectedIds.size) {
    const foundIds = new Set(selected.map((g) => g.gameId));
    const missing = [...selectedIds].filter((id) => !foundIds.has(id));
    console.warn(`Warning: ${missing.length} game ID(s) not found in ESPN response: ${missing.join(', ')}`);
  }

  const chunks = [];
  for (let i = 0; i < selected.length; i += 25) chunks.push(selected.slice(i, i + 25));
  for (const chunk of chunks) {
    await doc.send(new BatchWriteCommand({
      RequestItems: {
        [GAMES_TABLE]: chunk.map((game) => ({
          PutRequest: { Item: { weekId, ...game } },
        })),
      },
    }));
  }

  console.log(`Seeded ${selected.length} games for week ${weekId}:`);
  selected.forEach((g) => console.log(`  ${g.gameId}  ${g.shortName}  spread: ${g.spread}`));
}

async function main() {
  const [, , first, ...rest] = process.argv;

  if (first === '--list') {
    const [start, end] = rest;
    if (!start || !end) {
      console.error('Usage: node scripts/seedWeekX.js --list <startYYYYMMDD> <endYYYYMMDD>');
      process.exit(1);
    }
    await listGames(start, end);
    return;
  }

  const weekId = first;
  const gameIds = rest;

  if (!weekId || gameIds.length === 0) {
    console.error('Usage: node scripts/seedWeekX.js <weekId YYYY-MM-DD> <espnGameId1> <espnGameId2> ...');
    console.error('       node scripts/seedWeekX.js --list <startYYYYMMDD> <endYYYYMMDD>');
    process.exit(1);
  }

  await deleteExistingGames(weekId);
  await seedGames(weekId, gameIds);
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
