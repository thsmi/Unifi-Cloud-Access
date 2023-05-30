import { AwsCanonicalHeaderAuthentication } from "./../aws/aws.mjs";
import { UnifiDevice } from "./unifi.device.mjs";

/**
 * Connects to the unifi cloud access.
 */
class Unifi {

  /**
   * Creates a new instance.
   */
  constructor() {
    this.config = null;
    this.credentials = null;
  }

  /**
   * Authenticates against the Unifi cloud access
   * and collects session cookies.
   *
   * @param {string} username
   *   the username
   * @param {string} password
   *   the password
   **/
  async login(username, password) {
    await fetch(
      "https://sso.ui.com/api/sso/v1/login", {
        method: "POST",
        cache: "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*"
        },
        body: JSON.stringify({ "user": username, "password": password })
      });

    await fetch("https://sso.ui.com/api/sso/v1/jwt/token", {
      cache: "no-cache",
      headers: {
        "content-type": "application/json",
        "Accept": "application/json, text/plain, */*"
      }
    });
  }

  /**
   * Loads the cloud access config.
   * It contains urls and other important information.
   *
   * It will be fetched once and cached.
   *
   * @returns {object}
   *   the cloud access configuration object.
   */
  async getConfig() {
    if (this.config)
      return this.config;

    const response = await fetch("https://config.ubnt.com/cloudAccessConfig.json", {
      cache: "no-cache",
      headers: {
        "content-type": "application/json",
        "Accept": "application/json, text/plain, */*"
      }
    });

    this.config = await response.json();
    return this.config;
  }

  /**
   * Gets the session credentials or better the session token used by
   * WebRTC and MQTT.
   *
   * It will be fetched once and cached.
   *
   * @returns  {object}
   *   the session credentials.
   */
  async getCredentials() {
    if (this.credentials)
      return this.credentials;

    const host = (new URL(
      (await this.getConfig()).unifiCloudAccess.apiGatewayUI.url)).host;

    const response = await fetch(`https://${host}/create-credentials`, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        "Accept": "*/*"
      },
      body: JSON.stringify({ "withTurn": true })
    });

    const credentials = await response.json();

    // we need to remove for some unknown reason stun from the config and tcp:3478.
    let uris = credentials.turnCredentials.uris;
    uris = uris.filter((uri) => {
      return !uri.startsWith("stun:") && !uri.endsWith(":3478?transport=tcp");
    });
    credentials.turnCredentials.uris = uris;

    this.credentials = credentials;
    return this.credentials;
  }

  /**
   * Returns all devices connected to this cloud access.
   *
   * It will be fetched once and cached.
   *
   * @returns {UnifiDevice[]}
   *   the list with all connected devices.
   */
  async getDevices() {
    if (this.devices)
      return this.devices;

    const credentials = await this.getCredentials();
    const host = (new URL(
      (await this.getConfig()).unifiCloudAccess.apiGateway.url)).host;

    const request = new AwsCanonicalHeaderAuthentication(
      host,
      credentials.accessKeyId,
      credentials.region,
      "execute-api");

    request.setSecurityToken(credentials.sessionToken);
    request.setPath("/devices");
    request.setQuery("type=ucore&withUserData=true");

    const url = `https://${request.getHost()}${request.getPath()}?${request.getCanonicalQuery()}`;

    const headers = {};
    headers["accept"] = "application/json, text/plain, */*";
    headers["authorization"] = await request.getAuthorization(credentials.secretKey);

    for (const [key, value] of request.getHeaders().entries())
      headers[key] = value;

    const response = await fetch(url, {
      cache: "no-cache",
      headers: headers
    });

    const devices = await response.json();

    this.devices = [];
    for (const device of devices)
      this.devices.push(new UnifiDevice(this, device.id));

    return this.devices;
  }
}

export {Unifi};
