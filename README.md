# simpleWebRTCWrapper

## Installation

Using npm:

```shell
$ npm i --save simple-webrtc-wrapper
```

```js
import SimpleWebRTCWrapper from 'simple-webrtc-wrapper';

const connection = new SimpleWebRTCWrapper({
  maxChunkSize: 16384,
  stunServers: [
    'stun.l.google.com:19302',
    'stun1.l.google.com:19302',
    'stun2.l.google.com:19302',
    'stun3.l.google.com:19302',
    'stun4.l.google.com:19302',
    'stun.services.mozilla.com',
  ],
  sdpConstraints: {
    optional: [],
  },
});
```

## Options

* `maxChunkSize` - (number) The maximum amount of data sent over the connection at once. Defaults to 16kb
* `stunServers` - (array) An array of stun servers, a random one out of these will be picked when the class is constructed
* `sdpConstraints`


## API

* `createRoom()` - Returns a promise which resolves an object with an `offer` which needs to be sent to the peer and a function `finishCreatingRoom` which needs the peer's response passed into it.
* `joinRoom(hostOffer)` - Returns a promise which resolves to a string which needs to be given to the host to finish creating the connection
* `sendObject(object)` - Returns a promise which resolves when everything in enqued to send over the connection
* `sendFile(file)` - Returns a promise which resolves when everything in enqued to send over the connection

## Events

* `connected` - Fired when the connected to the peer
* `connection-closed` - Fired when the connection is closed
* `error` - Fired when an error event is fired from the data channel
* `message` - Fired when an object is recieved from the peer
* `fileChunk` - Fired when a file chunk is recieved from the peer

## Example

### Host

```javascript
(async () => {
  const connection = new SimpleWebRTCWrapper();
  const createdRoom = await connection.createRoom();
  const HOST_OFFER = createdRoom.offer; // send this to the peer

  createdRoom.finishCreatingRoom(PEER_OFFER);

  connection
    .on('connected', (e) => console.log('connected'))
    .on('message', (e) => console.log('recieved', e))
    .on('fileChunk', (e) => console.log('recieved chunk', e));
})();
```

### Peer

```javascript
(async () => {
  const connection = new SimpleWebRTCWrapper();

  const PEER_OFFER = await connection.joinRoom(HOST_OFFER); // send this to the host

  connection
    .on('connected', (e) => console.log('connected'))
    .on('message', (e) => console.log('recieved', e))
    .on('fileChunk', (e) => console.log('recieved chunk', e));
})();
```


## Dev Commands

* `npm run watch` - Starts a browser sync instance which restarts on any changes.
* `npm run build` - Generates minified files and places them in the `dist` folder
