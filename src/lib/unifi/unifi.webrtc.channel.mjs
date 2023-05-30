
/* global CompressionStream */
/* global DecompressionStream */

const UNLIMITED_DEVICES = 0;
const ONE_DAY = 1440;

const DEFAULT_QUOTA = UNLIMITED_DEVICES;
const DEFAULT_EXPIRATION = ONE_DAY;
const DEFAULT_COUNT = 1;

const HTTP_SUCCESS = 200;

const HEADER_LENGTH = 8;

const HEADER_COMPRESSION = 2;
const COMPRESSED = 1;

const HEADER_FORMAT = 1;

const FORMAT_JSON = 1;
const FORMAT_STRING = 2;
const FORMAT_BINARY = 3;

const HEADER_TYPE = 0;
const TYPE_HEADER = 1;
const TYPE_BODY = 2;


class UnifiRequest {

  /**
   * Creates a new instance.
   * @param {string} method
   *   the method either GET or POST
   * @param {string} path
   *   the path on the server which processes this request.
   */
  constructor(method, path) {
    this.id = window.crypto.randomUUID();

    this.method = method;

    if (!path.startsWith("/"))
      throw new Error(`Invalid path ${path}, does not start with /`);
    this.path = path;
  }

  /**
   * Returns the Request's unique UUID.
   *
   * @returns {string}
   *   the uuid as string.
   */
  getId() {
    return this.id;
  }

  /**
   * Gets the HTTP method of this request.
   * Typically either GET or POST.
   *
   * @returns {string}
   *   the HTTP Method.
   */
  getMethod() {
    return this.method;
  }

  /**
   * Gets the path on the server which should be called by this request.
   *
   * @returns {string}
   *   the path as string
   */
  getPath() {
    return this.path;
  }

  /**
   * Returns the request's payload.
   * @abstract
   *
   * @returns {Uint8Array}
   *   the payload as byte array.
   */
  getPayload() {
    throw new Error("Override getPayload()");
  }

  /**
   * Calculates the payload length.
   * @returns {int}
   *   the payload length as integer.
   */
  getPayloadLength() {
    return this.getPayload().byteLength;
  }

  /**
   * Compresses the data by using the deflate algorithm.
   * @private
   *
   * @param {byte[]} data
   *   the data which should be compressed.
   * @returns {byte[]}
   *   the compressed data.
   */
  async compress(data) {
    const stream = new Response(data).body
      .pipeThrough(new CompressionStream('deflate'));
    return new Response(stream).arrayBuffer();
  }

  /**
   *
   * @param {*} type
   * @param {*} format
   * @param {*} compress
   * @param {*} payload
   * @returns
   */
  async getMessage(type, format, compress, payload) {

    const header = [type, format, compress, 0];

    if (format === FORMAT_JSON)
      payload = JSON.stringify(payload);

    if (format === FORMAT_JSON || format === FORMAT_STRING)
      payload = (new TextEncoder()).encode(payload);

    if (compress === COMPRESSED)
      payload = await this.compress(new Uint8Array(payload));

    payload = new Uint8Array(payload);

    const length = [
      ((payload.byteLength >> 3 * 8) & 0xFF),
      ((payload.byteLength >> 2 * 8) & 0xFF),
      ((payload.byteLength >> 1 * 8) & 0xFF),
      (payload.byteLength & 0xFF)
    ];

    return [...header, ...length, ...payload];
  }

  /**
   * Constructs a header message.
   *
   * @returns {byte[]}
   *   the request header as byte array.
   */
  async getHeader() {

    const header = {
      "id": this.getId(),
      "type": "httpRequest",
      "method": this.getMethod(),
      "path": this.getPath(),
      "headers": {
        "content-length": this.getPayloadLength(),
        "content-type": "application/json; charset=utf-8"
      }
    };

    return await this.getMessage(TYPE_HEADER, FORMAT_JSON, COMPRESSED, header);
  }

  /**
   * Constructs a body message.
   *
   * @returns {byte[]}
   *   the request body as byte array.
   */
  async getBody() {
    return await this.getMessage(TYPE_BODY, FORMAT_BINARY, COMPRESSED, this.getPayload());
  }

  /**
   * Gets the request data as byte array.
   *
   * @returns {Uint8Array}
   *   the request data as array.
   */
  async getRequest() {
    return new Uint8Array([
      ...(await this.getHeader()),
      ...(await this.getBody())
    ]);
  }
}

class UnifiPostRequest extends UnifiRequest {

  /**
   * Creates a new instance.
   *
   * @param {string} path
   *   the path on the server which processes this request.
   * @param {byte[]} payload
   *   the payload as byte array.
   */
  constructor(path, payload) {
    super("POST", path);
    this.payload = new Uint8Array(payload);
  }

  /**
   * @inheritdoc
   */
  getPayload() {
    return this.payload;
  }
}

class UnifiGetRequest extends UnifiRequest {

  /**
   * Creates a new instance.
   * @param {string} path
   *   the path on the server which processes this request.
   */
  constructor(path) {
    super("GET", path);
  }

  /**
   * A get request does not have any payload.
   * Thus is returns always an empty array as payload.
   *
   * @returns {Unit8Array}
   *   always an empty array;
   */
  getPayload() {
    return new Uint8Array([]);
  }
}



class UnifiWebRtcChannel {

  /**
   * Creates a new data channel for sending api messages to the remote.
   *
   * @param {RTCPeerConnection} connection
   *   the connection to the remote device.
   */
  constructor(connection) {
    this.connection = connection;
    this.channel = null;
    this.buffer = [];
  }

  onData(data) {
    this.buffer = [...this.buffer, ...data];

    if (this.onNewData) {
      this.onNewData();
      return;
    }
  }

