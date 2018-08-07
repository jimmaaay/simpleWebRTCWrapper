/**
 * TODO: See if it's worth setting up workers for the below:
 * - Reading file contents
 * - Converting an object to an array buffer
 * - Converting an array buffer to an object
 */

import EventEmitter from 'eventemitter3';
import {
  convertObjectToArrayBuffer,
  arrayBufferToObject,
  intRange,
} from './helpers';
import {
  UnknownObject,
  Options,
  ObjectParts,
  CreateRoomObject,
} from './typings';

const defaultOptions = {
  maxChunkSize: 16384, // 16kb
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
};

export default class SimpleWebRTCWrapper extends EventEmitter {
  _dataChannel: false | RTCDataChannel;
  _connected: boolean;
  _objectParts: ObjectParts;
  options: Options;
  computer: RTCPeerConnection;

  constructor(options) {
    super();

    this._dataChannel = false;
    this._connected = false;
    this._objectParts = {}; // store parts of an object to put together

    this.options = { ...defaultOptions, ...options };

    const stunServer = this.options.stunServers[Math.floor(Math.random() * this.options.stunServers.length)];
    
    this.computer = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:' + stunServer,
        },
      ],
    });
    
    // fires after host has run this._finishCreatingRoom
    this.computer.ondatachannel = ({ channel }) => {
      this.dataChannel = channel;
    }

    this._finishCreatingRoom = this._finishCreatingRoom.bind(this);
    this._dataChannelOpen = this._dataChannelOpen.bind(this);
    this._dataChannelMessage = this._dataChannelMessage.bind(this);
    this._dataChannelClose = this._dataChannelClose.bind(this);
    this._dataChannelError = this._dataChannelError.bind(this);
    // this._onBrowserClose = this._onBrowserClose.bind(this);
  }

  get dataChannel(): false | RTCDataChannel {
    return this._dataChannel;
  }

  set dataChannel(value: false | RTCDataChannel) {
    this._dataChannel = value;
    if (this._dataChannel === false) return;
    this._dataChannel.addEventListener('open', this._dataChannelOpen);
    this._dataChannel.addEventListener('message', this._dataChannelMessage);
    this._dataChannel.addEventListener('close', this._dataChannelClose);
    this._dataChannel.addEventListener('error', this._dataChannelError);

    // window.addEventListener('beforeunload', this._onBrowserClose);
  }

  _finishCreatingRoom(peerOffer: string): void {
    const obj = JSON.parse(atob(peerOffer));
    const answer = new RTCSessionDescription(obj);
    this.computer.setRemoteDescription(answer);
  }

  // _onBrowserClose(e): void {
  //   console.log(JSON.stringify(e));
  // }

  _dataChannelOpen(): void {
    if (this._dataChannel === false) return;
    this._connected = true;
    this._dataChannel.removeEventListener('open', this._dataChannelOpen);
    this.emit('connected');
  }

  _dataChannelClose(): void {
    this.dataChannel = false;
    // window.removeEventListener('beforeunload', this._onBrowserClose);
    this.emit('connection-closed');
  }

  _dataChannelError(err): void {
    this.emit('error', err);
  }

  _dataChannelMessage(e: MessageEvent): void {
    const data = new Uint8Array(e.data);
    const headerSize = data[0];
    const header = arrayBufferToObject(data.slice(1, headerSize + 1).buffer);
    const dataBuffer = data.slice(headerSize + 1);
    const { size, id } = header;

    if (header.type === 'O') {
      
      if (! this._objectParts.hasOwnProperty(header.id)) {
        this._objectParts[header.id] = {
          total: 0,
          chunks: [],
        };
      }

      this._objectParts[id].total += dataBuffer.byteLength;
      this._objectParts[id].chunks.push(dataBuffer);

      if (this._objectParts[id].total === size) {
        const array = new Uint8Array(size);
        let filledAmount = 0;
        this._objectParts[id].chunks.forEach((chunk: Uint8Array) => {
          array.set(chunk, filledAmount);
          filledAmount += chunk.byteLength;
        });
        const obj = arrayBufferToObject(array.buffer);
        this.emit('message', obj);
        delete this._objectParts[id];
      }

    } else if (header.type === 'F') {
      const { name } = header;
      this.emit('fileChunk', {
        name,
        id,
        size,
        chunk: dataBuffer,
      });
    }

  }


  createRoom(): Promise<CreateRoomObject> { // returns a promise resolves to a web rtc connection description, which then will need to be used by the joinRoom function
    return new Promise((resolve, reject) => { // TODO: reject if takes too long to create a room?
      const onIcecandidate = (e: RTCPeerConnectionIceEvent): void => {
        if (e.candidate != null) return;
        const json = JSON.stringify(this.computer.localDescription.toJSON());
        this.computer.removeEventListener('icecandidate', onIcecandidate);
        resolve({
          finishCreatingRoom: this._finishCreatingRoom,
          offer: btoa(json),
        });
      }

      this.dataChannel = this.computer.createDataChannel('webrtc');
      this.computer.addEventListener('icecandidate', onIcecandidate);
    
      this.computer.createOffer()
        .then(_ => this.computer.setLocalDescription(_));
    });
    
  }


  joinRoom(hostOffer: string): Promise<string> { // returns a promise which resolves to web rtc connection description which the host (person that called createRoom) needs to use to start the connection
    return new Promise((resolve, reject) => {
      const onIcecandidate = (e: RTCPeerConnectionIceEvent): void => {
        if (e.candidate != null) return;
        this.computer.removeEventListener('icecandidate', onIcecandidate);
        resolve(btoa(JSON.stringify(this.computer.localDescription)));
      }

      let obj; 
      try {
        obj = JSON.parse(atob(hostOffer));
      } catch(e) {
        console.log(e);
        return reject(e);
      }
      
      const offer = new RTCSessionDescription(obj);
      this.computer
        .setRemoteDescription(offer)
        .then(_ => {
          return this.computer
            .createAnswer(this.options.sdpConstraints)
            .then(answerDesc => this.computer.setLocalDescription(answerDesc));
        });
      
      this.computer.addEventListener('icecandidate', onIcecandidate);
      
    });
  }

  sendObject(obj: UnknownObject): Promise<undefined> {
    return new Promise((resolve, reject) => {
    
      if (this._connected === false) return reject(new Error('SimpleWebRTCWrapper: No valid connection'));
      if (typeof obj !== 'object') return reject(new Error('SimpleWebRTCWrapper: No valid object passed to sendObject'));
      const id = `${Math.floor(performance.now())}__${intRange(0, 9999999999)}`;
      const dataToSend = new Uint8Array(convertObjectToArrayBuffer(obj));
      const requestHeaders = new Uint8Array(convertObjectToArrayBuffer({
        id,
        type: 'O', // O === Object
        size: dataToSend.byteLength,
      }));
      const requestHeadersSize = requestHeaders.byteLength;
      const { maxChunkSize } = this.options;
      const maxDataSize = maxChunkSize - requestHeadersSize - 1;

      const send = (data: Uint8Array, chunkIndex: number): void => {
        const start = maxDataSize * chunkIndex;
        const maxEnd = data.byteLength - start;

        const messageSize = maxEnd <= maxDataSize
        ? maxEnd + requestHeadersSize + 1
        : maxDataSize + requestHeadersSize + 1;

        const end = maxEnd <= maxDataSize
        ? data.byteLength
        : start + maxDataSize;

        const message = new Uint8Array(messageSize);
        const toSend = data.slice(start, end);
        message[0] = requestHeadersSize; // first byte tells how many bytes the headers take up
        message.set(requestHeaders, 1);
        message.set(toSend, 1 + requestHeadersSize);

        if (this.dataChannel === false) return reject(new Error('SimpleWebRTCWrapper: No data channel'));
        this.dataChannel.send(message);

        if (end === dataToSend.byteLength) return resolve(); // sent

        setTimeout(() => { // TODO: may want to set timeout to throttle sending data?
          send(data, ++chunkIndex);
        }, 0);

      }

      send(dataToSend, 0);

    });

  }

  sendFile(file: File): Promise<undefined> {
    return new Promise((resolve, reject) => {
      
      if (this._connected === false) return reject(new Error('SimpleWebRTCWrapper: No valid connection'));
      if (! (file instanceof File)) return reject(new Error('SimpleWebRTCWrapper: No valid file passed to sendFile'));

      const id = `${Math.floor(performance.now())}__${intRange(0, 9999999999)}`;
      const requestHeaders = new Uint8Array(convertObjectToArrayBuffer({
        id,
        type: 'F',
        size: file.size,
        name: file.name,
      }));

      const requestHeadersSize = requestHeaders.byteLength;
      const { maxChunkSize } = this.options;
      const maxDataSize = maxChunkSize - requestHeadersSize - 1;
      const reader = new FileReader();

      const send = (file: File, chunk: number): void => {
        const start = maxDataSize * chunk;
        const maxEnd = file.size - start;

        const messageSize = maxEnd <= maxDataSize
        ? maxEnd + requestHeadersSize + 1
        : maxDataSize + requestHeadersSize + 1;

        const end = maxEnd <= maxDataSize
        ? file.size
        : start + maxDataSize;

        reader.onload = () => {
          if (! (reader.result instanceof ArrayBuffer)) {
            return reject(new Error('SimpleWebRTCWrapper: issue when reading file'));
          }
          const message = new Uint8Array(messageSize);
          const data = new Uint8Array(reader.result);
          message[0] = requestHeadersSize;
          message.set(requestHeaders, 1);
          message.set(data, 1 + requestHeadersSize);

          if (this.dataChannel === false) {
            return reject(new Error('SimpleWebRTCWrapper: No data channel'));
          }

          this.dataChannel.send(message);

          if (end === file.size) return resolve();

          setTimeout(() => { // TODO: may want to set timeout to throttle sending data?
            send(file, ++chunk);
          }, 0);

        }

        reader.readAsArrayBuffer(file.slice(start, end));
      }

      send(file, 0);

    });

  }


}