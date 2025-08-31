
/**
 * A simple centralized logger instance.
 */

const TWO_CHARS = 2;
const THREE_CHARS = 3;
const BASE_10 = 10;

let instance = null;

/**
 * Implements a simplistic centralized logger.
 */
class Logger {

  /**
   * Creates or returns a logger instance.
   * It is guaranteed to be a singleton.
   *
   * @returns {Logger}
   *   the logger instance.
   */
  static getInstance() {
    if (instance === null)
      instance = new Logger();

    return instance;
  }


  /**
   * Pads the given string with leading zeros
   * @private
   *
   * @param {string} n
   *   the string which should be padded
   * @param {int} m
   *   the maximum padding.
   *
   * @returns {string}
   *   the padded string
   */
  _pad(n, m) {

    let str = n;

    for (let i = 0; i < m; i++)
      if (n < Math.pow(BASE_10, i))
        str = '0' + str;

    return str;
  }

  /**
   * Gets the current time in iso format (hh:mm:ss.SSS)
   *
   * @returns {string}
   *   the current timestamp as string.
   */
  getTimestamp() {

    const date = new Date();
    return this._pad(date.getHours(), TWO_CHARS)
      + ":" + this._pad(date.getMinutes(), TWO_CHARS)
      + ":" + this._pad(date.getSeconds(), TWO_CHARS)
      + "." + this._pad(date.getMilliseconds(), THREE_CHARS);
  }

  /**
   * Logs the given message to the browser console.
   *
   * @param {string} message
   *   the message which should be logged
   **/
  log(message) {
    // eslint-disable-next-line no-console
    console.log(`[${this.getTimestamp()}] ${message}`);
  }

}

export { Logger };
