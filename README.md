# "Toonkins - Virtual World" Revival

An attempt to bring back Toonkins - a virtual world that closed 2 years ago. The build present is the latest WebGL build provided by one of the games' original developers. Thanks Austin!

## Websocket Event Hooks

I decompiled a beta copy of the desktop build from April 2020 which allows me to see what events the client listens for and what it expects from each.

### Re-implemented

> Both

- walk
- chat
- updateActiveItem
- spawnCoinCollected

> Server -> Client

- enterRoom
- userJoinedRoom
- login
- userLeaveRoom
- updateActiveItem
- pinataUpdateState
- spawnCoin

> Client -> Server

- joinRoom

### Identified from Desktop Build

- (RE-IMPLEMENTED) enterRoom
- (RE-IMPLEMENTED) userJoinedRoom
- (RE-IMPLEMENTED) login
- (RE-IMPLEMENTED) walk
- (RE-IMPLEMENTED) chat
- (RE-IMPLEMENTED) userLeaveRoom
- (RE-IMPLEMENTED) updateActiveItem
- (RE-IMPLEMENTED) pinataUpdateState
- addItems
- (RE-IMPLEMENTED) spawnCoin
- (RE-IMPLEMENTED) spawnCoinCollected
- (RE-IMPLEMENTED) mRBgC
- xpc
- (RE-IMPLEMENTED) shs
- (RE-IMPLEMENTED) shic
- (RE-IMPLEMENTED) she
- ac
- collectItem

### Abbreviations

- mRBgC = room background color changed event
- xpc = XP changed event
- shs = scavenger hunt started event
- shic = scavenger hunt item collected event
- she = scavenger hunt ended event
- ac = add currency event

## Development

To start the development server run:

```bash
bun run dev
```

> Serves @ http://localhost:3000/

Database structure:

```sql
CREATE TABLE players (
  id INT NOT NULL UNIQUE PRIMARY KEY,
  registered DATE NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  displayName TEXT NOT NULL UNIQUE,
  access_level INT NOT NULL DEFAULT 0,
  coins INT NOT NULL,
  level INT NOT NULL,
  xp INT NOT NULL,
  global_music BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  username_approved BOOLEAN NOT NULL DEFAULT false,
  banned BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE toons (
  id INT NOT NULL PRIMARY KEY,
  character TEXT DEFAULT '',
  head TEXT DEFAULT '',
  overbody TEXT DEFAULT '',
  neck TEXT DEFAULT '',
  overwear TEXT DEFAULT '',
  body TEXT DEFAULT '',
  hand TEXT DEFAULT '',
  face TEXT DEFAULT '',
  feet TEXT DEFAULT ''
);

CREATE TABLE items (
  id INT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  class TEXT NOT NULL,
  price INT NOT NULL,
  shop_id INT DEFAULT NULL,
  is_featured BOOLEAN DEFAULT false,
  dev_choice BOOLEAN DEFAULT false
);

CREATE TABLE inventories (
  id INT NOT NULL PRIMARY KEY,
  player_id INT NOT NULL,
  item_id INT NOT NULL,
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players (id),
  FOREIGN KEY (item_id) REFERENCES items (id)
);
```
