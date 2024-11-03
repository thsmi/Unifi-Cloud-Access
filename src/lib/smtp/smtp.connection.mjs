import {
  MailBody
} from './smtp.mail.mjs';

import {
  SmtpWelcomeCommand,
  SmtpEhloCommand,
  SmtpAuthCommand,
  SmtpDataCommand,
  SmtpFromCommand,
  SmtpRecipientCommand
} from './smtp.command.mjs';

import {
  SmtpClientSideException
} from "./smtp.exception.mjs";

import {
  connect
} from "node:tls";

/**
 * Connects to an smtp server and allows to send mails.
 * It will always use a secure connection to the server.
 */
class SmtpConnection {

  /**
   * Creates a new instance.
   *
   * @param {string} host
   *   the server's hostname.
   * @param {string} port
   *   the port which should be used.
   */
  constructor(host, port) {

    this.host = host;
    this.port = port;

    this.command = null;
    this.client = null;

    this.responseBuffer = '';
  }

  /**
   * Connects to the server by using the given credentials.
   *
   * @param {string} username
   *   the username
   * @param {string} password
   *   the user's password
   */
  async connect(username, password) {

    await new Promise((resolve, reject) => {

      this.client = connect(
        { host : this.host, port : this.port },
        () => { resolve(); });

      this.client.on('data', (data) => {
        this.responseBuffer += data.toString();
        this.handleResponse();
      });

      this.client.on('error', (err) => {

        if (this.command) {
          this.command.onClientError(err.message);
          return;
        }

        reject(new SmtpClientSideException(err.message));
        this.client.end();
      });

      this.client.on('end', () => {

        if (this.command) {
          this.command.onClientError('Connection ended unexpectedly');
          return;
        }

        reject(new SmtpClientSideException('Connection ended unexpectedly'));
      });
    });

    await new Promise((resolve, reject) => {
      this.command = new SmtpWelcomeCommand();
      this.command.register(resolve, reject);
      this.handleResponse();
    });

    await this.sendNextCommand(new SmtpEhloCommand());

    await this.sendNextCommand(new SmtpAuthCommand(username, password));
  }

  /**
   * Called whenever the server is ready to receive the next smtp command.
   */
  async onNextCommand() {

    if (!this.command)
      return;

    if (!this.command.hasNextCommand()) {
      this.command = null;
      return;
    }

    await new Promise((resolve, reject) => {
      this.command.register(resolve, reject);
      this.client.write(this.command.getNextCommand() + '\r\n');
    });
  }

  /**
   * Executes the next command if possible.
   * @param {SmtpCommand} command
   *   the command to be executed.
   */
  async sendNextCommand(command) {
    this.command = command;

    while (command.hasNextCommand()) {
      await this.onNextCommand();
    }

    this.command = null;
  }

  /**
   * Called whenever data is ready to be processed.
   */
  handleResponse() {

    if (!this.command)
      return;

    if (this.responseBuffer === "")
      return;

    const lines = this.responseBuffer.split('\r\n');

    for (let idx = 0; idx < lines.length - 1; idx++) {
      const match = lines[idx].match(/^(\d{3})([\s-])/);
      if (!match) {
        this.client.end();
        if (this.command)
          this.command.onClientError('Invalid server response format');

        return;
      }

      if (match[2] !== ' ') {
        continue;
      }

      const response = lines.slice(0, idx + 1).join('\r\n');
      this.responseBuffer = lines.slice(idx + 1).join('\r\n');

      this.command.onResponse(
        parseInt(response.substr(0, 3), 10),
        response.substr(4));
      return;
    }
  }

  /**
   * Sends and rfc conform mail.
   *
   * @param {string} data
   *   the actual mail to be send.
   * @param {string} from
   *   the from which is used for the smtp envelope.
   * @param {string} recipient
   *   the to which is used for the smtp envelope.
   */
  async send(data, from, recipient) {
    if (!this.client)
      throw new Error('Connection not established. Call connect() first.');

    if (!from)
      throw new Error('No From specified.');

    if (!recipient)
      throw new Error('No Recipient specified.');

    if (data instanceof MailBody)
      data = await data.getRaw();

    await this.sendNextCommand( new SmtpFromCommand(from));
    await this.sendNextCommand( new SmtpRecipientCommand(recipient));
    await this.sendNextCommand( new SmtpDataCommand(data));
  }

  /**
   * Closes the connection to the server.
   */
  close() {
    if (this.client === null)
      return;

    this.client.end();
    this.client = null;
  }
}

export {
  SmtpConnection
};
