import { Elysia } from "elysia";
import { RoomData, SerializedPlayer, SerializedSpawnObject, PlayFabGetAccountInfo, PlayFabGetUserInventory, PlayFabItem } from "./types";
import itemClasses from './itemClasses.json'
import scavengerHunts from './scavengerHunts.json'

const activeScavengerHunt = "easterhunt2020"
const players: Record<string, SerializedPlayer> = {}
const clients: Record<string, WebSocket> = {}
const rooms: Record<string, RoomData> = {
  "0": {pinatas: {}, coins: [], initialPosition: { x: -0.5, y: -1.5 }},   // Spawn Room
  "1": {pinatas: {}, coins: [], initialPosition: { x: 0, y: 0 }},         // Cafe & Arcade
  "2": {pinatas: {}, coins: [], initialPosition: { x: -5.5, y: -1 }},     // Quarterdeck
  "3": {pinatas: {}, coins: [], initialPosition: { x: -4, y: -2 }},       // Observatory
  "4": {pinatas: {}, coins: [], initialPosition: { x: 3, y: 1 }}          // The Beach
}
const pinataState: Record<string, Array<string>> = {}

function propagateEvent(
  condition: Function,
  sender: SerializedPlayer | null,
  message: { type: string } & Record<string, any>
) {
  console.log('Propagating ' + message.type + " event..");
  for (let player of Object.values(players)) {
    let include;
    if (sender != null) {
      include = condition(player, sender);
    } else {
      include = condition(player)
    }

    if (include && player != undefined) {
      try {
        console.log('| Propagating to: ' + player.username, player.id)
        //@ts-ignore: The packet is converted to the correct type during traffic.
        clients[player.id].send(message);
      } catch(e) {
        console.log('| Error when propagating: ', e)
      }
    }
  }
}

function killPlayer(ticket: string) {
  propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
    return player.roomId == sender.roomId && player != sender
  }, players[ticket], {
    type: 'userLeaveRoom',
    playerId: players[ticket].id
  });

  delete players[ticket];
  delete clients[ticket];
}

const app = new Elysia()
  .get('/v1/user/email-verified', ({set, error}) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

    return {
      emailVerified: true
    }
  })
  .options('/v1/user/email-verified', ({set, error}) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    return {
      emailVerified: true
    }
  })
  .get('/dev', (ctx) => {
    if (Object.keys(players).length == 0) {
      return {
        success: false,
        message: "No players are currently in memory."
      }
    } else {
      return {
        success: true,
        connections: Object.keys(clients).length,
        players: Object.values(players),
        rooms: rooms,
        pinatas: pinataState
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
        position: {x: 0, y: 0},
        itemCharacter: "1",
        itemHead: "3",
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
        globalMusicEnabled: true,
        shProgress: 0
      };

      players[ticket] = serialized;
      //@ts-ignore
      clients[serialized.id] = ws;

      ws.send({
        type: 'enterRoom',
        players: Object.values(players).filter((x) => x.roomId == "0" && x != serialized),
        pinatas: rooms[serialized.roomId].pinatas,
        coins: rooms[serialized.roomId].coins,
        roomId: "0",
        initialPosition: rooms[serialized.roomId].initialPosition,
        backgroundColor: rooms[serialized.roomId].backgroundColor
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
      const hunt = scavengerHunts[activeScavengerHunt]
      
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
            pinatas: rooms[player.roomId].pinatas,
            coins: rooms[player.roomId].coins,
            roomId: player.roomId,
            initialPosition: rooms[player.roomId].initialPosition,
            backgroundColor: rooms[player.roomId].backgroundColor
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
        case 'clickPinata':
          const pinataId = packet.id
          if (!rooms[player.roomId].pinatas[pinataId]) { rooms[player.roomId].pinatas[pinataId] = [] }

          const pinataRecord = rooms[player.roomId].pinatas[pinataId]
          if (pinataRecord.length != 4 && !pinataRecord.includes(player.id)) {
            pinataRecord.push(player.id)
            propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId
            }, players[ticket], {
              type: 'pinataUpdateState',
              pinataId: pinataId,
              pinataState: pinataRecord.length
            });
          } else if (pinataRecord.length == 4) {
            // TODO: add ability to get the item if you click after the 4th state
            delete rooms[player.roomId].pinatas[pinataId];
          }
          break
        case 'collectObject':
          if (packet.collectibleType == 'COIN') {
            const roomCoins = rooms[player.roomId].coins
            //@ts-ignore
            const coin = roomCoins.filter((coin) => coin.id == packet.collectibleId)[0]
            if (!coin) return;
            player.coins += coin.value

            propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId
            }, players[ticket], {
              type: 'spawnCoinCollected',
              coinId: coin.id,
              coinValue: coin.value,
              playerId: player.id
            });

            delete rooms[player.roomId].coins[packet.collectibleId];
          }
          break
        case 'ssh':
          player.shProgress = 0
          ws.send({
            type: 'shs',
            scavengerHuntId: activeScavengerHunt,
            items: hunt.map((item) => {return {id: item.id}}),
            initialItem: hunt[0]
          });
          break
        case 'cshi':
          ws.send({
            type: 'shic',
            scavengerHuntId: activeScavengerHunt,
            collectedItemId: scavengerHunts[activeScavengerHunt][player.shProgress].id,
            nextItem: scavengerHunts[activeScavengerHunt][player.shProgress + 1]
          })
          player.shProgress += 1
          if (player.shProgress == hunt.length) {
            ws.send({
              type: 'she',
              scavengerHuntId: activeScavengerHunt
            });
            // TODO: award items for completing scavenger hunt
          }
          break
        case 'startChatTyping':
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId
          }, players[ticket], {
            type: 'startChatTyping',
            playerId: player.id
          });
          break
        case 'stopChatTyping':
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId
          }, players[ticket], {
            type: 'stopChatTyping',
            playerId: player.id
          });
          break
      };
    },

    close(ws) {
      const { ticket } = ws.data.query as { ticket: string };

      // should be impossible, but just in-case
      if (!players[ticket] || !clients[ticket]) { return }
      killPlayer(ticket);
    }
  })
  .listen(3000);

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
  
setInterval(() => {
  if (Object.keys(players).length > 0) {
    const coinRoom = random(0, 4).toString();
    if (rooms[coinRoom].coins.length == 10) return;

    const newCoin: SerializedSpawnObject = {
      id: (rooms[coinRoom].coins.length + 1).toString(),
      position: {x: random(2.5, -2.5), y: random(2.5, -2.5)},
      value: 1
    }
    rooms[coinRoom].coins.push(newCoin);

    propagateEvent(function (player: SerializedPlayer) {
      return player.roomId == coinRoom
    }, null, {
      type: 'spawnCoin',
      roomId: coinRoom,
      coin: newCoin
    }); 
  } 
}, 5000);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);