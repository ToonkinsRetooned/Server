import { Elysia } from "elysia";
const players: Record<string, SerializedPlayer> = {}

interface SerializedPlayer {
  id: string,
	connectionId: number,
	username: string,
	roomId: string,
	position: any,
	itemCharacter: string,
	itemNeck: string,
	itemOverwear: string,
	itemBody: string,
	itemHand: string,
	itemFace: string,
	itemFeet: string,
	inventory: any,
	coins: number,
	level: number,
	xp: number,
	globalMusicEnabled: boolean
}

interface PlayFabGetAccountInfo {
  code: number,
  status: string,
  data: {
    AccountInfo: {
      PlayFabId: string,
      Created: string,
      TitleInfo: {
        DisplayName: string,
        Origination: string,
        Created: string,
        LastLogin: string,
        FirstLogin: string,
        isBanned: boolean,
        // unneccessary data, any type used
        TitlePlayerAccount: any
      }
    }
  }
}

interface PlayFabGetUserInventory {
  code: number,
  status: string,
  data: {
    Inventory: Array<Object>,
    VirtualCurrency: {
      TK: number
    },
    VirtualCurrencyRechargeTimes: {}
  }
}

const app = new Elysia()
  .get('/*', async (ctx) => { return Bun.file(ctx.path != "/" ? `play${ctx.path.replace('play/', '')}` : `play/index.html`); })
  .ws('/', {
    async open(ws) {
      const { ticket } = ws.data.query;
      if (!ticket) ws.close();
      //@ts-expect-error
      if (Object.keys(players).includes(ticket)) ws.close();

      const session = atob(ticket as string).split('-');

      const account: PlayFabGetAccountInfo = (await (await fetch('https://ab3c.playfabapi.com/Client/GetAccountInfo', {
        method: "POST",
        body: JSON.stringify({
          "PlayFabId": session[0]
        }),
        headers: {
          "X-Authorization": "1C02155FEDCF52ED-DD86BB39C712ECF5-4D53C68D7AC7D4BE-AB3C-8DCFC0D3558520B-lB2wfnqKAsVdfZFmSN+H7lfXkG1wHkWxbcZQoQgXdo0=",
          "Content-Type": 'application/json'
        }
      })).json());
      if (account.code != 200) ws.close();
      if (account.data.AccountInfo.TitleInfo.isBanned) ws.close();

      const inventory: PlayFabGetUserInventory = (await (await fetch('https://ab3c.playfabapi.com/Client/GetUserInventory', {
        method: "POST",
        body: JSON.stringify({
          "PlayFabId": session[0]
        }),
        headers: {
          "X-Authorization": "1C02155FEDCF52ED-DD86BB39C712ECF5-4D53C68D7AC7D4BE-AB3C-8DCFC0D3558520B-lB2wfnqKAsVdfZFmSN+H7lfXkG1wHkWxbcZQoQgXdo0=",
          "Content-Type": 'application/json'
        }
      })).json());

      // !Fix username key causing WebAssembly error
      const serialized = {
        id: session[0],
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
        coins: 123,
        level: 1,
        xp: 43,
        globalMusicEnabled: true
      };
      //@ts-ignore
      players[ticket] = serialized;
      ws.send({type: 'login', player: serialized});
    },

    async message(ws, message) {
      const packet = JSON.parse(Buffer.from(message as ArrayBuffer).toString('utf-8'));
      console.log('Received websocket packet: ', packet.type);
      
      if (packet.type === "enterRoom") ws.send(message);
    },

    close(ws) {
      const { ticket } = ws.data.query;
      //@ts-expect-error
      console.log('Player ' + players[ticket].username + ' disconnected.');
    }
  })
  .listen(3000);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);
