import {
  SmtpClientSideException,
  SmtpServerSideException
} from "./smtp.exception.mjs";

// Positive response codes:
const RESPONSE_READY = 220;
const RESPONSE_AUTH_SUCCEEDED = 235;
const RESPONSE_ACTION_COMPLETED = 250;

// Positive intermediate code
const RESPONSE_SERVER_CHALLENGE = 334;
const RESPONSE_START_MAIL_INPUT = 354;

const AUTH_STATE_INIT = 0;
const AUTH_STATE_USERNAME = 1;
const AUTH_STATE_PASSWORD = 2;
const AUTH_STATE_COMPLETED = 3;

const DATA_STATE_INIT = 0;
const DATA_STATE_TRANSMIT = 1;
const DATA_STATE_COMPLETED = 2;


/**
 * Sends a new message with a command to the smtp server.
 */
class SmtpCommand {

  /**
   * Creates a new instance.
   */
  constructor() {
    this.resolve = null;
    this.reject = null;

    this.state = 0;
  }

  /**
   * Called whenever a response to a command is received
   *
   * @param {int} code
   *   the response code returned by the server
   * @param {string} response
   *   the response text returned by the server
   * @abstract
   */
  onResponse(code, response) {
    throw new Error(`Implement onResponse(${code},${response})`);
  }

  /**
   * Called in case of a recoverable client side error.
   *
   * @param {string} message
   *   the error message to be added to the server error.
   */
  onClientError(message) {
    this.reject(new SmtpClientSideException(message));
  }

  /**
   * Called in case of an unrecoverable server side error.
   *
   * @param {string} message
   *   the human readable error message.
   * @param {int} code
   *   the response code returned by the server.
   * @param {string} response
   *   the detailed response returned by the server.
   */
  onServerError(message, code, response) {
    this.reject(new SmtpServerSideException(message, code, response));
  }

  /**
   * Registers success and error handlers for this command.
   *
   * @param {Function} resolve
   *   the function to be called upon success.
   * @param {Function} reject
   *   the function to be called upon error.
   */
  register(resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
  }

  /**
   * Checks if the conversation between server and client was completed.
   *
   * @returns {boolean}
   *   true in case the message's conversation it not complete otherwise false.
   */
  hasNextCommand() {
    return false;
  }

  /**
   * Returns the next command to be send to the server.
   *
   * @returns {string}
   *   the next command to null in case there is none.
   */
  getNextCommand() {
    return null;
  }

}

/**
 * A virtual command consuming the unsolicited welcome message send by the server.
 */
class SmtpWelcomeCommand extends SmtpCommand {

  /**
   * @inheritdoc
   */
  onResponse(code, response) {

    if (code !== RESPONSE_READY) {
      this.onServerError(
        `Expected ready message but got response code ${code}`, code, response);
      return;
    }

    this.resolve();
  }
}

/**
 * Sends the extended hello message to the smtp server.
 */
class SmtpEhloCommand extends SmtpCommand {

  /**
   * @inheritdoc
   */
  onResponse(code, response) {

    if (code !== RESPONSE_ACTION_COMPLETED) {
      this.onServerError(
        `Sending extended hello failed with response code ${code}`, code, response);
      return;
    }

    this.state++;
    this.resolve();
  }

  /**
   * @inheritdoc
   */
  hasNextCommand() {
    return (this.state === 0);
  }

  /**
   * @inheritdoc
   */
  getNextCommand() {
    return 'EHLO example.com';
  }
}

/**
 * Sends an authentication request to the server.
 */
class SmtpAuthCommand extends SmtpCommand {

  /**
   * Creates a new instance
   *
   * @param {string} username
   *   the username to be used for authentication.
   * @param {string} password
   *   the password to be used for authentication.
   */
  constructor(username, password) {
    super();

    this.username = username;
    this.password = password;
    this.authState = 'INIT';
  }

  /**
   * Called when the server is ready to receive the username.
   *
   * @param {int} code
   *   the response code returned by the server.
   * @param {string} response
   *   the server's response message returned by the server.
   */
  onUsername(code, response) {

    if (code !== RESPONSE_SERVER_CHALLENGE) {
      this.onServerError(
        `Expected a server challenge but got response code ${code}`, code, response);
      return;
    }

    if (response !== "VXNlcm5hbWU6") {
      this.onServerError(
        `Server response error, expected username: but got ${response}`, code, response);
      return;
    }

    this.resolve();
    this.state++;
  }

  /**
   * Called when the server is ready to receive the password.
   *
   * @param {int} code
   *   the response code returned by the server.
   *
   * @param {string} response
   *   the server's response message returned by the server.
   */
  onPassword(code, response) {

    if (code !== RESPONSE_SERVER_CHALLENGE) {
      this.onServerError(
        `Expected a server challenge but got response code ${code}`, code, response);
      return;
    }

    if (response !== "UGFzc3dvcmQ6") {
      this.onServerError(
        `Server response error, expected password: but got ${response}`, code, response);
      return;
    }

    this.resolve();
    this.state++;
  }

