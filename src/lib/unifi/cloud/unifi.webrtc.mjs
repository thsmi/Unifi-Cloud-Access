import { MqttSocket } from "../../mqtt/mqtt.mjs";

/**
 * Implements a Unifi compatible WebRTC Connection via a MQTT based signaling.
 */
class UnifiWebRtcSocket {

  /**
   * Creates a new instance.
   *
   * @param {string} device
   *   the device's unique UUID like name
   * @param {string} identity
   *   the identity's name UUID, which owns the device.
   */
  constructor(device, identity) {
    this.connection = null;
    this.socket = null;

    this.session = window.crypto.randomUUID();
    this.device = device;
    this.identity = identity;
    this.sequence = 0;
  }

  /**
   * Returns the next sequence id.
   * @returns {int}
   *   the next message sequence id.
   */
  nextSequence() {
    this.sequence++;
    return this.sequence;
  }

  /**
   * Gets the WebRTC connection.
   * It will throw in case no connection is yet established.
   *
   * @returns {RTCPeerConnection}
   *    the WebRTC peer connection
   */
  getConnection() {
    if (this.connection === null)
      throw new Error("Not connected");

    return this.connection;
  }

  /**
   * Starts the connection.
   *
   * @param {string} url
   *   the signaling server's websocket address.
   * @param {string} urls
   *   urls of possible turn and tun servers used by the ice connection.
   * @param {string} username
   *   the username for the ice servers
   * @param {string} password
   *   the password for the ice servers
   */
  async connect(url, urls, username, password) {

    this.socket = new MqttSocket();
    await this.socket.connect(url);

    await this.socket.subscribe(
      `client/${this.identity}/+`,
      (msg) => { this.onChannelMessage(msg.topic, JSON.parse(msg.message)); });

    await this.socket.subscribe(
      `client/${this.identity}/${this.device}/connect/${this.session}-1`,
      (msg) => { this.onSessionMessage(msg.topic, JSON.parse(msg.message)); });

    this.connection = new RTCPeerConnection({
      "iceServers": [{
        "urls": urls,
        "username": username,
        "credential": password
      }]
    });

    await new Promise((resolve) => {

      this.connection.ondatachannel = (ev) => { console.log(ev); };
      this.connection.onicecandidate = (ev) => { this.onIceCandidate(ev); };
      this.connection.onnegotiationneeded = (ev) => { this.onConnect(ev); };
      // eslint-disable-next-line no-unused-vars
      this.connection.onconnectionstatechange = async (ev) => {
        if (this.connection.connectionState !== "connected")
          return;

        resolve();
      };

      this.connection.createDataChannel("placeholder");
    });

    await (this.socket.unsubscribe(
      `client/${this.identity}/${this.device}/connect/${this.session}-1`));
  }

  /**
   * Called whenever a WebRTC connection is started.
   * And the negotiation phase started.
   */
  async onConnect() {

    const offer = await this.connection.createOffer({
      iceRestart: true,
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });

    await this.connection.setLocalDescription(offer);

    const payload = JSON.stringify({
      "event": "offer",
      "seq": this.nextSequence(),
      "offer": offer.sdp,
      "iceServers": this.connection.getConfiguration().iceServers,
      "timestamp": 20
    });

    await this.publish(payload);
  }

  /**
   * Publishes a message to the session topic.
   *
   * @param {string} payload
   *   the message to be published.
   */
  async publish(payload) {
    await this.socket.publish(
      `client/${this.identity}/device/${this.device}/connect/${this.session}-1`,
      payload);
  }

  /**
   * Called whenever a new ice candidate was found.
   *
   * @param {Event} event
   *   the event which caused this callback.
   */
  onIceCandidate(event) {
    if (event.candidate === null)
      return;

    const message = {
      "event": "icecandidate",
      "seq": this.nextSequence(),
      "candidate": event.candidate.candidate,
      "timestamp": 26
    };

    this.publish(JSON.stringify(message));
  }

  /**
   * Called whenever a message on the channel topic is published.
   *
   * @param {string} topic
   *   the topic which caused this message.
   * @param {string} message
   *   the message published by the remote.
   */
  // eslint-disable-next-line no-unused-vars
  onChannelMessage(topic, message) {
  }

  /**
   * Called whenever a message on the session topic is published.
   *
   * @param {string} topic
   *   the topic which cause this message.
   * @param {string} message
   *   the message published by the remote.
   */
  onSessionMessage(topic, message) {

    if (message.event === 'icecandidate') {
      const candidate = {
        "candidate": message.candidate.replace(/^a=/, ""),
        "sdpMid": "0"
      };

      try {
        this.connection.addIceCandidate(candidate);
      } catch (ex) {
        console.log(ex);
      }

      return;
    }

    if (message.event === "answer") {
      this.connection.setRemoteDescription({
        "sdp": message.answer,
        "type": "answer"
      });
      return;
    }

    if (message.event === "sdpcomplete") {
      return;
    }

    console.log("Unknown event " + message.event);
  }
}

export { UnifiWebRtcSocket };
