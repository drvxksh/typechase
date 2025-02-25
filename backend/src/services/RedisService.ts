import Redis from "ioredis";
import "dotenv/config";
import { Game, GameResult, Player } from "../types";

let redisClient: Redis;
let redisSub: Redis;
let redisPub: Redis;

/** Denotes the channels that will be used to broadcast data by redis */
export const CHANNELS = {
  GAME_UPDATES: "game:updates",
  PLAYER_UPDATES: "player:updates",
  SERVER_STATUS: "server:status",
};

/** Keys that will be used to access Redis things */
export const KEYS = {
  GAME: (id: string) => `game:${id}`,
  GAMES_LIST: "games:active",
  PLAYER: (id: string) => `player:${id}`,
  PLAYERS_LIST: "players:active",
  TEXTS: "typing:texts",
  RESULTS: "game:results",
};

/** Instantiates the Redis Clients, sets up subscriptions and seeds the text samples for the game */
export async function setupRedisClient(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error("Redis connection failed after multiple attempts");
        return null; // Stop retrying if it doesn't workout
      }
      return Math.min(times * 200, 2000); // Exponential backoff (CN things hehe)
    },
  });

  redisSub = new Redis(redisUrl);
  redisPub = new Redis(redisUrl);

  // Handle connection events
  redisClient.on("connect", () => console.log("Redis client connected"));
  redisClient.on("error", (err) => console.error("Redis client error:", err));

  // Handles setting up the subscriptions for the channels
  await setupRedisSubscriptions();

  // seeds typing if it does not exist already
  await seedTypingTexts();
}

/** Subscribes the redisSub to `message` events and the redis channels */
async function setupRedisSubscriptions(): Promise<void> {
  redisSub.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message); // this is why communicate in JSON
      //TODO do something with this data
      console.log(`Message received on channel ${channel}`);
    } catch (error) {
      console.error("Error processing Redis message:", error);
    }
  });

  // Subscribe to channels
  await redisSub.subscribe(
    CHANNELS.GAME_UPDATES,
    CHANNELS.PLAYER_UPDATES,
    CHANNELS.SERVER_STATUS
  );
}

/**
 * Saves the game
 * @param {Game} game - the game which is to be saved
 */
export async function saveGame(game: Game): Promise<void> {
  await redisClient.set(
    KEYS.GAME(game.id),
    JSON.stringify(game),
    "EX", //option that is telling redis to set expiration
    3600 // expiring in 1 hr
  );
  await redisClient.sadd(KEYS.GAMES_LIST, game.id);
}

/**
 * Returns the game details
 * @param {string} gameId - The id of the game
 * @returns {Game} The game object
 */
export async function getGame(gameId: string): Promise<Game | null> {
  const gameData = await redisClient.get(KEYS.GAME(gameId));

  if (!gameData) return null;

  return JSON.parse(gameData) as Game;
}

/** @returns The game ids that are active */
export async function getActiveGames(): Promise<string[]> {
  return redisClient.smembers(KEYS.GAMES_LIST);
}

/** Deletes the game
 * @param {string} gameId - The id of the game to be removed
 */
export async function removeGame(gameId: string): Promise<void> {
  await redisClient.del(KEYS.GAME(gameId));
  await redisClient.srem(KEYS.GAMES_LIST, gameId);
}

/**
 * Saves the Player info
 * @param {Player} player - The player object that is to be saved
 */
export async function savePlayer(player: Player): Promise<void> {
  await redisClient.set(
    KEYS.PLAYER(player.id),
    JSON.stringify(player),
    "EX",
    3600 // 1 hour expiration
  );
  await redisClient.sadd(KEYS.PLAYERS_LIST, player.id);
}

/**
 * Gets the player data
 * @param {string} playerId - The id of the player
 * @returns The player object if found, null otherwise
 */
export async function getPlayer(playerId: string): Promise<Player | null> {
  const playerData = await redisClient.get(KEYS.PLAYER(playerId));

  if (!playerData) return null;

  return JSON.parse(playerData) as Player;
}

/**
 * Deletes the Player
 * @param {string} playerId - The id of the player to be removed
 */
export async function removePlayer(playerId: string): Promise<void> {
  await redisClient.del(KEYS.PLAYER(playerId));
  await redisClient.srem(KEYS.PLAYERS_LIST, playerId);
}

/** Seeds some sample text for the game */
async function seedTypingTexts(): Promise<void> {
  //Remember the KEYS object above? Here we're checking if there already exists seeding data or not
  const count = await redisClient.llen(KEYS.TEXTS);
  if (count > 0) return;

  const sampleTexts = [
    "The quick brown fox jumps over the lazy dog.",
    "Programming is the art of telling another human what one wants the computer to do.",
    "Typing speed is measured in words per minute, where a word is standardized to be five characters or keystrokes long.",
    "The best way to predict the future is to invent it.",
    "Good code is its own best documentation. As you're about to add a comment, ask yourself, 'How can I improve the code so that this comment isn't needed?'",
  ];

  await redisClient.lpush(KEYS.TEXTS, ...sampleTexts);
  console.log("Seeded typing texts");
}

/** @returns a random string for the game */
export async function getRandomText(): Promise<string> {
  const count = await redisClient.llen(KEYS.TEXTS);
  if (count === 0) {
    return "The quick brown fox jumps over the lazy dog."; // Fallback
  }

  const index = Math.floor(Math.random() * count);
  const text = await redisClient.lindex(KEYS.TEXTS, index);
  return text || "The quick brown fox jumps over the lazy dog.";
}

export function publishGameUpdate(gameId: string, game: Game): void {
  redisPub.publish(CHANNELS.GAME_UPDATES, JSON.stringify({ gameId, game }));
}

export function publishPlayerUpdate(playerId: string, player: Player): void {
  redisPub.publish(
    CHANNELS.PLAYER_UPDATES,
    JSON.stringify({ playerId, player })
  );
}

// Game results
export async function saveGameResult(result: GameResult): Promise<void> {
  await redisClient.lpush(KEYS.RESULTS, JSON.stringify(result));
  // Keep only last 100 results
  await redisClient.ltrim(KEYS.RESULTS, 0, 99);
}

export async function getGameResults(limit = 10): Promise<GameResult[]> {
  const results = await redisClient.lrange(KEYS.RESULTS, 0, limit - 1);
  return results.map((r) => JSON.parse(r) as GameResult);
}

// For cleanup and testing
export function getRedisClient(): Redis {
  return redisClient;
}
