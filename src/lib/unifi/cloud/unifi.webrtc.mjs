import { UnifiWebRtcSignaling } from "./unifi.webrtc.signaling.mjs";
import { UnifiWebRtcConnection } from "./unifi.webrtc.connection.mjs";
import { UnifiWebRtcNegotiator } from "./unifi.webrtc.negotiator.mjs";

/**
 * Implements a unifi specific webrtc socket wrapper.
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

    this.device = device;
    this.identity = identity;
  }

  /**
   * Returns the raw webrtc connection.
   *
   * @returns {RTCPeerConnection}
   *   the connection which can be used to communicate via webrtc.
   */
  getConnection() {
    return this.connection.getRawConnection();
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

    try {

      this.signaling = new UnifiWebRtcSignaling(url, this.identity, this.device);
      await this.signaling.createChannel();

      this.connection = new UnifiWebRtcConnection(urls, username, password);
      await this.signaling.createSession();

      const negotiator = new UnifiWebRtcNegotiator(this.connection, this.signaling);
      await negotiator.negotiate();

      return;

    } catch (ex) {

      console.error(ex);
      this.disconnect();
      throw new Error("Failed to create a webrtc session");
    }
  }

  /**
   * Disconnects the signaling session and closes the connection.
   */
  async disconnect() {
    this?.signaling?.disconnect();
    this?.connection?.close();

    this.signaling = null;
    this.connection = null;
  }
}

export { UnifiWebRtcSocket };
