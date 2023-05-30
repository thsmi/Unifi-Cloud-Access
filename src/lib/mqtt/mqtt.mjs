// https://github.com/mqttjs/mqtt-connection
// https://github.com/mqttjs/mqtt-packet
// http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html

const MSG_CONNECT = 0x10;
const MSG_CONNECT_ACK = 0x20;
const MSG_PUBLISH = 0x30;
const MSG_PUBLISH_ACK = 0x40;
const MSG_SUBSCRIBE = 0x80;
const MSG_SUBSCRIBE_ACK = 0x90;
const MSG_UNSUBSCRIBE = 0xA0;
const MSG_UNSUBSCRIBE_ACK = 0xB0;

const MSG_LENGTH_CONNECT_ACK = 2;
const MSG_LENGTH_SUBSCRIBE_ACK = 3;
const MSG_LENGTH_PUBLISH_ACK = 2;
const MSG_LENGTH_UNSUBSCRIBE_ACK = 2;

const GRANTED = 0x01;

const ONE_BYTE = 1;

const HIGH_BIT = 0x80;
const HIGH_BYTE = 0xFF00;
const LOW_BYTE = 0x00FF;

const MAX_MESSAGE_ID = 0xFFFF;

const MQTT_WEBSOCKET_PROTOCOL = "mqttv3.1";
const MQTT_VERSION = 0x04;

/**
 * A basic read buffer implementation
 */
class MqttBuffer {

  /**
   * Creates a new instance.
   *
   * @param {byte[]} buffer
   *   the initial buffer content as byte array if omitted it
   *   will start with am empty buffer.
   */
  constructor(buffer) {
    if ((typeof (buffer) === "undefined") || (buffer === null))
      buffer = [];

    this.bytes = buffer;
  }

  /**
   * Returns the buffer's current capacity in bytes
   *
   * @returns {int}
   *   the size in bytes
   */
  getSize() {
    return this.bytes.length;
  }

  /**
   * Checks if the buffer has the given amount of bytes.
   *
   * @param {int} [length]
   *   the length in bytes if omitted it falls back to one
   * @returns {int}
   *   the buffer size in bytes.
   */
  hasBytes(length) {
    if ((typeof(length) === "undefined") || (length === null))
      length = ONE_BYTE;

    return (this.bytes.length >= length);
  }

  /**
   * Peeks into the buffer and returns the byte at the given position without extracting it.
   * In case the byte does not exist, it will not fail or block, instead it returns null.
   *
   * @param {int} [idx]
   *   the optional position, if omitted it will fallback to zero
   * @returns {byte | null}
   *   returns the byte at the given position or null incase it does not exist.
   */
  peekByte(idx) {
    if ((typeof idx === "undefined") || (idx === null))
      idx = 0;

    if (this.bytes.length === 0)
      return null;

    if (idx >= this.bytes.length)
      return null;

    return this.bytes[idx];
  }

  /**
   * Extracts the given amount of bytes from the buffer.
   * It will block asynchronously until the full length is read.
   *
   * @param {int} length
   *   the number of bytes to be extracted.
   * @returns {byte[]}
   *   the extracted data as byte array.
   */
  async extractBytes(length) {
    return this.bytes.splice(0, length);
  }

  /**
   * Extracts the given amount of bytes from the buffer and
   * converts them into a string.
   *
   * It will block asynchronously until the full length is read.
   *
   * @param {int} length
   *   the number of byte to be extracted
   * @returns {string}
   *   the extracted data as string.
   */
  async extractString(length) {
    return new TextDecoder().decode(
      new Uint8Array(await this.extractBytes(length)));
  }

  /**
   * Extracts a single byte from the buffer.
   *
   * It will block asynchronously until the byte is read.
   *
   * @returns {byte}
   *   the byte to be extracted.
   */
  async extractByte() {
    return (await this.extractBytes(ONE_BYTE))[0];
  }

  /**
   * Extracts a complete MQTT message from the buffer.
   *
   * It will block asynchronously until the full message is read.
   *
   * @returns {object}
   *   the mqtt message as dictionary.
   */
  async extractMessage() {
    const result = {};

    const header = await this.extractByte();
    result.header = header & 0xF0;
    result.flags = header & 0x0F;

    result.length = await this.extractByte();

    if (result.length > 0x7F)
      result.length = (result.length & 0x7F) + (await this.extractByte() * 128);

    result.payload = await this.extractBuffer(result.length);

    return result;
  }

