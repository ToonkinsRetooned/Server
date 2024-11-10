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
- mRBgC
- xpc
- (RE-IMPLEMENTED) shs
- (RE-IMPLEMENTED) shic
- (RE-IMPLEMENTED) she
- ac

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