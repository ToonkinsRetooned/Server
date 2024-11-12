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
  if (!ticket || !players[ticket]) return;
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
  .all('/v1/user/email-verified', ({set, error}) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

    return {
      emailVerified: true
    }
  })
  .get('/v1/profanity', (ctx) => {
    return {
      success: true,
      data: []
    }
  })
  .get('/v1/server', (ctx) => {
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

      if ((account.code != 200 || account.data.AccountInfo.TitleInfo.isBanned) && ticket != btoa("mock")) {
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

      let serialized: SerializedPlayer = {
        id: sessionSegments[0],
        connectionId: (Object.keys(players).length + 1).toString(),
        username: "",
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
        inventory: [],
        coins: 0,
        level: 1,
        xp: 0,
        globalMusicEnabled: true,
        shProgress: 0
      };

      // ! ADD CHECK TO MAKE SURE THE SERVER IS RUNNING IN A DEVELOPER ENVIRONMENT BEFORE ALLOWING MOCK SESSIONS
      if (ticket != btoa("mock")) {
        serialized.username = account.data.AccountInfo.TitleInfo.DisplayName
        serialized.inventory = inventory.data.Inventory
        serialized.coins = inventory.data.VirtualCurrency.TK
      } else {
        serialized.username = "(tester)"
        serialized.accessLevel = 5
        serialized.inventory = []
        serialized.coins = 2024
        serialized.itemCharacter = "4"
        //serialized.itemHead = "3"
      }

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
      const player = players[ticket]
      if (!ticket || !player) ws.close();

      const hunt = scavengerHunts[activeScavengerHunt]
      switch (packet.type) {
        case 'walk':
          player.position = packet.position
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, player, {
            type: 'walk',
            playerId: player.id,
            position: player.position
          });
          ws.send(message);
          break
        case 'joinRoom':
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId && player != sender
          }, player, {
            type: 'userLeaveRoom',
            playerId: player.id
          });

          const roomInfo = rooms[packet.id]
          player.roomId = packet.id
          player.position = roomInfo.initialPosition

          ws.send({
            type: 'enterRoom',
            players: Object.values(players).filter((x) => x.roomId == player.roomId && x != player),
            pinatas: roomInfo.pinatas,
            coins: roomInfo.coins,
            roomId: player.roomId,
            initialPosition: roomInfo.initialPosition,
            backgroundColor: roomInfo.backgroundColor
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
          let blockMessage = false
          const messageSegments = packet.text.split(' ');
          if (
            player.accessLevel >= 4 &&
            ["/roomBgColor", "/resetRoom"].includes(messageSegments[0])
          ) { blockMessage = true }

          if (!blockMessage) {
            // TODO: add checking of message length, invalid characters, etc before propagation
            propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId && player != sender
            }, player, {
              type: 'chat',
              playerId: player.id,
              text: packet.text
            });
          }

          if (messageSegments[0] == "/roomBgColor") {
            rooms[player.roomId].backgroundColor = {
              r: parseInt(messageSegments[1]),
              g: parseInt(messageSegments[2]),
              b: parseInt(messageSegments[3]),
              a: 1
            }
            propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
              return player.roomId == sender.roomId
            }, player, {
              type: 'mRBgC',
              roomId: player.id,
              backgroundColor: rooms[player.roomId].backgroundColor
            });
          } else if (messageSegments[0] == "/resetRoom") {
            // TODO: implement resetting room background color
          }

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
        case 'startPlayingMinigame':
          // the "stopChatTyping" event is re-used for the "startPlayingMinigame" event by the client
          propagateEvent(function (player: SerializedPlayer, sender: SerializedPlayer) {
            return player.roomId == sender.roomId
          }, players[ticket], {
            type: 'startPlayingMinigame',
            playerId: player.id
          });
          break
        case 'ugps':
          if (packet.globalMusicEnabled != true && packet.globalMusicEnabled != false) return;
          player.globalMusicEnabled = packet.globalMusicEnabled
          break
      };
    },

    // ! for some reason, the closing of the websocket isn't fired when the tab is closed
    // ! for some reason, if the web server dies on a host like Render, the client will not be sent to the login screen
    // TODO: kick the player for inactivity if they haven't sent a heartbeat packet in awhile
    close(ws) {
      const { ticket } = ws.data.query as { ticket: string };
      if (!ticket || !players[ticket]) return;
      killPlayer(ticket);
    }
  })
  .listen(3000);

function random(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1) + min); }
setInterval(() => {
  if (Object.keys(players).length > 0) {
    const coinRoom = random(0, 4).toString();
    if (rooms[coinRoom].coins.length == 20) return;

    const newCoin: SerializedSpawnObject = {
      id: (rooms[coinRoom].coins.length + 1).toString(),
      position: {x: random(-8, 9), y: random(-4, 1.15)},
      value: random(1, 5)
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
}, 10000);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);