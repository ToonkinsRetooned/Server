import { players, clients } from "./db";
import { SerializedPlayer, PolygonCollider2dPoint } from "./types";

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

export function getRandomPointOutsidePolygon(polygon: PolygonCollider2dPoint[]): PolygonCollider2dPoint | null {
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