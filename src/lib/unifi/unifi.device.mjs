const UNLIMITED_DEVICES = 0;
const ONE_DAY = 1440;

const DEFAULT_QUOTA = UNLIMITED_DEVICES;
const DEFAULT_EXPIRATION = ONE_DAY;
const DEFAULT_COUNT = 1;

/**
 * Abstract interface for communicating with an unifi device.
 */
class UnifiDevice {

  /**
   * Create a new instance.
   * @param {string} baseUrl
   *   the base which is prepended to each url.
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Establishes a connection with the device.
   *
   * @returns {UnifiDevice}
   *   a self reference
   */
  async connect() {
    throw new Error(`Implement connect`);
  }

  /**
   * Sends a get request to the given url.
   * @abstract
   *
   * @param {string} url
   *   the url to be queried.
   * @returns {string}
   *   the response as string.
   */
  async get(url) {
    throw new Error(`Implement get(${url})`);
  }

  /**
   * Sends a post request to the given url.
   * @abstract
   *
   * @param {string} url
   *   the url to be queried.
   * @param {object} data
   *   the request data as json object.
   * @returns {object}
   *   the response as json object
   */
  async post(url, data) {
    throw new Error(`Implement get(${url},${data})`);
  }


  /**
   * Request a list with all known vouchers.
   *
   * @returns {object}
   *   the response containing all known vouchers.
   */
  async getVouchers() {
    return await this.get(
      `${this.baseUrl}/api/s/default/stat/voucher`);
  }

  /**
   * Request voucher create at the given timestamp.
   *
   * @param {int} time
   *   an Epoch Timestamp but in seconds instead of milliseconds.
   * @returns {object}
   *   a response containing all voucher with the given timestamp.
   */
  async getVoucher(time) {
    const message = {
      "create_time": time
    };

    return await this.post(
      `${this.baseUrl}/api/s/default/stat/voucher`, message);
  }

  /**
   * Deletes/Revokes the voucher with the give id.
   *
   * @param {string} id
   *   the id which should be revoked.
   * @returns {object}
   *   the revocation response.
   */
  async revokeVoucher(id) {

    const message = {
      "_id": id,
      "cmd": "delete-voucher"
    };

    return await this.post(
      `${this.baseUrl}/api/s/default/cmd/hotspot`, message);
  }

  /**
   * Creates a new voucher.
   *
   * @param {string} note
   *   the note or description for the voucher.
   * @param {int} [expire]
   *   the expiration in seconds. Default to one day if omitted.
   * @param {int} [quota]
   *   the number of devices. Default to 0 (unlimited) if omitted.
   * @param {int} [count]
   *   the number of voucher to create. Default to one voucher if omitted.
   * @returns {object}
   *   the newly created voucher.
   */
  async createVoucher(note, expire, quota, count) {
    if ((typeof (quota) === "undefined") || (quota === null))
      quota = DEFAULT_QUOTA;

    if ((typeof (count) === "undefined") || (count === null))
      count = DEFAULT_COUNT;

    if ((typeof (expire) === "undefined") || (expire === null))
      expire = DEFAULT_EXPIRATION;

    const message = {
      "cmd": "create-voucher",
      "n": count,
      "quota": quota,
      "expire": expire,
      "note": note
    };

    let data = await this.post(
      `${this.baseUrl}/api/s/default/cmd/hotspot`, message);

    data = await this.getVoucher(data.data[0].create_time);
    return data.data;
  }
}

export { UnifiDevice };
