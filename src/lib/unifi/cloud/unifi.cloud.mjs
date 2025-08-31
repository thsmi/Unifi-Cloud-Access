import { AwsCanonicalHeaderAuthentication } from "../../aws/aws.mjs";
import { UnifiCloudDevice } from "./unifi.cloud.device.mjs";

// The ubiquiti guys do something strange, they ignore the server
// returned by the server and instead use a hardcoded list of TURN servers.
const TURNS_SERVERS = [
  "stun:stun.cloudflare.com:3478",
  "turn:turn.cloudflare.com:3478?transport=udp",
  "turn:turn.cloudflare.com:3478?transport=tcp",
  "turns:turn.cloudflare.com:5349?transport=tcp",
  "stun:stun.cloudflare.com:53",
  "turn:turn.cloudflare.com:53?transport=udp",
  "turn:turn.cloudflare.com:80?transport=tcp",
  "turns:turn.cloudflare.com:443?transport=tcp"];


/**
 * Connects to the unifi cloud access.
 */
class UnifiCloudConnection {

  /**
   * Creates a new instance.
   */
  constructor() {
    this.config = null;
    this.credentials = null;
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
    /*uris = uris.filter((uri) => {
      return !uri.startsWith("stun:") && !uri.endsWith(":3478?transport=tcp");
    });*/

    // Inject the hardcoded TURN Servers.
    for (const server of TURNS_SERVERS) {
      if (!uris.includes(server)) {
        uris.push(server);
      }
    }

    credentials.turnCredentials.uris = uris;

    this.credentials = credentials;
    return this.credentials;
  }

  /**
   * Authenticates against the Unifi cloud access
   * and collects session cookies and returns the
   * list with all known devices.
   *
   * In case you are already connected the cached
   * list of devices is returned.
   *
   * @returns {UnifiCloudDevice[]}
   *  a list with all known unifi devices.
   **/
  async getDevices() {

    if (this.devices)
      return this.devices;

    await fetch("https://sso.ui.com/api/sso/v1/jwt/token", {
      cache: "no-cache",
      headers: {
        "content-type": "application/json",
        "Accept": "application/json, text/plain, */*"
      }
    });

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
      this.devices.push(new UnifiCloudDevice(this, device.id));

    return this.devices;
  }
}


export { UnifiCloudConnection };
