
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const HALF_A_MINUTE = 30;
const MILLISECONDS = 1000;

/**
 * Implements a token automated based multi factor authentication.
 */
class UnifiMfa {

  /**
   * creates a new instance.
   */
  constructor() {
    this.lookupTable = {};
    for (let i = 0; i < BASE32.length; i++)
      this.lookupTable[BASE32.charAt(i)] = i;

    self.timeWindow = HALF_A_MINUTE;

  }

  /**
   * Converts the current time into a multiple of the configured time window.
   *
   * @returns {int}
   *   the current time in the number of time windows.
   */
  getCounter() {
    return Math.floor(Math.floor(Date.now() / MILLISECONDS) / self.timeWindow);
  }

  /**
   * Decodes a string using base32
   *
   * @param {string} data
   *   the encoded string
   * @returns {Uint8Array}
   *   the decoded string
   */
  base32Decode(data) {

    data = data.toUpperCase();

    let bits = '';
    for (let i = 0; i < data.length; i++) {
      const char = data.charAt(i);
      if (!(char in this.lookupTable))
        throw new Error('Invalid base32 character: ' + char);

      bits += this.lookupTable[char].toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let i = 0; i < bits.length; i += 8)
      bytes.push(parseInt(bits.substr(i, 8), 2));

    return new Uint8Array(bytes);
  }

  /**
   * Calculates a one time password based on a timed token and the given secret.
   *
   * @param {string} secret
   *   the secret string
   * @returns {string}
   *   the Time based one time password.
   */
  async generateTOTP(secret) {

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, self.getCounter());

    const hmacKey = await (window.crypto.subtle.importKey(
      'raw', this.base32Decode(secret),
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false, ['sign']));

    const bytes = new Uint8Array(
      await crypto.subtle.sign('HMAC', hmacKey, buffer));

    const offset = bytes[19] & 0xf;
    let otp = ((bytes[offset] & 0x7f) << 24) |
        ((bytes[offset + 1] & 0xff) << 16) |
        ((bytes[offset + 2] & 0xff) << 8) |
        (bytes[offset + 3] & 0xff);

    otp = otp % 1000000;

    return otp.toString().padStart(6, '0');
  }
}

export { UnifiMfa };
