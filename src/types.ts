enum accessLevel {
  PLAYER = 0,
  MODERATOR = 1,
  UNDERCOVER_MODERATOR = 2,
  ADMIN = 3,
  AMBASSADOR = 4,
  PARTY_MASTER = 5,
}

type SerializedPlayerPosition = { x: number; y: number };
type SerializedPosition = { x: number; y: number };
export type PolygonCollider2dPoint = { x: number; y: number };
type SerializedBackgroundColor = { r: number; g: number; b: number; a: number };
type PinataData = { id: string, players: Array<string> }

export type RoomData = {
  players?: Array<SerializedPlayer>;
  pinatas: Array<PinataData>;
  coins: Array<SerializedSpawnObject>;
  initialPosition: SerializedPlayerPosition;
  backgroundColor?: SerializedBackgroundColor;
};

export type SerializedPlayer = {
  id: string;
  connectionId: string;
  username: string;
  roomId: string;
  accessLevel: accessLevel;
  position: SerializedPlayerPosition;
  itemCharacter: string;
  itemHead: string;
  itemOverbody: string;
  itemNeck: string;
  itemOverwear: string;
  itemBody: string;
  itemHand: string;
  itemFace: string;
  itemFeet: string;
  inventory: any;
  coins: number;
  level: number;
  xp: number;
  globalMusicEnabled: boolean;

  // Scavenger Hunt Progress
  shProgress: number;
  action: null | "minigame";
};

export type SerializedPlayerPartial = Partial<SerializedPlayer> & { 
  connectionId: string; 
  roomId: string;
  position: SerializedPlayerPosition;
  itemCharacter: string;
  itemHead: string;
  itemOverbody: string;
  itemNeck: string;
  itemOverwear: string;
  itemBody: string;
  itemHand: string;
  itemFace: string;
  itemFeet: string;
  inventory: any[]; 
  shProgress: number; 
  action: any; 
};

export interface LoginPlayer extends SerializedPlayer {
  email?: string,
  password?: string
};

export type SerializedSpawnObject = {
  id: string;
  position: SerializedPosition;
  value: number;
};

export type PlayFabGetAccountInfo = {
  code: number;
  status: string;
  data: {
    AccountInfo: {
      PlayFabId: string;
      Created: string;
      TitleInfo: {
        DisplayName: string;
        Origination: string;
        Created: string;
        LastLogin: string;
        FirstLogin: string;
        isBanned: boolean;
        // unneccessary data, any type used
        TitlePlayerAccount: any;
      };
    };
  };
};

export type PlayFabItem = {
  ItemId: string;
  ItemInstanceId: string;
  ItemClass: string;
  PurchaseDate: string;
  CatalogVersion: string;
  DisplayName: string;
  UnitPrice: number;
};

export type PlayFabGetUserInventory = {
  code: number;
  status: string;
  data: {
    Inventory: Array<PlayFabItem>;
    VirtualCurrency: {
      TK: number;
    };
    VirtualCurrencyRechargeTimes: {};
  };
};

export type PlayfabLogin = {
  code: number,
  status: string,
  data: {
    SessionTicket: string,
    PlayFabId: string,
    NewlyCreated: boolean,
    SettingsForUser: any,
    LastLoginTime: string,
    EntityToken: any,
    TreatmentAssignment: any

    // SettingsForUser, EntityToken, and TreatmentAssignment are set to any type as they are
    // not used by the code
  }
};