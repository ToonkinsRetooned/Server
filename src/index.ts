import { Elysia, t } from "elysia";
import { jwt } from '@elysiajs/jwt'
import { turso, players, clients, rooms, roomColliders } from "./db";
import { apiRoute } from "./api";
import { propagateEvent, killPlayer, getValidColliderSpawn } from "./utils";
import {
  SerializedPlayer,
  SerializedSpawnObject,
  PlayFabGetAccountInfo,
  PlayFabGetUserInventory,
  PlayFabItem,
} from "./types";
import items from './items.json';
import itemClasses from "./itemClasses.json";
import scavengerHunts from "./scavengerHunts.json";

const activeScavengerHunt = "easterhunt2020";
const app = new Elysia()
  .use(apiRoute)
  .use(
    jwt({
      name: 'jwt',
      secret: Bun.env.JWT_SECRET!
    })
  )
  .get("/*", async (ctx) => {
    const path = ctx.path.substring(1)
    if (ctx.path.charAt(ctx.path.length - 1) == '/') {
      return Bun.file(path + 'index.html');
    } else {
      return Bun.file(path);
    }
  })
  .ws("/", {
    query: t.Object({
      ticket: t.String()
    }),
    async open(ws) {
      const { ticket } = ws.data.query as { ticket: string };
      if (!ticket || Object.keys(players).includes(ticket)) {
        ws.close();
        return;
      }

      if (players[ticket]) {
        killPlayer(ticket);
      }

      const session = atob(ticket as string);
      const sessionSegments: Array<string> = session.split("-");

      const account: PlayFabGetAccountInfo = await (
        await fetch("https://ab3c.playfabapi.com/Client/GetAccountInfo", {
          method: "POST",
          body: JSON.stringify({
            PlayFabId: sessionSegments[0],
          }),
          headers: {
            "X-Authorization": session,
            "Content-Type": "application/json",
          },
        })
      ).json();

      if (
        (account.code != 200 || account.data.AccountInfo.TitleInfo.isBanned) &&
        ticket != btoa("mock")
      ) {
        ws.close();
        return;
      }

      const inventory: PlayFabGetUserInventory = await (
        await fetch("https://ab3c.playfabapi.com/Client/GetUserInventory", {
          method: "POST",
          body: JSON.stringify({
            PlayFabId: sessionSegments[0],
          }),
          headers: {
            "X-Authorization": session,
            "Content-Type": "application/json",
          },
        })
      ).json();

      let serialized: SerializedPlayer = {
        id: sessionSegments[0],
        connectionId: (Object.keys(players).length + 1).toString(),
        username: account.data.AccountInfo.TitleInfo.DisplayName,
        accessLevel: 5,
        roomId: "0",
        position: rooms["0"].initialPosition,
        itemCharacter: "1",
        itemHead: "",
        itemOverbody: "",
        itemNeck: "",
        itemOverwear: "",
        itemBody: "",
        itemHand: "",
        itemFace: "",
        itemFeet: "",
        inventory: inventory.data.Inventory || [],
        coins: inventory.data.VirtualCurrency.TK || 0,
        level: 1,
        xp: 0,
        globalMusicEnabled: true,
        shProgress: 0,
        action: null
      };

      players[ticket] = serialized;
      //@ts-ignore
      clients[serialized.id] = ws;

      ws.send({
        type: "enterRoom",
        players: Object.values(players).filter(
          (x) => x.roomId == "0" && x != serialized,
        ),
        pinatas: rooms[serialized.roomId].pinatas,
        coins: rooms[serialized.roomId].coins,
        roomId: "0",
        initialPosition: rooms[serialized.roomId].initialPosition,
        backgroundColor: rooms[serialized.roomId].backgroundColor,
      });
      ws.send({ type: "login", player: serialized });

      propagateEvent(
        function (player: SerializedPlayer, sender: SerializedPlayer) {
          return player.roomId == sender.roomId && player != sender;
        },
        serialized,
        {
          type: "userJoinedRoom",
          player: serialized,
        },
      );

      /*
      const plr = await ws.data.jwt.verify(ticket) as unknown as SerializedPlayer;

      const inventory = await turso.execute({
        sql: `
        SELECT
          items.id,
          items.name,
          items.description,
          items.class,
          items.price,
          inventory.acquired_at 
        FROM
          inventory
        INNER JOIN
          items
        ON
          inventory.item_id = items.id
        WHERE
          inventory.player_id = ?;
        `,
        args: [plr.id]
      });
      plr.inventory = inventory.rows

      // ! ADD CHECK TO MAKE SURE THE SERVER IS RUNNING IN A DEVELOPER ENVIRONMENT BEFORE ALLOWING MOCK SESSIONS
      if (ticket == btoa("mock")) {
        plr.username = "(tester)";
        plr.accessLevel = 5;
        plr.inventory = [];
        plr.coins = 2024;
        plr.itemCharacter = "4";
        plr.itemHead = "3";
      }

      players[ticket] = plr;
      //@ts-ignore
      clients[serialized.id] = ws;

      ws.send({
        type: "enterRoom",
        players: Object.values(players).filter(
          (x) => x.roomId == "0" && x != plr,
        ),
        pinatas: rooms[plr.roomId].pinatas,
        coins: rooms[plr.roomId].coins,
        roomId: "0",
        initialPosition: rooms[plr.roomId].initialPosition,
        backgroundColor: rooms[plr.roomId].backgroundColor,
      });
      ws.send({ type: "login", player: plr });

      propagateEvent(
        function (player: SerializedPlayer, sender: SerializedPlayer) {
          return player.roomId == sender.roomId && player != sender;
        },
        plr,
        {
          type: "userJoinedRoom",
          player: plr,
        },
      );
      */
    },

    async message(ws, message) {
      const packet = JSON.parse(
        Buffer.from(message as ArrayBuffer).toString("utf-8"),
      );
      console.log("Received websocket packet: ", packet.type);

      const { ticket } = ws.data.query as { ticket: string };
      const player = players[ticket];
      if (!ticket || !player) ws.close();

      const hunt = scavengerHunts[activeScavengerHunt];
      switch (packet.type) {
        case "walk":
          player.position = packet.position;
          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId && player != sender;
            },
            player,
            {
              type: "walk",
              playerId: player.id,
              position: player.position,
            },
          );
          ws.send(message);
          break;
        case "joinRoom":
          if (!rooms[packet.id]) return;
          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId && player != sender;
            },
            player,
            {
              type: "userLeaveRoom",
              playerId: player.id,
            },
          );

          const roomInfo = rooms[packet.id];
          player.roomId = packet.id;
          player.position = roomInfo.initialPosition;

          const playersInRoom = Object.values(players).filter(
            (x) => x.roomId == player.roomId && x != player,
          );
          ws.send({
            type: "enterRoom",
            players: playersInRoom,
            pinatas: roomInfo.pinatas,
            coins: roomInfo.coins,
            roomId: player.roomId,
            initialPosition: roomInfo.initialPosition,
            backgroundColor: roomInfo.backgroundColor,
            // TODO: fix room backgounds
          });

          for (let plr of playersInRoom) {
            if (plr.action == "minigame") {
              ws.send({
                type: "startPlayingMinigame",
                playerId: plr.id,
              });
            }
          }

          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId && player != sender;
            },
            player,
            {
              type: "userJoinedRoom",
              player: player,
            },
          );
          break;
        case "chat":
          let blockMessage = false;
          const messageSegments = packet.text.split(" ");
          console.log(JSON.stringify(messageSegments))

          if (messageSegments[0].substring(0, 1) != "/") {
            // TODO: add checking of message length, invalid characters, etc before propagation
            propagateEvent(
              function (player: SerializedPlayer, sender: SerializedPlayer) {
                return player.roomId == sender.roomId && player != sender;
              },
              player,
              {
                type: "chat",
                playerId: player.id,
                text: packet.text,
              },
            );
          }

          if (messageSegments[0] == "/roomBgColor") {
            rooms[player.roomId].backgroundColor = {
              r: parseInt(messageSegments[1]),
              g: parseInt(messageSegments[2]),
              b: parseInt(messageSegments[3]),
              a: 255,
            };
            console.log('New Room Background: ', rooms[player.roomId].backgroundColor?.r, rooms[player.roomId].backgroundColor?.g, rooms[player.roomId].backgroundColor?.b, rooms[player.roomId].backgroundColor?.a);
            propagateEvent(
              function (player: SerializedPlayer, sender: SerializedPlayer) {
                return true
              },
              player,
              {
                type: "mRBgC",
                roomId: player.roomId,
                backgroundColor: rooms[player.roomId].backgroundColor,
              },
            );
          } else if (messageSegments[0] == "/roomReset") {
            rooms[player.roomId].backgroundColor = {
              r: 255,
              g: 255,
              b: 255,
              a: 255,
            };
            propagateEvent(
              function (player: SerializedPlayer, sender: SerializedPlayer) {
                return true
              },
              player,
              {
                type: "mRBgC",
                roomId: player.roomId,
                backgroundColor: rooms[player.roomId].backgroundColor,
              },
            );
          }

          break;
        case "updateActiveItem":
          // ? if I learn what the item classes are, maybe add a check to make sure the provided one exists
          if (
            player.inventory.findIndex(
              (item: PlayFabItem) => item.ItemId == packet.itemId,
            ) == 0
          ) {
            return;
          }

          const itemIndex = itemClasses.findIndex(
            (item) => item.ItemId == packet.itemId,
          );
          if (!itemIndex) {
            return;
          }
          const itemClass = itemClasses[itemIndex].ItemClass;

          switch (itemClass) {
            case "character":
              player.itemCharacter = packet.itemId;
              break;
            case "head":
              player.itemHead = packet.itemId;
              break;
            case "overbody":
              player.itemOverbody = packet.itemId;
              break;
            case "neck":
              player.itemNeck = packet.itemId;
              break;
            case "overwear":
              player.itemOverwear = packet.itemId;
              break;
            case "body":
              player.itemBody = packet.itemId;
              break;
            case "hand":
              player.itemHand = packet.itemId;
              break;
            case "face":
              player.itemFace = packet.itemId;
              break;
            case "feet":
              player.itemFeet = packet.itemId;
              break;
          }

          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId && player != sender;
            },
            players[ticket],
            {
              type: "updateActiveItem",
              playerId: player.id,
              itemClass: itemClass,
              itemId: packet.itemId,
            },
          );

          break;
        case "clickPinata":
          const pinataId = packet.id;
          if (!rooms[player.roomId].pinatas[pinataId]) {
            rooms[player.roomId].pinatas[pinataId] = [];
          }

          const pinataRecord = rooms[player.roomId].pinatas[pinataId];
          if (pinataRecord.length != 4 && !pinataRecord.includes(player.id)) {
            pinataRecord.push(player.id);
            propagateEvent(
              function (player: SerializedPlayer, sender: SerializedPlayer) {
                return player.roomId == sender.roomId;
              },
              players[ticket],
              {
                type: "pinataUpdateState",
                pinataId: pinataId,
                pinataState: pinataRecord.length,
              },
            );
          } else if (pinataRecord.length == 4) {
            // TODO: add ability to get the item if you click after the 4th state
            delete rooms[player.roomId].pinatas[pinataId];
          }
          break;
        case "collectObject":
          if (packet.collectibleType == "COIN") {
            const roomCoins = rooms[player.roomId].coins;
            //@ts-ignore
            const coin = roomCoins.filter(
              (coin) => coin.id == packet.collectibleId,
            )[0];
            if (!coin) return;
            player.coins += coin.value;

            propagateEvent(
              function (player: SerializedPlayer, sender: SerializedPlayer) {
                return player.roomId == sender.roomId;
              },
              players[ticket],
              {
                type: "spawnCoinCollected",
                coinId: coin.id,
                coinValue: coin.value,
                playerId: player.id,
              },
            );

            delete rooms[player.roomId].coins[packet.collectibleId];
          }
          break;
        case "ssh":
          player.shProgress = 0;
          ws.send({
            type: "shs",
            scavengerHuntId: activeScavengerHunt,
            items: hunt.map((item) => {
              return { id: item.id };
            }),
            initialItem: hunt[0],
          });
          break;
        case "cshi":
          ws.send({
            type: "shic",
            scavengerHuntId: activeScavengerHunt,
            collectedItemId:
              scavengerHunts[activeScavengerHunt][player.shProgress].id,
            nextItem:
              scavengerHunts[activeScavengerHunt][player.shProgress + 1],
          });
          player.shProgress += 1;
          if (player.shProgress == hunt.length) {
            ws.send({
              type: "she",
              scavengerHuntId: activeScavengerHunt,
            });
            // TODO: award items for completing scavenger hunt
          }
          break;
        case "startChatTyping":
          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId;
            },
            players[ticket],
            {
              type: "startChatTyping",
              playerId: player.id,
            },
          );
          break;
        case "stopChatTyping":
          if (player.action == "minigame") player.action = null;
          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId;
            },
            players[ticket],
            {
              type: "stopChatTyping",
              playerId: player.id,
            },
          );
          break;
        case "startPlayingMinigame":
          // the "stopChatTyping" event is re-used for the "startPlayingMinigame" event by the client
          player.action = "minigame";
          propagateEvent(
            function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId;
            },
            players[ticket],
            {
              type: "startPlayingMinigame",
              playerId: player.id,
            },
          );
          break;
        case "ugps":
          if (
            packet.globalMusicEnabled != true &&
            packet.globalMusicEnabled != false
          )
            return;
          player.globalMusicEnabled = packet.globalMusicEnabled;
          break;
        case "testJWT":
          const token = await ws.data.jwt.verify(packet.token);
          console.log(token);
          break;
        case "testWS":
          ws.send({type: packet.event});
          ws.send({event: packet.event});
          break;
        case "grantItem":
          if (player.accessLevel != 5) return;

          const recipient = Object.values(players).find((player) => player.username == packet.username)
          const item = items.find((item) => item.DisplayName == packet.item);
          if (!recipient || !item) return;

          recipient.inventory.push(item);
          clients[recipient.id].send({
            type: 'addItems',
            //@ts-ignore
            items: [
              item
            ]
          })
      }
    },

    // ! for some reason, the closing of the websocket isn't fired when the tab is closed
    // TODO: kick the player for inactivity if they haven't sent a heartbeat packet in awhile
    close(ws) {
      const { ticket } = ws.data.query as { ticket: string };
      if (!ticket || !players[ticket]) return;
      killPlayer(ticket);
    },
  })
  .listen(3000);

setInterval(() => {
  if (Object.keys(players).length > 0) {
    const coinRoom = Math.floor(Math.random() * (5 - 0 + 1) + 0).toString();
    if (rooms[coinRoom].coins.length == 10) return;

    const coinPosition = getValidColliderSpawn(roomColliders[coinRoom]);
    if (coinPosition == null) return;
    const newCoin: SerializedSpawnObject = {
      id: (rooms[coinRoom].coins.length + 1).toString(),
      position: coinPosition,
      value: Math.floor(Math.random() * (10 - 1 + 1) + 1),
    };
    rooms[coinRoom].coins.push(newCoin);

    propagateEvent(
      function (player: SerializedPlayer) {
        return player.roomId == coinRoom;
      },
      null,
      {
        type: "spawnCoin",
        roomId: coinRoom,
        coin: newCoin,
      },
    );
  }
}, 10000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
