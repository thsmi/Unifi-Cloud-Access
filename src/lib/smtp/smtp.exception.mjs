/**
 * Thrown in case the server responds to a command with
 * a negative response code.
 */
class SmtpServerSideException extends Error {

  /**
   * Creates a new instance
   * @param {string} message
   *   the human readable error message to be displayed to the user
   * @param {int} code
   *   the response code returned by the server
   * @param {string} response
   *   the detailed response returned by the server
   */
  constructor(message, code, response) {
    super(message);
    this.code = code;
    this.response = response;
  }
}

/**
 * Thrown in case a client side exception occurs.
 */
class SmtpClientSideException extends Error {
}

export {
  SmtpClientSideException,
  SmtpServerSideException
};
