import { UnifiHttpDevice } from "./unifi.direct.device.mjs";

/**
 * Creates a direct http connection to a unifi machine or controller.
 */
class UnifiDirectConnection {

  /**
   * Checks if the remote is a machine or if it is a controller.
   * It tries to connect and evaluates the error message.
   *
   * @param {string} hostname
   *  the machine's hostname
   * @returns {boolean}
   *   true in case it is a machine otherwise false in case it is a controller.
   */
  async isMachine(hostname) {
    const response = await fetch(
      `https://${hostname}/api/auth/login`, {
        method: "GET",
        cache: "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*"
        }
      });

    const data = await response.json();

    if (!data.meta)
      return false;

    if (!data.meta.msg)
      return false;

    if (data.meta.msg !== "api.err.NoSiteContext")
      return false;

    return true;
  }

  /**
   * Authenticates against the unifi machine or controller
   * and collects the sessions cookie as well as the cross site
   * scripting cookie.
   *
   * As it is a direct connection it will return an array with one device.
   *
   * @param {string} hostname
   *   the machines or controllers ip or hostname.
   * @param {string} username
   *   the username.
   * @param {string} password
   *   the password.
   * @returns {UnifiHttpDevice[]}
   *   an array with exactly one device.
   */
  async login(hostname, username, password) {

    // Autodetect if we are connected to a machine or a controller.

    let authUrl = `https://${hostname}/api/auth/login`;
    let baseUrl = `https://${hostname}/proxy/network`;

    if (!(await this.isMachine(hostname))) {
      authUrl = `https://${hostname}/api/login`;
      baseUrl = `https://${hostname}`;
    }

    const response = await fetch(
      authUrl, {
        method: "POST",
        cache: "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*"
        },
        body: JSON.stringify({
          "username": username,
          "password": password,
          "token": "",
          "rememberMe": false
        })
      });

    const token = response.headers.get("X-Csrf-Token");

    return [new UnifiHttpDevice(baseUrl, token)];
  }
}

export {UnifiDirectConnection};
