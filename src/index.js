import EventEmitter from 'eventemitter3';
import {
  convertObjectToArrayBuffer,
  arrayBufferToObject,
} from './helpers';

const defaultOptions = {
  stunServers: [ // TODO: use npm module that has an upto date list
    'stun.l.google.com:19302',
    'stun1.l.google.com:19302',
    'stun2.l.google.com:19302',
    'stun3.l.google.com:19302',
    'stun4.l.google.com:19302',
    'stun.ekiga.net',
    'stun.ideasip.com',
    'stun.schlund.de',
    'stun.stunprotocol.org:3478',
    'stun.voiparound.com',
    'stun.voipbuster.com',
    'stun.voipstunt.com',
    'stun.voxgratia.org',
    'stun.services.mozilla.com'
  ],
  sdpConstraints: {
    optional: [],
  },
}


export default class SimpleWebRTCWrapper extends EventEmitter {
  constructor(options) {
    super();

    this._dataChannel = false;
    this._connected = false;

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
  }

  get dataChannel() {
    return this._dataChannel;
  }

  set dataChannel(value) {
    this._dataChannel = value;
    if (! (this._dataChannel instanceof RTCDataChannel)) return;
    this._dataChannel.addEventListener('open', this._dataChannelOpen);
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


  createRoom() { // returns a promise resolves to a web rtc connection description, which then will need to be used by the joinRoom function
    return new Promise((resolve, reject) => {
      const onIcecandidate = () => {
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
    const arrayBuffer = convertObjectToArrayBuffer(obj);

  }


}