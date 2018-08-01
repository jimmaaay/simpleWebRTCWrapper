import EventEmitter from 'eventemitter3';
import {
  convertObjectToArrayBuffer,
  arrayBufferToObject,
  intRange,
} from './helpers';

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
  constructor(options) {
    super();

    this._dataChannel = false;
    this._connected = false;
    this._objectParts = {}; // store parts of an object to put together

    this.options = { ...defaultOptions, ...options };
    
    this.computer = new RTCPeerConnection({
      iceServers: [
        {
          url: 'stun:' + this.options.stunServers[Math.floor(Math.random() * this.options.stunServers.length)],
        },
      ],
    }, { optional: [{ DtlsSrtpKeyAgreement: true, }] });
    
    // fires after host has run this._finishCreatingRoom
    this.computer.addEventListener('datachannel', (e) => {
      const channel = e.channel || e;
      this.dataChannel = channel;
    });

    this._finishCreatingRoom = this._finishCreatingRoom.bind(this);
    this._dataChannelOpen = this._dataChannelOpen.bind(this);
    this._dataChannelMessage = this._dataChannelMessage.bind(this);
  }

  get dataChannel() {
    return this._dataChannel;
  }

  set dataChannel(value) {
    this._dataChannel = value;
    if (! (this._dataChannel instanceof RTCDataChannel)) return;
    this._dataChannel.addEventListener('open', this._dataChannelOpen);
    this._dataChannel.addEventListener('message', this._dataChannelMessage);
  }

  _finishCreatingRoom(peerOffer) {
    const obj = JSON.parse(atob(peerOffer));
    const answer = new RTCSessionDescription(obj);
    this.computer.setRemoteDescription(answer);
  }

  _dataChannelOpen() {
    this._connected = true;
    this._dataChannel.removeEventListener('open', this._dataChannelOpen);
    this.emit('connected');
  }

  _dataChannelMessage(e) {
    const data = new Uint8Array(e.data);
    const headerSize = data[0];
    const header = arrayBufferToObject(data.slice(1, headerSize + 1));
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
        const array = new Uint8Array(...this._objectParts[id].chunks);
        const obj = arrayBufferToObject(array);
        this.emit('message', obj);
        delete this._objectParts[id];
      }

    } else if (header.type === 'F') {
      const { filename } = header;
      this.emit('fileChunk', {
        filename,
        id,
        size,
        chunk: dataBuffer,
      });
    }

  }


  createRoom() { // returns a promise resolves to a web rtc connection description, which then will need to be used by the joinRoom function
    return new Promise((resolve, reject) => {
      const onIcecandidate = (e) => {
        if (e.candidate != null) return;
        const json = JSON.stringify(this.computer.localDescription.toJSON());
        this.computer.removeEventListener('icecandidate', onIcecandidate);
        resolve({
          finishCreatingRoom: this._finishCreatingRoom,
          offer: btoa(json),
        });
      }

      this.dataChannel = this.computer.createDataChannel('webrtc', {
        reliable: true,
      });
      this.computer.addEventListener('icecandidate', onIcecandidate);
    
      this.computer.createOffer()
        .then(_ => this.computer.setLocalDescription(_));
    });
    
  }


  joinRoom(hostOffer) { // returns a promise which resolves to web rtc connection description which the host (person that called createRoom) needs to use to start the connection
    return new Promise((resolve, reject) => {
      const onIcecandidate = (e) => {
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

  sendObject(obj) {
    if (this._connected === false) throw new Error('SimpleWebRTCWrapper: No valid connection');
    if (typeof obj !== 'object') throw new Error('SimpleWebRTCWrapper: No valid object passed to sendObject');
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

    const send = (data, chunkIndex) => {
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

      this.dataChannel.send(message);
      if (end === dataToSend.byteLength) return; // sent

      setTimeout(() => { // TODO: may want to set timeout to throttle sending data?
        send(data, ++chunkIndex);
      }, 0);

    }

    send(dataToSend, 0);

  }

  sendFile(file) {
    if (this._connected === false) throw new Error('SimpleWebRTCWrapper: No valid connection');
    if (! (file instanceof File)) throw new Error('SimpleWebRTCWrapper: No valid file passed to sendFile');
  }


}