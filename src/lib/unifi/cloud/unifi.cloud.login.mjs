import {
  UnifiCloudSingleFactorAuthenticator,
  UnifiCloudMultiFactorAuthenticator
} from "./unifi.cloud.authenticator.mjs";

const MFA_REQUIRED = 499;

/**
 * Implements a cookie based authentication.
 */
class UnifiCloudCookieAuthentication {

  /**
   * Logs into the cloud by using the UBIC_AUTH token.
   * @returns {UnifiCloudAuthenticators}
   *   the authenticator to be used to connect to a cloud device.
   */
  async login() {
    const hasAuthCookie = await window.electron.hasCookie("UBIC_AUTH");
    if (!hasAuthCookie)
      throw new Error("No Session cookie found.");

    const result = await fetch(
      "https://sso.ui.com/api/sso/v1/user/self", {
        cache: "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*"
        }
      });

    if (result.status !== 200) {
      // remove cookie it is expired...
      window.electron.clearCookies();

      throw new Error("Session cookie expired, require username and password.");
    }

    return new UnifiCloudSingleFactorAuthenticator();
  }
}

/**
 * Implements a password or token based single or multi factor authentication.
 *
 * It logs into the unifi cloud access then check if MFA is required.
 * If not a legacy non mfa authenticator is returned otherwise a mfa authenticator is returned.
 */
class UnifiCloudPasswordAuthentication {

  /**
   * Requests a list of authenticators from for the
   * unifi cloud access and collets the session cookies.
   *
   * The authenticator can be used to obtain a list with
   * all known devices.
   *
   * @param {string} username
   *   the username
   * @param {string} password
   *   the password
   * @returns {UnifiCloudAuthenticator[]}
   *   the list with all connected devices.
   **/
  async login(username, password) {

    const result = await fetch(
      "https://sso.ui.com/api/sso/v1/login", {
        method: "POST",
        cache: "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*"
        },
        body: JSON.stringify({ "user": username, "password": password })
      });

    // TODO do we also get other results? We should catch errors here too...
    // like wrong passwords...

    if (result.status !== MFA_REQUIRED)
      return new UnifiCloudSingleFactorAuthenticator();

    const data = await result.json();

    if (data.required !== '2fa')
      return new UnifiCloudSingleFactorAuthenticator();

    return new UnifiCloudMultiFactorAuthenticator(
      data.authenticators, data.user.default_mfa);
  }
}

export {
  UnifiCloudPasswordAuthentication,
  UnifiCloudCookieAuthentication
};
