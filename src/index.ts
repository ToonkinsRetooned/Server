import { Elysia } from "elysia";
import { SerializedPlayer, PlayFabGetAccountInfo, PlayFabGetUserInventory } from "./types";

const players: Record<string, SerializedPlayer> = {}
const clients: Record<string, WebSocket> = {}

function propagateEvent(
  condition: Function,
  sender: SerializedPlayer,
  message: { type: string } & Record<string, any>
) {
  console.log('Propagating ' + message.type + " event..");
  for (let player of Object.values(players)) {
    if (condition(player, sender) && player != undefined) {
      //@ts-ignore: The packet is converted to the correct type during traffic.
      clients[player.id].send(message);
    }
  }
}

const app = new Elysia()
  .get('/dev', (ctx) => {
    if (Object.keys(players).length == 0) {
      return {
        success: false,
        message: "No players are currently in memory."
      }
    } else {
      return {
        success: true,
        connections: clients.length,
        players: Object.values(players).map((player) => {
          return {
            id: player.id,
            connectionId: player.connectionId,
            username: player.username,
            roomId: player.roomId,
            accessLevel: player.accessLevel
          }
        })
      }
    }
  })
  .get('/*', async (ctx) => { return Bun.file(ctx.path != "/" ? `play${ctx.path.replace('play/', '')}` : `play/index.html`); })
  .ws('/', {
    async open(ws) {
      const { ticket } = ws.data.query;
      if (!ticket) ws.close();
      //@ts-expect-error
      if (Object.keys(players).includes(ticket)) ws.close();

      const session = atob(ticket as string);
      const sessionSegments = session.split('-');

      const account: PlayFabGetAccountInfo = (await (await fetch('https://ab3c.playfabapi.com/Client/GetAccountInfo', {
        method: "POST",
        body: JSON.stringify({
          "PlayFabId": sessionSegments[0]
        }),
        headers: {
          "X-Authorization": session,
          "Content-Type": 'application/json'
        }
      })).json());
      if (account.code != 200) ws.close();
      if (account.data.AccountInfo.TitleInfo.isBanned) ws.close();

      const inventory: PlayFabGetUserInventory = (await (await fetch('https://ab3c.playfabapi.com/Client/GetUserInventory', {
        method: "POST",
        body: JSON.stringify({
          "PlayFabId": sessionSegments[0]
        }),
        headers: {
          "X-Authorization": session,
          "Content-Type": 'application/json'
        }
      })).json());

      // !Fix username key causing WebAssembly error
      //@ts-ignore: ^ Username key commented out due to awaiting bug fix above
      const serialized: SerializedPlayer = {
        id: sessionSegments[0],
        connectionId: (Object.keys(players).length + 1).toString(),
        username: account.data.AccountInfo.TitleInfo.DisplayName,
        accessLevel: 0,
        roomId: "0",
        position: {x: 0, y: 0},
        itemCharacter: "1",
        itemHead: "1",
        itemOverbody: "1",
        itemNeck: "1",
        itemOverwear: "1",
        itemBody: "1",
        itemHand: "1",
        itemFace: "1",
        itemFeet: "1",
        inventory: inventory.data.Inventory,
        coins: inventory.data.VirtualCurrency.TK,
        level: 1,
        xp: 0,
        globalMusicEnabled: true
      };

      ws.send({
        type: 'enterRoom',
        players: Object.values(players).filter((x) => x.roomId == "0"),
        pinatas: [],
        coins: [],
        roomId: "0",
        initialPosition: {
          x: 0,
          y: 0
        },
        // TODO: fix room backgounds
      });

      //@ts-ignore
      players[ticket] = serialized;
      //@ts-ignore
      clients[session[0]] = ws;

      ws.send({type: 'login', player: serialized});

      propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer){
        return player.roomId == sender.roomId && player != sender
      }, serialized, {
        type: 'userJoinedRoom',
        player: serialized
      });
    },

    async message(ws, message) {
      const packet = JSON.parse(Buffer.from(message as ArrayBuffer).toString('utf-8'));
      console.log('Received websocket packet: ', packet.type);

      const { ticket } = ws.data.query;
      if (!ticket) ws.close();
      //@ts-ignore
      const player = players[ticket]
      
      switch (packet.type) {
        case 'walk':
          player.position = packet.position
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, player, {
            type: 'walk',
            playerId: player,
            position: player.position
          });
          ws.send(message);
          break
        case 'enterRoom':
          player.roomId = packet.roomId
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, player, {
            type: 'userJoinedRoom',
            player: player
          });
          ws.send({
            type: 'enterRoom',
            players: Object.values(players).filter((x) => x.roomId == player.roomId),
            pinatas: [],
            coins: [],
            roomId: player.roomId,
            initialPosition: {
              x: 0,
              y: 0
            },
            // TODO: fix room backgounds
          });
          break
        case 'chat':
          // TODO: add checking of message length, invalid characters, etc before propagation
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, player, {
            type: 'chat',
            playerId: player.id,
            text: packet.text
          });
          break
      };
    },

    close(ws) {
      const { ticket } = ws.data.query as { ticket: string };

      propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
        return player.roomId == sender.roomId && player != sender
      }, players[ticket], {
        type: 'userLeaveRoom',
        playerId: players[ticket].id
      });

      delete players[ticket]
      delete clients[ticket]
    }
  })
  .listen(3000);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);