  /**
   * Called whenever the server completes the authentication
   *
   * @param {int} code
   *   the response code returned by the server.
   *
   * @param {string} response
   *   the server's response message returned by the server.
   */
  onCompleted(code, response) {

    if (code !== RESPONSE_AUTH_SUCCEEDED) {
      this.onServerError(
        `Authentication failed with response code ${code}`, code, response);
      return;
    }

    this.resolve();
    this.state++;
  }

  /**
   * @inheritdoc
   */
  onResponse(code, response) {
    if (this.state === AUTH_STATE_INIT) {
      this.onUsername(code, response);
      return;
    }

    if (this.state === AUTH_STATE_USERNAME) {
      this.onPassword(code, response);
      return;
    }

    if (this.state === AUTH_STATE_PASSWORD) {
      this.onCompleted(code, response);
      return;
    }

    this.onClientError('Sequence error during authentication, invalid state');
    return;
  }

  /**
   * @inheritdoc
   */
  hasNextCommand() {
    return (this.state < AUTH_STATE_COMPLETED);
  }

  /**
   * @inheritdoc
   */
  getNextCommand() {
    if (this.state === AUTH_STATE_INIT)
      return 'AUTH LOGIN';

    if (this.state === AUTH_STATE_USERNAME)
      return Buffer.from(this.username).toString('base64');

    if (this.state === AUTH_STATE_PASSWORD)
      return Buffer.from(this.password).toString('base64');

    return null;
  }
}

/**
 * Sets the from field in the current mail's envelope.
 */
class SmtpFromCommand extends SmtpCommand {

  /**
   * Create a new instance
   *
   * @param {string} from
   *   the from address to be set on the mail server.
   */
  constructor(from) {
    super();
    this.from = from;
  }

  /**
   * @inheritdoc
   */
  onResponse(code, response) {

    if (code !== RESPONSE_ACTION_COMPLETED) {
      this.onServerError(
        `Setting sender failed with response code ${code}`, code, response);
      return;
    }

    this.state++;
    this.resolve();
  }

  /**
   * @inheritdoc
   */
  hasNextCommand() {
    return (this.state === 0);
  }

  /**
   * @inheritdoc
   */
  getNextCommand() {
    return `MAIL FROM:<${this.from}>`;
  }
}

/**
 * Sets the recipient for the next message.
 */
class SmtpRecipientCommand extends SmtpCommand {

  /**
   * Creates a new instance
   *
   * @param {string} recipient
   *   the recipients mail address to be added to the envelope.
   */
  constructor(recipient) {
    super();
    this.recipient = recipient;
  }

  /**
   * @inheritdoc
   */
  onResponse(code, response) {

    if (code !== RESPONSE_ACTION_COMPLETED) {
      this.onServerError(
        `Setting recipient failed with response code ${code}`, code, response);
      return;
    }

    this.state++;
    this.resolve();
  }

  /**
   * @inheritdoc
   */
  hasNextCommand() {
    return (this.state === 0);
  }

  /**
   * @inheritdoc
   */
  getNextCommand() {
    return `RCPT TO:<${this.recipient}>`;
  }
}

/**
 * Sets the data for the current mail to be send.
 */
class SmtpDataCommand extends SmtpCommand {

  /**
   * Creates a new instance
   *
   * @param {string} data
   *   the mail body to be added to the envelope.
   */
  constructor(data) {
    super();
    this.data = data;
  }

  /**
   * Called when the server is ready to receive mail data.
   *
   * @param {int} code
   *   the server's response code.
   * @param {string} response
   *   the server's response which signals if it is ready so receive the mail data.
   */
  onData(code, response) {

    if (code !== RESPONSE_START_MAIL_INPUT) {
      this.onServerError(`Expected to start Mail input but got response code ${code}`, code, response);
      return;
    }

    this.resolve();
    this.state++;
  }

  /**
   * Called when the server completed processing the mail data.
   *
   * @param {int} code
   *   the server's response code.
   * @param {string} response
   *   the server's response which indicates if the mail data could be processed or
   *   if a failure occurred.
   */
  onCompleted(code, response) {

    if (code !== RESPONSE_ACTION_COMPLETED) {
      this.onServerError(
        `Sending mail failed with response code ${code}`, code, response);
      return;
    }

    this.resolve();
    this.state++;
  }

  /**
   * @inheritdoc
   */
  onResponse(code, response) {
    if (this.state === DATA_STATE_INIT) {
      this.onData(code, response);
      return;
    }

    if (this.state === DATA_STATE_TRANSMIT) {
      this.onCompleted(code, response);
      return;
    }

    this.onClientError('Sequence error while sending data, invalid state');
    return;
  }

  /**
   * @inheritdoc
   */
  hasNextCommand() {
    return (this.state < DATA_STATE_COMPLETED);
  }

  /**
   * @inheritdoc
   */
  getNextCommand() {
    if (this.state === DATA_STATE_INIT)
      return "DATA";

    if (this.state === DATA_STATE_TRANSMIT)
      return this.data + "\r\n.\r\n";

    return null;
  }}

export {
  SmtpWelcomeCommand,
  SmtpEhloCommand,
  SmtpAuthCommand,
  SmtpFromCommand,
  SmtpRecipientCommand,
  SmtpDataCommand
};
