import { AwsCanonicalRequestAuthentication } from "../../aws/aws.mjs";
import { UnifiDevice } from "../unifi.device.mjs";
import { UnifiWebRtcChannel, UnifiGetRequest, UnifiPostRequest } from "./unifi.webrtc.channel.mjs";
import { UnifiWebRtcSocket } from "./unifi.webrtc.mjs";

/**
 * Connect to the device.
 */
class UnifiCloudDevice extends UnifiDevice {

  /**
   * Creates a new instance.
   *
   * @param {UnifiCloudConnection} unifi
   *   the unifi cloud access instance.
   * @param {string} deviceId
   *   the device's details.
   */
  constructor(unifi, deviceId) {
    super("/proxy/network");

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
   * Opens a channel then invokes the steps callback and finally closes the channel.
   *
   * @param {Function} steps
   *   the callback to be executed when the channel is created. After the callback
   *   completes the channel will be automatically closed.
   *
   * @returns {object}
   *   the result of the steps callback function.
   */
  async withChannel(steps) {
    const channel = await this.openApiChannel();

    let result = undefined;

    try {
      result = await steps(channel);
    } finally {
      channel.close();
    }

    return result;
  }

  /**
   * Sends an http post like request to the given url.
   *
   * @param {string} url
   *   the target url which processes the post.
   * @param {object} message
   *   the message as string.
   * @returns {string}
   *   the post request's response.
   */
  async post(url, message) {
    return await this.withChannel(async (channel) => {
      return await channel.send(
        new UnifiPostRequest(url, (new TextEncoder()).encode(JSON.stringify(message))));
    });
  }

  /**
   * Sends a http get like request to the given url.
   *
   * @param {string} url
   *   the target which processes the get.
   * @returns {string}
   *   the get request's response.
   */
  async get(url) {
    return await this.withChannel(async (channel) => {
      return await channel.send(new UnifiGetRequest(url));
    });
  }

}

export { UnifiCloudDevice };