  /**
   * Extracts a string with length prefix from the buffer.
   *
   * It will block asynchronously until the string is read.
   *
   * @returns {string}
   *   the string
   */
  async extractPrefixedString() {
    const bytes = await this.extractBytes(2);
    const length = (bytes[0] * 0xFF) + bytes[1];

    return await this.extractString(length);
  }

  /**
   * Extracts the given amount of bytes and returns it as a buffer.
   * It will block asynchronously until the full length is read.
   *
   * @param {int} length
   *   length in bytes.
   * @returns {MqttBuffer}
   *   the buffer containing the extracted data.
   */
  async extractBuffer(length) {
    return new MqttBuffer(await this.extractBytes(length));
  }

  /**
   * Extracts a message id from the buffer
   * It will block asynchronously until the message id is read.
   *
   * @returns {int}
   *   the message id as integer.
   */
  async extractMessageId() {
    const bytes = await this.extractBytes(2);
    return ((bytes[0] << 8) & HIGH_BYTE) + (bytes[1] & LOW_BYTE);
  }
}

/**
 * Provides an buffered mqtt message parser.
 *
 * The onMessage callback is used to signal whenever
 * a complete message was received and parsed.
 *
 * The onData method should be used to signal the buffer
 * whenever new data is available.
 */
class MqttInputBuffer extends MqttBuffer {

  /**
   * Creates a new instance.
   */
  constructor() {
    super();

    this.isLocked = false;

    this.onMessage = null;
    this.onNewData = null;
  }

  /**
   * Extracts the given amount of data from the buffer.
   * It will block in case the buffer is not sufficiently filled.
   *
   * @param {int} length
   *   the amount of bytes to be read
   * @returns {byte[]}
   *   the bytes which were read.
   */
  async extractBytes(length) {

    if (!this.hasBytes(length)) {
      await new Promise((resolve) => {

        const callback = () => {
          if (!this.hasBytes(length))
            return;

          this.onNewData = undefined;
          resolve();
        };

        this.onNewData = callback;
      });
    }

    return await super.extractBytes(length);
  }

  /**
   * Called to add data to the buffer.
   *
   * @param {byte[]} bytes
   *   the bytes to be added to the buffer.
   */
  onData(bytes) {

    this.bytes = [...this.bytes, ...bytes];

    if (this.onNewData) {
      this.onNewData();
      return;
    }

    this.pump();
  }

  /**
   * The message pump implementation.
   */
  async pump() {

    if (this.isLocked)
      return;

    if (!this.hasBytes())
      return;

    this.isLocked = true;
    try {
      const type = this.peekByte();

      switch (type) {
        case MSG_CONNECT_ACK:
          await this.onConnected();
          break;
        case MSG_SUBSCRIBE_ACK:
          await this.onSubscribed();
          break;
        case MSG_PUBLISH_ACK:
          await this.onPublished();
          break;
        case MSG_PUBLISH:
          await this.onPublish();
          break;
        case MSG_UNSUBSCRIBE_ACK:
          await this.onUnsubscribed();
          break;
        default:
          throw new Error("Invalid type " + type);
      }

    } finally {
      this.isLocked = false;
    }

    // Keep the message pump alive...
    if (this.hasBytes())
      setTimeout(() => { this.onData([]); }, 0);
  }

  /**
   * Called whenever a connect response needs to be processed.
   */
  async onConnected() {
    const msg = await this.extractMessage();

    if (msg.header !== MSG_CONNECT_ACK)
      throw new Error(`Invalid Package type`);

    if (msg.length !== MSG_LENGTH_CONNECT_ACK)
      throw new Error(`Invalid ConnAck package length`);

    if (await msg.payload.extractByte() !== 0)
      throw new Error(`ConnAck package`);

    if (await msg.payload.extractByte() !== 0)
      throw new Error(`ConnAck response`);

    this.onMessage("#conAck");
  }

  /**
   * Called whenever a subscribe response needs to be processed.
   */
  async onSubscribed() {

    const msg = await this.extractMessage();

    if (msg.header !== MSG_SUBSCRIBE_ACK)
      throw new Error(`Subscribe Ack expected but got ${msg.header}`);

    // Length check
    if (msg.length !== MSG_LENGTH_SUBSCRIBE_ACK)
      throw new Error(`Invalid SubAck package length`);

    const id = await msg.payload.extractMessageId();

    if (await msg.payload.extractByte() !== GRANTED)
      throw new Error(`Subscribe not granted`);

    this.onMessage(`#${id}`, id);
  }

