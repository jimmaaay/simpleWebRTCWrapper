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
  const HOST_OFFER = createdRoom.offer; // send this to the peer

  createdRoom.finishCreatingRoom(PEER_OFFER);

  connection.on('connected', (e) => console.log('connected'));
})();
```

### Peer

```javascript
(async () => {
  const connection = new SimpleWebRTCWrapper();

  const PEER_OFFER = await connection.joinRoom(HOST_OFFER); // send this to the host

  connection.on('connected', (e) => console.log('connected'));
})();
```