  /**
   * Called when the channel gets closed.
   */
  onClose() { }

  /**
   * Opens then data channel. It will throw in case the channel is already in use.
   *
   * @param {string} name
   *   the channel name, typically start with "api-" and then followed by a number.
   * @returns {UnifiWebRtcChannel}
   *   a self reference
   */
  async open(name) {
    if (this.channel)
      throw new Error("Channel already in use");

    this.channel = await this.connection.createDataChannel(name);
    this.channel.onmessage = (ev) => { this.onData(new Uint8Array(ev.data)); };
    this.channel.onclose = () => { this.onClose(); };

    return new Promise((resolve) => {
      this.channel.onopen = () => { resolve(this); };
    });
  }

  /**
   * Closes the data channel.
   */
  async close() {
    this.channel.onmessage = null;
    this.channel.onopen = null;
    this.channel.close();
    this.channel = null;
  }

  /**
   * Checks if the data channel's input buffer has the given amount of data available
   *
   * @param {int} [length]
   *   the number of bytes which should be available. Falls back to 1 if omitted.
   *
   * @returns {boolean}
   *   true if the buffer can provide the requested amount of data. Otherwise false.
   */
  hasBytes(length) {
    if ((typeof (length) === "undefined") || (length === null))
      length = 1;

    return (this.buffer.length >= length);
  }

  async waitForBuffer(length) {

    if (this.hasBytes(length))
      return;

    return new Promise((resolve) => {

      const callback = () => {
        if (!this.hasBytes(length))
          return;

        this.onNewData = undefined;
        resolve();
      };

      this.onNewData = callback;
    });
  }

  /**
   * Extract the given amount of bytes from the channels input buffer.
   * @param {int} length
   *   number of bytes to be extracted.
   * @returns {byte[]}
   *   a byte array containing the data returned input buffer.
   */
  async extractBytes(length) {
    await this.waitForBuffer(length);
    return this.buffer.splice(0, length);
  }



  /**
   * Decompressed the data by using the deflate algorithm.
   *
   * @param {byte[]} data
   *   the data which should be decompressed.
   * @returns {byte[]}
   *   the compressed data.
   */
  async decompress(data) {
    const stream = new Response(data).body
      .pipeThrough(new DecompressionStream('deflate'));
    return new Response(stream).arrayBuffer();
  }

  async extractMessage(type) {

    const header = await this.extractBytes(HEADER_LENGTH);

    if (header[HEADER_TYPE] !== type)
      throw new Error("Invalid message type");

    const length = 0
      + (header[4] << (3 * 8))
      + (header[5] << (2 * 8))
      + (header[6] << (1 * 8))
      + (header[7]);

    let payload = await this.extractBytes(length);

    if (header[HEADER_COMPRESSION] === COMPRESSED)
      payload = await this.decompress(payload);

    if (header[HEADER_FORMAT] === FORMAT_STRING || header[HEADER_FORMAT] === FORMAT_JSON)
      payload = (new TextDecoder()).decode(new Uint8Array(payload));

    if (header[HEADER_FORMAT] === FORMAT_JSON)
      payload = JSON.parse(payload);

    return payload;

  }

  /**
   * Extracts a header response.
   * It will block and wait until the complete request is received.
   *
   * @returns {object|string|byte[]}
   *   the received header data, typically json and thus an object.
   */
  async extractResponseHeaders() {
    return await this.extractMessage(TYPE_HEADER);
  }

  /**
   * Extracts a body response.
   * It will block and wait until the complete request is received.
   *
   * @returns {object|string|byte[]}
   *   the received body data, typically binary and thus a byte array.
   */
  async extractResponseBody() {
    return await this.extractMessage(TYPE_BODY);
  }

  /**
   * Extracts the response from the buffer.
   *
   * @param {string} id
   *   the message's id
   * @returns {object}
   *   the returned response object
   */
  async extractResponse(id) {
    const response = {
      header: await this.extractResponseHeaders(),
      body: await this.extractResponseBody()
    };

    if (response.header.id !== id)
      throw new Error(`Invalid response id expected ${id} but got ${response.header.id}`);

    if (response.header.statusCode !== HTTP_SUCCESS)
      throw new Error("Fetching failed " + response.header.statusMessage);

    return JSON.parse((new TextDecoder()).decode(new Uint8Array(response.body)));
  }

  /**
   * Sends a request to the device and returns the response.
   *
   * @param {UnifiRequest} request
   *   the unifi api request to be send to the server.
   * @returns 
   *
   */
  async send(request) {
    this.channel.send(await request.getRequest());
    return await this.extractResponse(request.getId());
  }

  /**
   * Request a list with all known vouchers.
   *
   * @returns {object}
   *   the response containing all known vouchers.
   */
  async getVouchers() {
    return await this.send(new UnifiGetRequest("/proxy/network/api/s/default/stat/voucher"));
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
    const message = JSON.stringify({
      "create_time": time
    });

    return await this.send(
      new UnifiPostRequest(
        "/proxy/network/api/s/default/stat/voucher",
        (new TextEncoder()).encode(message)));
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
    const message = JSON.stringify({
      "_id": id,
      "cmd": "delete-voucher"
    });

    return await this.send(
      new UnifiPostRequest(
        "/proxy/network/api/s/default/cmd/hotspot",
        (new TextEncoder()).encode(message)));
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

    const message = JSON.stringify({
      "cmd": "create-voucher",
      "n": count,
      "quota": quota,
      "expire": expire,
      "note": note
    });

    let data = await this.send(
      new UnifiPostRequest(
        "/proxy/network/api/s/default/cmd/hotspot",
        (new TextEncoder()).encode(message)));

    data = await this.getVoucher(data.data[0].create_time);

    return data.data;
  }

}

export { UnifiWebRtcChannel };
