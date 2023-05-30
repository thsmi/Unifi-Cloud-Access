import { AwsCanonicalRequestAuthentication } from "./../aws/aws.mjs";
import { UnifiWebRtcChannel } from "./unifi.webrtc.channel.mjs";
import { UnifiWebRtcSocket } from "./unifi.webrtc.mjs";

/**
 * Connect to the device.
 */
class UnifiDevice {

  /**
   * Creates a new instance.
   *
   * @param {Unifi} unifi
   *   the unifi cloud access instance.
   * @param {string} deviceId
   *   the device's details.
   */
  constructor(unifi, deviceId) {
    this.unifi = unifi;
    this.deviceId = deviceId;

    this.socket = null;
    this.apiChannels = new Map();
    this.apiChannelSequence = 0;

  }

  /**
   * Returns the device id.
   *
   * @returns {string}
   *   the device's unique id.
   */
  getDeviceId() {
    return this.deviceId;
  }

  /**
   * The MQTT endpoint's hostname.
   *
   * @returns {string}
   *   the hostname as string.
   */
  async getMqttHost() {
    return (await this.unifi.getConfig()).unifiCloudAccess.iot.host;
  }

  /**
   * A shorthand to access the session credentials.
   *
   * @returns {object}
   *   the session credentials.
   */
  async getCredentials() {
    return await this.unifi.getCredentials();
  }

  /**
   * Establishes a WebRTC Connection with a MQTT Signaling channel.
   *
   * @returns {UnifiDevice}
   *   a self reference
   */
  async connect() {

    // We can skip if we are already connected.
    if (this.socket)
      return this;

    const credentials = await this.getCredentials();
    const host = await this.getMqttHost();

    // Returns the Canonical Request Url to the MQTT endpoint.
    // This is an http url with embedded AWS authentication.
    const request = new AwsCanonicalRequestAuthentication(
      host,
      credentials.accessKeyId,
      credentials.region,
      "iotdevicegateway");

    request.setPath("/mqtt");
    request.setSecurityToken(credentials.sessionToken);

    const mqttUrl = await request.getUrl("wss", credentials.secretKey);

    this.socket = new UnifiWebRtcSocket(
      this.deviceId,
      credentials.identityId);

    await this.socket.connect(
      mqttUrl,
      credentials.turnCredentials.uris,
      credentials.turnCredentials.username,
      credentials.turnCredentials.password);

    return this;
  }

  /**
   * Opens a channel for api command.
   * It will automatically connect if not yet connected.
   *
   * @returns {UnifiWebRtcChannel}
   *   the WebRTC data channel which can be used for api commands.
   */
  async openApiChannel() {

    if (!this.socket)
      await this.connect();

    const name = "api:1";

    const channel = new UnifiWebRtcChannel(this.socket.getConnection());
    channel.onClose = () => { this.apiChannels.delete(name); };

    this.apiChannels.set(name, channel);

    await channel.open(name);

    return channel;
  }

  /**
   * Closes the given api channel.
   * @param {UnifiWebRtcChannel} channel
   *   the channel to be closes
   */
  async closeApiChannel(channel) {
    channel.close();
  }
}

export { UnifiDevice };
