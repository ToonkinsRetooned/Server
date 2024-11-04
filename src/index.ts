import { Elysia } from "elysia";
import { SerializedPlayer, PlayFabGetAccountInfo, PlayFabGetUserInventory, PlayFabItem } from "./types";
import itemClasses from './itemClasses.json'

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
      try {
        //@ts-ignore: The packet is converted to the correct type during traffic.
        clients[player.id].send(message);
      } catch(e) {}
    }
  }
}

const app = new Elysia()
  .get('/v1/user/email-verified', () => {return {
    emailVerified: true
  }})
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
        players: Object.values(players)
      }
    }
  })
  .get('/*', async (ctx) => { return Bun.file(ctx.path != "/" ? `play${ctx.path.replace('play/', '')}` : `play/index.html`); })
  .ws('/', {
    async open(ws) {
      const { ticket } = ws.data.query as { ticket: string };
      if (!ticket || Object.keys(players).includes(ticket)) {
        ws.close();
        return
      };

      const session = atob(ticket as string);
      const sessionSegments: Array<string> = session.split('-');

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

      if (account.code != 200 || account.data.AccountInfo.TitleInfo.isBanned) {
        ws.close();
        return
      }

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

      const serialized: SerializedPlayer = {
        id: sessionSegments[0],
        connectionId: (Object.keys(players).length + 1).toString(),
        username: account.data.AccountInfo.TitleInfo.DisplayName,
        accessLevel: 0,
        roomId: "0",
        position: {x: 0, y: 0, z: -1},
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

      players[ticket] = serialized;
      //@ts-ignore
      clients[session[0]] = ws;

      ws.send({
        type: 'enterRoom',
        players: Object.values(players).filter((x) => x.roomId == "0" && x != serialized),
        pinatas: [],
        coins: [],
        roomId: "0",
        initialPosition: {x: 0, y: 0, z: -1},
        backgroundColor: {r: 255, g: 255, b: 255, a: 1}
        // TODO: fix room backgounds
      });

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

      const { ticket } = ws.data.query as { ticket: string };
      if (!ticket) ws.close();
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
        case 'joinRoom':
          player.roomId = packet.id
          ws.send({
            type: 'enterRoom',
            players: Object.values(players).filter((x) => x.roomId == player.roomId && x != player),
            pinatas: [],
            coins: [],
            roomId: player.roomId,
            initialPosition: {x: 0, y: 0, z: -1}
            // TODO: fix room backgounds
          });
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, player, {
            type: 'userJoinedRoom',
            player: player
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
        case 'updateActiveItem':
          // ? if I learn what the item classes are, maybe add a check to make sure the provided one exists
          if (player.inventory.findIndex((item: PlayFabItem) => item.ItemId == packet.itemId) == 0) { return }
          
          const itemIndex = itemClasses.findIndex((item) => item.ItemId == packet.itemId)
          if (!itemIndex) { return }
          const itemClass = itemClasses[itemIndex].ItemClass
          
          switch (itemClass) {
            case 'character': player.itemCharacter = packet.itemId; break
            case 'head': player.itemHead = packet.itemId; break
            case 'overbody': player.itemOverbody = packet.itemId; break
            case 'neck': player.itemNeck = packet.itemId; break
            case 'overwear': player.itemOverwear = packet.itemId; break
            case 'body': player.itemBody = packet.itemId; break
            case 'hand': player.itemHand = packet.itemId; break
            case 'face': player.itemFace = packet.itemId; break
            case 'feet': player.itemFeet = packet.itemId; break
          }

          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, players[ticket], {
            type: 'updateActiveItem',
            playerId: player.id,
            itemClass: itemClass,
            itemId: packet.itemId
          });

          break
      };
    },

    close(ws) {
      const { ticket } = ws.data.query as { ticket: string };

      // should be impossible, but just in-case
      if (!players[ticket] || !clients[ticket]) { return }

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