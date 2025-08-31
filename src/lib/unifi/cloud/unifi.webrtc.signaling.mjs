import { Logger } from "./../../logger/logger.mjs";
import { MqttSocket } from "../../mqtt/mqtt.mjs";

const logger = Logger.getInstance();

/**
 * A wrapper for unifies webrtc signaling via websocket tunneled MQTT.
 * Used by the negotiator to negotiate the connection.
 */
class UnifiWebRtcSignaling {

  /**
   * Creates a new instance.
   * @param {string} url
   *   the url of the websocket endpoint which consumes MQTT
   * @param {string} identity
   *   the unique identity
   * @param {device} device
   *   the unique device id.
   */
  constructor(url, identity, device) {
    this.url = url;
    this.identity = identity;
    this.device = device;

    this.sequence = 0;
    this.session = window.crypto.randomUUID();

    this.negotiator = null;

    this.socket = null;
  }

  /**
   * Registers the negotiator which should be notified on signaling events.
   * @param {UnifiWebRTCSessionNegotiator} negotiator
   *   the Negotiator which coordinates the negotiation phase.
   */
  setNegotiator(negotiator) {
    this.negotiator = negotiator;
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
   * Called whenever a chanel related message is received.
   *
   * @param {*} message
   *  the message received from the remote.
   */
  // eslint-disable-next-line no-unused-vars
  async onChannelMessage(message) {
  }

  /**
   * Called whenever a session related message is received.
   *
   * @param {*} message
   *  the message received from the remote.
   */
  async onSessionMessage(message) {
    if (message.event === "icecandidate") {
      this?.negotiator?.onRemoteCandidate({
        "candidate": message.candidate.replace(/^a=/, ""),
        "sdpMid": "0"
      });
      return;
    }

    if (message.event === "answer") {
      this?.negotiator?.onRemoteAnswer(message.answer);
      return;
    }

    if (message.event === "sdpcomplete") {
      this?.negotiator?.onRemoteCandidate(null);
      return;
    }
  }

  /**
   * Creates a new mqtt channel.
   */
  async createChannel() {
    if (!this.socket) {
      this.socket = new MqttSocket();
      await this.socket.connect(this.url);
    }

    await this.socket.subscribe(
      `client/${this.identity}/+`,
      (msg) => { this.onChannelMessage(JSON.parse(msg.message)); });
  }

  /**
   * Creates a new mqtt session.
   */
  async createSession() {
    if (!this.socket)
      throw new Error("Can't create a session without a channel.");

    await this.socket.subscribe(
      `client/${this.identity}/${this.device}/connect/${this.session}-1`,
      (msg) => { this.onSessionMessage(JSON.parse(msg.message)); });
  }

  /**
   * Publishes a message to the session topic.
   *
   * @param {string} payload
   *   the message to be published.
   */
  async publish(payload) {
    if (!this.socket)
      throw new Error("Publish without a connection.");

    await this.socket.publish(
      `client/${this.identity}/device/${this.device}/connect/${this.session}-1`,
      payload);
  }

  /**
   * Publishes a local candidate to the remote.
   *
   * @param {string} candidate
   *   the candidate description
   */
  async publishLocalCandidate(candidate) {

    logger.log("Publish local candidate:\n" + candidate);
    const message = {
      "event": "icecandidate",
      "seq": this.nextSequence(),
      "candidate": candidate
      // "timestamp": 26
    };

    await this.publish(JSON.stringify(message));
  }

  /**
   * Publishes the local offer via the signaling channel.
   * @param {*} sdp
   *   the spd description
   * @param {*} servers
   *   the list of acceptable servers.
   */
  async publishLocalOffer(sdp, servers) {

    logger.log(`Signaling local offer:\n ${sdp}\n${servers.urls}`);

    const payload = JSON.stringify({
      "event": "offer",
      "seq": this.nextSequence(),
      "offer": sdp,
      "iceServers": servers
    });

    await this.publish(payload);
  }

  /**
   * Disconnects from the remote without unsubscribing.
   */
  disconnect() {
    this?.socket?.disconnect();
    this.socket = null;
  }
}

export { UnifiWebRtcSignaling };
