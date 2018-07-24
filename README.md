# simpleWebRTCWrapper

## Commands

* `npm run watch` - Starts a browser sync instance which restarts on any changes.
* `npm run build` - Generates minified files and places them in the `dist` folder


## Example

### Host

```javascript
(async () => {
  const connection = new SimpleWebRTCWrapper();
  const createdRoom = await connection.createRoom();
  createdRoom.finishCreatingRoom(PEER_OFFER)
})();
```

### Peer

```javascript
(async () => {
  const connection = new SimpleWebRTCWrapper();
  const joinedRoom = await connection.joinRoom(HOST_OFFER);
})();
```