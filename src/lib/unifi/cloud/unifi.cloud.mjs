import { AwsCanonicalHeaderAuthentication } from "../../aws/aws.mjs";
import { UnifiCloudDevice } from "./unifi.cloud.device.mjs";

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
    uris = uris.filter((uri) => {
      return !uri.startsWith("stun:") && !uri.endsWith(":3478?transport=tcp");
    });
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


/**
 * An abstract authenticator implementation
 */
class AbstractUnifiCloudAuthenticator {

  /**
   * Creates a new instance.
   *
   * @param {string} id
   *   the authenticator's unique id.
   * @param {boolean} preferred
   *   true in case this is the default authentication method.
   */
  constructor(id, preferred) {
    this.id = id;
    this.preferred = preferred;
  }

  /**
   * Check if this is the user's default authenticator.
   *
   * @returns {boolean}
   *   true in case this is the default authenticator otherwise false.
   */
  isPreferred() {
    return this.preferred;
  }

  /**
   * Authenticates the current session via the given 2fa token.
   * @param {string} token
   *   the secret multi factor token generated returned by the second factor.
   */
  async authenticate(token) {

    const result = await fetch(
      "https://sso.ui.com/api/sso/v1/login/2fa", {
        method: "POST",
        cache: "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*"
        },
        body: JSON.stringify({ "token": token })
      });

    // TODO Check for success
  }

  /**
   * Gets a description for the mfa method
   *
   * @abstract
   * @returns {string}
   *   a human readable description for this authorization method.
   */
  getDescription() {
    throw new Error("Implement me");
  }

  /**
   * Returns the authenticators unique id.
   *
   * @returns {string}
   *   the authenticator's unique id.
   */
  getId() {
    return this.id;
  }

}

/**
 * The mail verification authenticator. Unifi will send an email with the authorization code.
 * It requires user interaction to enter the token.
 */
class UnifiCloudEmailAuthenticator extends AbstractUnifiCloudAuthenticator{

  /**
   * Creates a new instance
   *
   * @param {object} data
   *   the authenticator data returned by the unifi sso endpoint.
   * @param {boolean} isDefault
   *   true in case this is the default authentication method.
   */
  constructor(data, isDefault) {
    super(data.id, isDefault);
    this.data = data;
  }

  /**
   * @inheritdoc
   */
  getDescription() {
    return `Email authorization via ${this.data.email}`;
  }

  // resend
  // https://sso.ui.com/api/sso/v1/user/self/mfa/email/${data.id}/send
}



/**
 * The legacy authenticator which does not used mfa or user interaction
 */
class UnifiLegacyCloudAuthenticators {

  /**
   * Returns wether the authenticator requires used feedback or not.
   *
   * @returns {boolean}
   *   always false because it does not used mfa or user interaction.
   *   an exists for backward compatibility.
   */
  isMultiFactor() {
    return false;
  }

  /**
   * A list with all devices associated with this account.
   *
   * @returns {UnifiCloudDevice[]}
   *   a list with all unifi cloud devices accessible by the user
   */
  async getCloudDevices() {
    return await (new UnifiCloudConnection().getDevices());
  }
}

/**
 * The new multi factor authenticator which relies upon multi factor authentication.
 */
class UnifiCloudMultiFactorAuthenticators extends UnifiLegacyCloudAuthenticators {

  /**
   * Creates a new instance.
   */
  constructor() {
    super();
    this.authenticators = new Map();
  }

  /**
   * Returns wether the authenticator requires used feedback or not.
   *
   * @returns {boolean}
   *   always true all methods require user interaction.
   **/
  isMultiFactor() {
    return true;
  }

  /**
   * Gets an authenticator based on this unique id.
   *
   * @param {string} id
   *   the authenticator to be retrieved
   * @returns {AbstractUnifiCloudAuthenticator}
   *   the authenticator or null
   **/
  getAuthenticator(id) {
    return this.authenticators.get(id);
  }

  /**
   * Gets the user's preferred authenticator.
   *
   * @returns {AbstractUnifiCloudAuthenticator}
   *   the user's preferred authenticator.
   */
  getPreferredAuthenticator() {
    for (const authenticator of this.getAuthenticators()) {
      if (authenticator.isPreferred())
        return authenticator;
    }

    throw new Error("No preferred authenticator specified.");
  }

  /**
   * Gets a list all compatible authenticators.
   *
   * @returns {AbstractUnifiCloudAuthenticator[]}
   *   a list of compatible unifi cloud authenticators.
   */
  getAuthenticators() {
    return this.authenticators.values();
  }

  /**
   * Adds an authenticator to the list of compatible authenticators.
   *
   * @param {AbstractUnifiCloudAuthenticator} authenticator
   *   the authenticator to be added.
   */
  addAuthenticator(authenticator) {
    this.authenticators.set(authenticator.getId(), authenticator);
  }

  /**
   * Gets a list of all known cloud devices.
   *
   * @param {string} id
   *   the authenticator's unique id
   * @param {string} token
   *   the secret token returned to the user by the multi factor authorization.
   * @returns {UnifiCloudDevice[]}
   *   a list with all unifi cloud devices accessible by the user
   */
  async getCloudDevices(id, token) {
    // TODO cache the connection an return it in case we are already authenticated.
    await (this.getAuthenticator(id).authenticate(token));
    return await super.getCloudDevices();
  }
}

/**
 * Implements a high level authentication abstraction.
 *
 * It logs into the unifi cloud access then check if MFA is required.
 * If not a legacy non mfa authenticator is returned otherwise a mfa authenticator is returned.
 */
class UnifiCloudAuthentication {

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
   * @returns {UnifiCloudAuthenticators[]}
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

    if (result.status !== 499)
      return new UnifiLegacyCloudAuthenticators();

    const data = await result.json();

    if (data.required !== '2fa')
      return new UnifiLegacyCloudAuthenticators();

    const authenticators = new UnifiCloudMultiFactorAuthenticators();

    for (const authenticator of data.authenticators) {
      const isDefault = (data.user.default_mfa === authenticator.id);

      if (authenticator.type === "email") {
        authenticators.addAuthenticator(
          new UnifiCloudEmailAuthenticator(authenticator, isDefault));

        continue;
      }

      // if (authenticator.type === "XXXX") {
      //   items.put(new UnifiCloudTokenAuthenticator(authenticator));
      //   continue;
      // }

      console.log(`Unknown authenticator type ${authenticator.type}`);
    }

    return authenticators;
  }
}

export { UnifiCloudAuthentication };