  /**
   * Called whenever a publish response needs to pe processed.
   */
  async onPublish() {

    const msg = await this.extractMessage();

    if (msg.header !== MSG_PUBLISH)
      throw new Error(`Publish Ack expected but got ${msg.header}`);

    const topic = await msg.payload.extractPrefixedString();
    const message = await msg.payload.extractString(msg.payload.getSize());

    this.onMessage("@" + topic, {
      "topic": topic,
      "message": message
    });
  }

  /**
   * Called whenever a publish acknowledgment response needs to be processed.
   */
  async onPublished() {

    const msg = await this.extractMessage();
    if (msg.header !== MSG_PUBLISH_ACK)
      throw new Error(`Publish Ack expected but got ${msg.header}`);

    // Length check
    if (msg.length !== MSG_LENGTH_PUBLISH_ACK)
      throw new Error(`Expected length to by two bytes but got ${msg.length}`);

    const id = await msg.payload.extractMessageId();

    if (msg.payload.getSize() !== 0)
      throw new Error(`Could not parse all payload data`);

    this.onMessage(`#${id}`);
  }

  /**
   * Called whenever an unsubscribe acknowledgement response need to be processed.
   */
  async onUnsubscribed() {
    const msg = await this.extractMessage();
    if (msg.header !== MSG_UNSUBSCRIBE_ACK)
      throw new Error(`Unsubscribe Ack expected but got ${msg.header}`);

    // Length check
    if (msg.length !== MSG_LENGTH_UNSUBSCRIBE_ACK)
      throw new Error(`Expected length to by two bytes but got ${msg.length}`);

    const id = await msg.payload.extractMessageId();

    if (msg.payload.getSize() !== 0)
      throw new Error(`Could not parse all payload data`);

    this.onMessage(`#${id}`);
  }
}

class MqttOutput {

  constructor(socket) {
    this.socket = socket;
  }

  /**
   * Converts an integer into a 7bit variable length representation
   *
   * @param {int} length
   *   the integer to be converted.
   * @returns {byte[]}
   *   the byte array containing the length can.
   */
  calcLength(length) {
    const bytes = [length % 128];

    if (length <= 128)
      return bytes;

    // We need to set the highest bit to mark
    // the length spans multiple bytes
    bytes[0] += HIGH_BIT;
    length = length >> 7;
    bytes.push(length);

    return bytes;
  }

  /**
   * Converts to a length prefixed array.
   * The length prefix is 2 bytes.
   *
   * @param {string} payload
   *   the payload
   * @returns {byte[]}
   *   the string as byte array.
   */
  stringToBytes(payload) {
    const data = (new TextEncoder()).encode(payload);
    return [0, data.length, ...data];
  }

  stringToBytes2(payload) {
    return [...(new TextEncoder()).encode(payload)];
  }

  /**
   * Converts the given integer into two bytes.
   *
   * @param {int} id
   *   the id to be converted.
   * @returns {byte[]}
   *   the two bytes.
   */
  idToBytes(id) {
    return [(id >> 8) & 0xFF, id & 0xFF];
  }

  async sendConnect(clientId) {
    const payload = [];
    payload.push(...this.stringToBytes(clientId));
    payload.push(...this.stringToBytes('?SDK=NodeJSv2&Version=1.15.5'));

    const bytes = [];
    // Control Field
    bytes.push(MSG_CONNECT);
    // Remaining Length
    bytes.push(...this.calcLength(10 + payload.length));
    // Protocol name
    bytes.push(...this.stringToBytes("MQTT"));
    // Version
    bytes.push(MQTT_VERSION);
    // Connection flag
    bytes.push(130);
    // Disable keep alive messages.
    bytes.push(0x00, 0x00);

    bytes.push(...payload);

    this.socket.send(new Uint8Array(bytes));
  }

  /**
   * Sends a subscribe message with the given message id and topic.
   * @param {int} id
   *   the message id used to track the response
   * @param {string} topic
   *   the topic which should be subscribed.
   */
  async sendSubscribe(id, topic) {
    const payload = [];

    payload.push(...this.idToBytes(id));
    payload.push(...this.stringToBytes(topic));
    // Subscribe options
    payload.push(0x01);

    const bytes = [];
    bytes.push(MSG_SUBSCRIBE + 0x02);

    // length
    bytes.push(...this.calcLength(payload.length));
    bytes.push(...payload);

    this.socket.send(new Uint8Array(bytes));
  }

