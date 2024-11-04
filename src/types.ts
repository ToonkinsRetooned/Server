export type SerializedPlayer = {
    id: string,
    connectionId: number,
    username: string,
    roomId: string,
    position: any,
    itemCharacter: string,
    itemHead: "1",
    itemOverbody: "1",
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
  
export type PlayFabGetAccountInfo = {
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
  
export type PlayFabGetUserInventory = {
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