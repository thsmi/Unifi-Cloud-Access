const MAX_LINE_BASE64 = 77;
const ALPHA_NUMERICAL = 36;

/**
 * Represents an email message body.
 */
class MailBody {

  /**
   * Creates an instance of MailBody.
   **/
  constructor() {
    this.from = null;
    this.to = null;
    this.replyTo = null;

    this.subject = '';
    this.body = '';
    this.attachments = [];
    this.boundary = Math.random().toString(ALPHA_NUMERICAL).substring(2, 12);
  }

  /**
   * Sets the recipient email address.
   *
   * @param {string} to
   *   the recipient's email address.
   */
  setTo(to) {
    this.to = to;
  }

  /**
   * Sets the senders email address.
   * @param {string} from
   *   the sender's email address.
   */
  setFrom(from) {
    this.from = from;
  }

  /**
   * Sets the reply to address.
   * @param {string} replyTo
   *   the replyTo address.
   */
  setReplyTo(replyTo) {
    this.replyTo = replyTo;
  }

  /**
   * Sets the email subject.
   *
   * @param {string} subject
   *   the subject.
   */
  setSubject(subject) {
    this.subject = subject;
  }

  /**
   * Sets the email body text.
   *
   * @param {string} body
   *   the email body text.
   */
  setBody(body) {
    this.body = body;
  }

  /**
   * Adds an attachment to the email message.
   *
   * @param {string} filename
   *   the file name to be displayed in the mail.
   *
   * @param {Uint8Array} attachment
   *   the attachment as byte array.
   */
  addAttachment(filename, attachment) {
    this.attachments.push({ name: filename, data: attachment } );
  }

  /**
   * Uses a node specific implementation to converts data to a base64 string
   *
   * @param {string|Buffer|Uint8Array} data
   *   the data to be converted to base64.
   * @returns {string}
   *   the base64 string containing the data.
   */
  async convertToBase64Node(data) {
    return Buffer.from(data).toString('base64');
  }

  /**
   * Uses a browser specific implementation to convert data to a base64 string.
   *
   * @param {string|Uint8Array} data
   *   the data to be converted to base64.
   * @returns {string}
   *   the base64 string containing the data.
   */
  async convertToBase64Browser(data) {
    if (typeof data === 'string')
      data = (new TextEncoder()).encode(data);

    // use a FileReader to generate a base64 data URI:
    const base64url = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { resolve(reader.result); };
      reader.readAsDataURL(new Blob([data]));
    });

    // remove the `data:...;base64,` part from the start
    return base64url.slice(base64url.indexOf(',') + 1);
  }

  /**
   * Converts a string or buffer into a base64 string.
   *
   * @param {string|ArrayBufferView} data
   *   the data to be converted.
   * @returns {string}
   *   the base64 string containing the data.
   */
  async convertToBase64(data) {

    if (typeof Buffer === 'undefined')
      data = await this.convertToBase64Browser(data);
    else
      data = await this.convertToBase64Node(data);

    // Lines in a mail are limited thus we need to ensure
    // we are well below the maximal line length limit.
    let result = '';
    for (let i = 0; i < data.length; i += MAX_LINE_BASE64)
      result += data.slice(i, i + MAX_LINE_BASE64) + '\r\n';

    return result;
  }

  /**
   * Generates the raw email message.
   *
   * @returns {string}
   *   the raw email message.
   */
  async getRaw() {

    let message = "";

    if (this.from)
      message += `From: ${this.from}\r\n`;
    if (this.to)
      message += `To: ${this.to}\r\n`;
    if (this.replyTo)
      message += `Reply-To: ${this.replyTo}\r\n`;

    message += `Subject: ${this.subject}\r\n`;
    message += `Date: ${new Date().toUTCString()}\r\n`;

    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/mixed; boundary="Boundary-${this.boundary}"\r\n\r\n`;

    message += ""
      + `--Boundary-${this.boundary}\r\n`
      + `MIME-Version: 1.0\r\n`
      + `Content-Type: text/plain; charset="UTF-8"\r\n`
      + `Content-Transfer-Encoding: base64\r\n\r\n`
      + `${await this.convertToBase64(this.body)}\r\n`;

    for (const attachment of this.attachments) {

      message += ""
        + `--Boundary-${this.boundary}\r\n`
        + `Content-Type: application/pdf\r\n`
        + `MIME-Version: 1.0\r\n`
        + `Content-Disposition: attachment; filename="${attachment.name}"\r\n`
        + `Content-Transfer-Encoding: base64\r\n\r\n`
        + `${await this.convertToBase64(attachment.data)}\r\n`;
    }

    message += `--Boundary-${this.boundary}--\r\n`;

    return message;
  }
}

export { MailBody };
