import { Elysia, error, t } from "elysia";
import { jwt } from '@elysiajs/jwt';
import { players, clients, rooms, turso } from "./db";
import { SerializedPlayer, LoginPlayer } from "./types";
import { handlePlayFabLogin } from "./utils";

// TODO: make a /game route for the WS when I am able to rebuild WebGL using the re-assembled Unity game
// TODO: change the registration API to not just be on the root of the /v1/user route group
export const apiRoute = new Elysia({ prefix: "/v1" })
  .state("shopCache", {} as Record<number, any>)
  .onRequest(({ request, set }) => {
    set.headers["Access-Control-Allow-Origin"] = "*";
    set.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    if (request.method === "OPTIONS") {
      return {};
    }
  })
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET!
    })
  )
  .get("/server", () => {
    if (Object.keys(players).length == 0) {
      return {
        success: false,
        message: "No players are currently online.",
      };
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
            accessLevel: [
              "PLAYER",
              "MODERATOR",
              "UNDERCOVER_MODERATOR",
              "ADMIN",
              "AMBASSADOR",
              "PARTY_MASTER",
            ][player.accessLevel],
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
              feet: player.itemFeet,
            },
            statistics: {
              coins: player.coins,
              //level: player.level,
              level: "NOT IMPLEMENTED",
              //xp: player.xp
              xp: "NOT IMPLEMENTED",
              shProgress: player.shProgress,
            }
          };
        }),
        rooms: rooms,
      };
    }
  })
  .group("/user", (app) =>
    app
      // ? Registration API
      .post(
        "/",
        async ({ body }) => {
          const reqBody = body as Record<string, string>;
          const creationDate = new Date().getTime();
          const password = await Bun.password.hash(reqBody.password);

          try {
            const newId = (await turso.execute("SELECT COUNT() FROM players;"))
              .rows[0].length;
            const newAccount = await turso.batch(
              [
                {
                  sql: "INSERT INTO players (id, registered, email, password, displayName, accessLevel, coins, level, xp, globalMusicEnabled, emailVerified, usernameApproved) VALUES (?,?,?,?,?,0,0,0,0,false,false,false)",
                  args: [
                    newId,
                    creationDate,
                    reqBody.email,
                    password,
                    reqBody.displayName
                  ],
                },
                {
                  sql: "INSERT INTO toons (id, character, head, overbody, neck, overwear, body, hand, face, feet) VALUES (?,?,?,?,?,?,?,?,?,?)",
                  args: [newId, "", "", "", "", "", "", "", "", ""],
                },
              ],
              "write",
            );

            return { success: true };
          } catch (e) {
            return { errors: [{ message: e }] };
          }
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
            displayName: t.String({ minLength: 3, maxLength: 12 }),
            password: t.String({ minLength: 6, maxLength: 100 }),
          }),
        },
      )
      .post("/login", async ({ body, jwt, cookie: { auth } }) => {
        const reqBody = body as Record<string, string>;
        const password = await Bun.password.hash(reqBody.password);

        try {
          const accountRegistry = await turso.execute({
            sql: "SELECT * FROM players WHERE email = ?",
            args: [reqBody.email]
          });

          if (accountRegistry.rows.length == 0) {
            const playfab = await handlePlayFabLogin(reqBody.email, reqBody.password);
            return {
              success: false,
              message: "Invalid email address or password!"
            };
          }

          let account = accountRegistry.rows[0] as unknown as LoginPlayer;
          const validity = await Bun.password.verify(reqBody.password, account.password as string);

          if (!validity) {
            return {
              success: false,
              message: "Invalid email address or password!"
            };
          }

          const characterInfo = await turso.execute({
            sql: "SELECT * FROM toons WHERE id = ?",
            args: [account.id]
          });
          const character = characterInfo.rows[0] as any;

          delete account.email;
          delete account.password;
          account = {
            ...account,
            connectionId: (Object.keys(players).length + 1).toString(),
            roomId: "0",
            position: rooms["0"].initialPosition,
            itemCharacter: character.character,
            itemHead: character.head,
            itemOverbody: character.overbody,
            itemNeck: character.neck,
            itemOverwear: character.overwear,
            itemBody: character.body,
            itemHand: character.hand,
            itemFace: character.face,
            itemFeet: character.feet,
            inventory: [],
            shProgress: 0,
            action: null,
          };

          const token = await jwt.sign({
            sub: account as any,
            // expiry set to 2 minutes from login
            exp: Math.floor(Date.now() / 1000) + 120
          });

          return {
            code: 200,
            status: "OK",
            data: { 
              SessionTicket: token
            }
          };
        } catch(e) {
          return {
            success: false,
            message: e
          }
        }
      }, {
        body: t.Object({
          email: t.String({
            format: 'email'
          }),
          password: t.String()
        })
      })
      .get("/email-verified", ({ set, error }) => {
        return { emailVerified: true };
      })
  )
  .get("/shop", async ({ query, store }) => {
    const id = query.id; 
    
    try {
      let items;
      if (!store.shopCache[id]) {
        const itemData = await turso.execute({
          sql: "SELECT * FROM items WHERE shop_id = ?",
          args: [id]
        });
        items = itemData.rows;
        store.shopCache[id] = items;
      } else {
        console.log('Cached res');
        items = store.shopCache[id];
      };

      const formatted = items.map((item: any) => {
        if (item.is_featured === "TRUE" || item.is_featured === "FALSE") {
          item.is_featured = item.is_featured === "TRUE";
        };
        if (item.dev_choice === "TRUE" || item.dev_choice === "FALSE") {
          item.dev_choice = item.dev_choice === "TRUE";
        };
        return item;
      });

      if (items.length > 0) {
        return {
          success: true,
          id: id,
          data: formatted
        };
      } else {
        return {
          success: false,
          id: id,
          message: "No items found under that shop ID."
        };
      };
    } catch(e) {
      return {
        success: false,
        message: (e as Error).toString()
      }
    };
  }, {
    query: t.Object({
      id: t.Number()
    })
  });