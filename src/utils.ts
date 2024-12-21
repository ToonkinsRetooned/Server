import { turso, players, clients, rooms, mockAccount } from "./db";
import { SerializedPlayer, SerializedPlayerPartial, PolygonCollider2dPoint, PlayFabGetAccountInfo, PlayFabGetUserInventory, PlayfabLogin } from "./types";

export function propagateEvent(
  condition: Function,
  sender: SerializedPlayer | null,
  message: { type: string } & Record<string, any>,
) {
  console.log("Propagating " + message.type + " event..");
  for (let player of Object.values(players)) {
    let include;
    if (sender != null) {
      include = condition(player, sender);
    } else {
      include = condition(player);
    }

    if (include && player != undefined) {
      try {
        console.log("| Propagating to: " + player.username, player.id);
        //@ts-ignore: The packet is converted to the correct type during traffic.
        clients[player.id].send(message);
      } catch (e) {
        console.log("| Error when propagating: ", e);
      }
    }
  }
}

export function killPlayer(ticket: string) {
  if (!ticket || !players[ticket]) return;
  propagateEvent(
    function (player: SerializedPlayer, sender: SerializedPlayer) {
      return player.roomId == sender.roomId && player != sender;
    },
    players[ticket],
    {
      type: "userLeaveRoom",
      playerId: players[ticket].id,
    },
  );

  delete players[ticket];
  delete clients[ticket];
}

export function getValidColliderSpawn(polygon: PolygonCollider2dPoint[]): PolygonCollider2dPoint | null {
  const getRandomPointInBounds = (minX: number, maxX: number, minY: number, maxY: number): PolygonCollider2dPoint => {
    return {
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY
    };
  };

  const isPointInPolygon = (point: PolygonCollider2dPoint, polygon: PolygonCollider2dPoint[]): boolean => {
    let inside = false;
    const { x, y } = point;
    const len = polygon.length;

    for (let i = 0, j = len - 1; i < len; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  };

  // Get bounding box of the polygon
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let point: PolygonCollider2dPoint | null = null;
  let attempts = 0;

  // Retry limit to avoid infinite loop in case of complex polygons
  while (attempts < 1000) {
    const randomPoint = getRandomPointInBounds(minX, maxX, minY, maxY);
    if (!isPointInPolygon(randomPoint, polygon)) {
      point = randomPoint;
      break;
    }
    attempts++;
  }

  return point;
}

export function serializePlayer(account: Record<string, any>, character: Record<string, string>): SerializedPlayer {
  const serialized: SerializedPlayerPartial = {
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
  }

  return serialized as SerializedPlayer
}

export async function handlePlayFabLogin(ticket: string, email?: string, password?: string) {
  if (ticket == btoa("mock")) {
    return {
      success: true,
      account: {
        code: 200,
        status: "OK",
        data: {
          AccountInfo: mockAccount
        }
      },
      inventory: {
        code: 200,
        status: "OK",
        data: {
          Inventory: [],
          VirtualCurrency: {
            TK: 19999
          }
        }
      }
    }
  };

  if (!ticket && email && password) {
    const login: PlayfabLogin = await (
      await fetch("https://ab3c.playfabapi.com/Client/LoginWithEmailAddress?sdk=UnitySDK-2.59.190123", {
        method: "POST",
        body: JSON.stringify({
          Email: email,
          InfoRequestParameters: null,
          Password: password,
          TitleId: "AB3C"
        }),
        headers: { "Content-Type": "application/json" }
      })
    ).json();
  
    if (login.code != 200) {
      return { success: false };
    }

    ticket = login.data.SessionTicket;
  } else {
    ticket = atob(ticket);
  };

  const sessionSegments: Array<string> = ticket.split("-");
  const account: PlayFabGetAccountInfo = await (
    await fetch("https://ab3c.playfabapi.com/Client/GetAccountInfo", {
      method: "POST",
      body: JSON.stringify({
        PlayFabId: sessionSegments[0],
      }),
      headers: {
        "X-Authorization": ticket,
        "Content-Type": "application/json"
      },
    })
  ).json();

  if (account.code != 200 || account.data.AccountInfo.TitleInfo.isBanned) {
    return { success: false };
  }

  const inventory: PlayFabGetUserInventory = await (
    await fetch("https://ab3c.playfabapi.com/Client/GetUserInventory", {
      method: "POST",
      body: JSON.stringify({
        PlayFabId: sessionSegments[0],
      }),
      headers: {
        "X-Authorization": ticket,
        "Content-Type": "application/json"
      },
    })
  ).json();

  return {
    success: true,
    account: account,
    inventory: inventory
  }
}