  /**
   * Sends a publish message with the given id, topic and data.
   *
   * @param {string} id
   *   the message id used to track the response.
   * @param {string} topic
   *   the topic for which data should be published.
   * @param {string} data
   *   the data to be published.
   */
  sendPublish(id, topic, data) {

    const payload = [];
    payload.push(...this.stringToBytes(topic));
    payload.push(...this.idToBytes(id));
    payload.push(...this.stringToBytes2(data));

    const bytes = [];
    bytes.push(MSG_PUBLISH + 0x02);
    bytes.push(...this.calcLength(payload.length));
    bytes.push(...payload);

    this.socket.send(new Uint8Array(bytes));
  }

  /**
   * Sends an unsubscribe message for the given topic.
   * @param {int} id
   *   the numeric message id
   * @param {string} topic
   *   the topic to be unsubscribed.
   */
  sendUnsubscribe(id, topic) {

    const payload = [];
    payload.push(...this.idToBytes(id));
    payload.push(...this.stringToBytes(topic));

    const bytes = [];
    bytes.push(MSG_UNSUBSCRIBE + 0x02);
    bytes.push(...this.calcLength(payload.length));
    bytes.push(...payload);

    this.socket.send(new Uint8Array(bytes));
  }
}

/**
 * Implements a MQTT socket.
 */
class MqttSocket {

  /**
   * Creates a new instance.
   */
  constructor() {
    // FIXME should be math random.
    this.messageId = 49301;
    this.clientId = "mqttjs_" + Math.random().toString(16).substr(2, 8);

    this.listeners = new Map();
  }

  /**
   * Called byte input buffer to signal it received a mqtt message.
   *
   * @param {string} type
   *   the message type
   * @param {object} message
   *   the message's payload.
   */
  onMessage(type, message) {
    if (!this.listeners.has(type)) {
      console.log("Received unsolicited message " + type);
      return;
    }

    this.listeners.get(type)(message);
  }

  /**
   * Connects to the mqtt server via a websocket.
   *
   * @param {string} url
   *   the server's url.
   */
  async connect(url) {
    this.socket = new WebSocket(url, MQTT_WEBSOCKET_PROTOCOL);

    this.input = new MqttInputBuffer();
    this.input.onMessage = (type, data) => {
      this.onMessage(type, data);
    };

    this.output = new MqttOutput(this.socket);

    this.socket.onmessage = async (ev) => {
      this.input.onData(new Uint8Array(await ev.data.arrayBuffer()));
    };

    await new Promise((resolve) => {
      this.socket.onopen = () => { resolve(); };
    });

    await new Promise((resolve) => {
      this.listeners.set("#conAck", () => { resolve(); });
      this.output.sendConnect(this.clientId);
    });
  }

  /**
   * Increments the message id counter and returns the current value.
   * @returns {int}
   *   the current message id as integer.
   */
  nextMessageId() {
    this.messageId++;

    if (this.messageId > MAX_MESSAGE_ID)
      this.messageId = 0;

    return this.messageId;
  }

  /**
   * Waits for the given message id to be received.
   *
   * @param {int} id
   *   the message id for which a response is expected.
   */
  async waitForMessage(id) {
    return new Promise((resolve) => {
      this.listeners.set("#" + id, () => {
        resolve();
      });
    });
  }

  /**
   * Subscribes to the given topic.
   *
   * @param {string} topic
   *   the topic name to be subscribed to.
   * @param {Function} callback
   *   the callback to be invoked whenever a message is received.
   */
  async subscribe(topic, callback) {

    if (this.listeners.has(`@${topic}`))
      throw new Error(`Topic ${topic} already subscribed...`);

    const id = this.nextMessageId();

    // Configure the topic listener
    this.listeners.set(`@${topic}`, callback);

    // Request the subscribe...
    this.output.sendSubscribe(id, topic);
    // ... and wait for the response.
    await this.waitForMessage(id);
  }

  /**
   * Unsubscribes the given topic.
   *
   * @param {string} topic
   *   the topic to be unsubscribed from.
   */
  async unsubscribe(topic) {
    if (!this.listeners.has(`@${topic}`))
      return;

    const id = this.nextMessageId();

    this.output.sendUnsubscribe(id, topic);
    await this.waitForMessage(id);

    this.listeners.delete(`@${topic}`);
  }

  /**
   * Publishes a new message on a topic.
   *
   * @param {string} topic
   *   the topic name.
   * @param {string} data
   *   the data to be send as string
   */
  async publish(topic, data) {
    const id = this.nextMessageId();

    this.output.sendPublish(id, topic, data);
    await this.waitForMessage(id);
  }
}

export { MqttSocket };
