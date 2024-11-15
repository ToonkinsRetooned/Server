import { createClient } from "@libsql/client";
import { SerializedPlayer, RoomData } from "./types";

export const players: Record<string, SerializedPlayer> = {};

export const clients: Record<string, WebSocket> = {};

export const rooms: Record<string, RoomData> = {
  "0": { pinatas: {}, coins: [], initialPosition: { x: -0.5, y: -1.5 } }, // Spawn Room
  "1": { pinatas: {}, coins: [], initialPosition: { x: 0, y: 0 } }, // Cafe & Arcade
  "2": { pinatas: {}, coins: [], initialPosition: { x: -5.5, y: -1 } }, // Quarterdeck
  "3": { pinatas: {}, coins: [], initialPosition: { x: -4, y: -2 } }, // Observatory
  "4": { pinatas: {}, coins: [], initialPosition: { x: 3, y: 1 } }, // The Beach
};

export const pinataState: Record<string, Array<string>> = {};

export const turso = createClient({
  url: Bun.env.TURSO_DATABASE_URL as string,
  authToken: Bun.env.TURSO_AUTH_TOKEN as string,
});
