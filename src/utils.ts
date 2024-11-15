import { players, clients } from "./db";
import { SerializedPlayer } from "./types";

export function propagateEvent(
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
  
export function killPlayer(ticket: string) {
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