enum accessLevel {
    PLAYER = 0,
    MODERATOR = 1,
    UNDERCOVER_MODERATOR = 2,
    ADMIN = 3,
    AMBASSADOR = 4,
    PARTY_MASTER = 5
}

type SerializedPlayerPosition = {
    x: number,
    y: number
}

export type SerializedPlayer = {
    id: string,
    connectionId: string,
    username: string,
    roomId: string,
    accessLevel: accessLevel,
    position: SerializedPlayerPosition,
    itemCharacter: string,
    itemHead: string,
    itemOverbody: string,
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