import { Elysia, t } from "elysia";
import { players, clients, rooms, turso } from './db';

// TODO: make a /game route for the WS when I am able to rebuild WebGL using the re-assembled Unity game
export const apiRoute = new Elysia({ prefix: "/v1" })
    .onRequest(({ request, set }) => {
        set.headers['Access-Control-Allow-Origin'] = '*';
        set.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        if (request.method === 'OPTIONS') { return {}; }
    })
    .get('/server', () => {
        if (Object.keys(players).length == 0) {
          return {
            success: false,
            message: "No players are currently online."
          }
        } else {
          return {
            success: true,
            connections: Object.keys(clients).length,
            players: Object.values(players).map((player) => {
              return {
                id: player.id,
                connectionId: player.connectionId,
                username: player.username,
                roomId: player.roomId,
                accessLevel: ["PLAYER", "MODERATOR", "UNDERCOVER_MODERATOR", "ADMIN", "AMBASSADOR", "PARTY_MASTER"][player.accessLevel],
                position: player.position,
                appearance: {
                  character: player.itemCharacter,
                  head: player.itemHead,
                  overbody: player.itemOverbody,
                  neck: player.itemNeck,
                  overwear: player.itemOverwear,
                  body: player.itemBody,
                  hand: player.itemHand,
                  face: player.itemFace,
                  feet: player.itemFeet
                },
                statistics: {
                  coins: player.coins,
                  //level: player.level,
                  level: "NOT IMPLEMENTED",
                  //xp: player.xp
                  xp: "NOT IMPLEMENTED",
                  shProgress: player.shProgress
                }
              }
            }),
            rooms: rooms
          }
        }
    })
    .group('/user', (app) => app
        .post('/', async ({ body }) => {    
            const reqBody = body as Record<string, string>;
            const creationDate = new Date().getTime();
            const password = await Bun.password.hash(reqBody.password);
            
            try {
                const newId = (await turso.execute('SELECT COUNT() FROM players;')).rows[0].length;
                const newAccount = await turso.batch([
                    {
                        sql: 'INSERT INTO players (id, registered, email, password, displayName, accessLevel, coins, level, xp, globalMusicEnabled, emailVerified, usernameApproved) VALUES (?,?,?,?,?,?,?,?,?,false,false,false)',
                        args: [
                            newId, creationDate,
                            reqBody.email,
                            password,
                            reqBody.displayName,
                            0, 0, 0, 0
                        ]
                    },
                    {
                        sql: 'INSERT INTO toons (id, character, head, overbody, neck, overwear, body, hand, face, feet) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        args: [newId, "", "", "", "", "", "", "", "", ""]
                    }
                ], "write");
            
                return { success: true };
            } catch(e) {
                return { errors: [{ message: e }] };
            }
        }, {
            body: t.Object({
                email: t.String({ format: 'email' }),
                displayName: t.String({ minLength: 3, maxLength: 12 }),
                password: t.String({ minLength: 6, maxLength: 100 })
            })
        })
        .get('/email-verified', ({set, error}) => {
            return { emailVerified: true }
        })
    );