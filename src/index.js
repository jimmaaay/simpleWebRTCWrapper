import EventEmitter from 'eventemitter3';

const stunServers = [ // TODO: use npm module that has an upto date list
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
];

const sdpConstraints = {
  optional: [],
};

export default class SimpleWebRTCWrapper extends EventEmitter{
  constructor(_) {
    super(_);

    const config = {
      iceServers: [
        {
          url: 'stun:' + stunServers[Math.floor(Math.random() * stunServers.length)],
        },
      ]
    };

    const webConnection = { 
      optional: [
        {
          DtlsSrtpKeyAgreement: true,
        },
      ],
    };
    
    this.dataChannel = false;
    this.computer = new RTCPeerConnection(config, webConnection);
    
    // fires after peer has run this.__finishCreatingRoom
    this.computer.addEventListener('datachannel', (e) => {
      console.log(e);
    });

    this.__finishCreatingRoom = this.__finishCreatingRoom.bind(this);
  }

  __finishCreatingRoom(peerOffer) {
    const obj = JSON.parse(atob(peerOffer));
    const answer = new RTCSessionDescription(obj);
    this.computer.setRemoteDescription(answer);
  }

  createRoom() { // returns a promise resolves to a web rtc connection description, which then will need to be used by the joinRoom function
    return new Promise((resolve, reject) => {
      this.dataChannel = this.computer.createDataChannel('webrtc', {
        reliable: true,
      });

      this.computer.addEventListener('icecandidate', (e) => { // TODO: remove eventListener after being succesful
        if (e.candidate != null) return;
        const json = JSON.stringify(this.computer.localDescription.toJSON());
        resolve({
          finishCreatingRoom: this.__finishCreatingRoom,
          offer: btoa(json),
        });
      });
      
      this.computer.createOffer()
        .then(_ => this.computer.setLocalDescription(_));
    });
    
  }


  joinRoom(hostOffer) { // returns a promise which resolves to web rtc connection description which the host (person that called createRoom) needs to use to start the connection
    return new Promise((resolve, reject) => {
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
            .createAnswer(sdpConstraints)
            .then(answerDesc => this.computer.setLocalDescription(answerDesc));
        });
      
      this.computer.addEventListener('icecandidate', (e) => { // TODO: remove event listener
        if (e.candidate != null) return;
        resolve(btoa(JSON.stringify(this.computer.localDescription)));
      });
      
    });
  }


}