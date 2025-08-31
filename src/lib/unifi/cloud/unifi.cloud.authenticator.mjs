import { UnifiCloudConnection } from "./unifi.cloud.mjs";

const AUTHENTICATION_SUCCESSFUL = 200;

/**
 * The single factor authenticator which does not used mfa or user interaction.
 * Typically used for cookie authentication.
 */
class UnifiCloudSingleFactorAuthenticator {

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
   * Returns the authenticator for a non multi factor authenticator.
   *
   * @returns {UnifiCloudConnection}
   *   a list with all unifi cloud devices accessible by the user
   **/
  async getCloudConnection() {
    return new UnifiCloudConnection();
  }
}


/**
 * An abstract authenticator implementation
 */
class AbstractUnifiCloudAuthenticationFactor {

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
   * @returns {UnifiCloudConnection}
   *   a self reference
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

    if (result.status !== AUTHENTICATION_SUCCESSFUL)
      throw new Error("2FA token was rejected by the server");

    return new UnifiCloudConnection();
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
class UnifiCloudEmailAuthenticatorFactor extends AbstractUnifiCloudAuthenticationFactor {

  /**
   * Creates a new instance
   *
   * @param {object} data
   *   the authenticator data returned by the unifi sso endpoint.
   */
  constructor(data) {
    super(data.id);
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
 * The new multi factor authenticator which relies upon multi factor authentication.
 */
class UnifiCloudMultiFactorAuthenticator extends UnifiCloudSingleFactorAuthenticator {

  /**
   * Creates a new instance.
   *
   * @param {object[]} factors
   *   a list with all supported factors.
   * @param {string} preferredFactorId
   *    the default user's preferred factor.
   */
  constructor(factors, preferredFactorId) {
    super();

    this.preferredFactorId = preferredFactorId;

    this.factors = new Map();

    for (const factor of factors) {

      if (factor.type === "email") {
        const item = new UnifiCloudEmailAuthenticatorFactor(factor);
        this.factors.set(item.getId(), item);

        console.log(item.getId());
        continue;
      }

      // if (authenticator.type === "XXXX") {
      //   items.put(new UnifiCloudTokenAuthenticator(authenticator));
      //   continue;
      // }

      console.log(`Unknown authenticator type ${factor.type}`);
    }
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
   * Gets the user's preferred authenticator.
   *
   * @returns {AbstractUnifiCloudAuthenticator}
   *   the user's preferred authenticator.
   */
  getPreferredFactor() {
    if (!this.factors.has(this.preferredFactorId))
      throw new Error("No preferred authenticator specified.");

    return this.factors.get(this.preferredFactorId);
  }

  /**
   * Gets a list all compatible authenticators.
   *
   * @returns {AbstractUnifiCloudAuthenticator[]}
   *   a list of compatible unifi cloud authenticators.
   */
  getFactors() {
    return this.factors.values();
  }

  /**
   * Gets an authenticator based on his unique id.
   *
   * @param {string} id
   *   the unique id of the authenticator.
   * @returns {AbstractUnifiCloudAuthenticator}
   *   the authenticator with the given id.
   **/
  getFactor(id) {
    if (!this.factors.has(id))
      throw new Error(`No authenticator with id ${id} found.`);

    return this.factors.get(id);
  }

  /**
   * Gets an authenticator based on this unique id.
   *
   * @param {string} factor
   *   the factor to be used for authentication.
   * @param {string} token
   *   the secret token to unlock the mfa authorization factor.
   * @returns {UnifiCloudConnection}
   *   the cloud connection.
   **/
  async getCloudConnection(factor, token) {
    return await (this.getFactor(factor).authenticate(token));
  }
}

export {
  UnifiCloudSingleFactorAuthenticator,
  UnifiCloudMultiFactorAuthenticator
};
