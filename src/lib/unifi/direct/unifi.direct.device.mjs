import { UnifiDevice } from "../unifi.device.mjs";

/**
 * Connects via http to a unifi machine or controller.
 */
class UnifiHttpDevice extends UnifiDevice{

  /**
   * Creates a new instance
   * @param {string} baseUrl
   *   the base url as string
   * @param {string} token
   *   the cross site scripting token.
   */
  constructor(baseUrl, token) {
    super(baseUrl);

    this.token = token;
  }

  /**
   * @inheritdoc
   */
  connect() {
    // Nothing to do we are already connected.
  }

  /**
   * @inheritdoc
   */
  async post(url, message) {
    const response = await fetch(
      url, {
        method : "POST",
        cache : "no-cache",
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*",
          "X-CSRF-Token": this.token
        },
        body: JSON.stringify(message)
      });

    return await response.json();
  }

  /**
   * @inheritdoc
   */
  async get(url) {
    const response = await fetch(
      url, {
        method : "GET",
        cache : "no-cache",
        credentials: 'include',
        headers: {
          "content-type": "application/json",
          "Accept": "application/json, text/plain, */*",
          "X-CSRF-Token": this.token
        }
      });

    return await response.json();
  }

}

export { UnifiHttpDevice };
