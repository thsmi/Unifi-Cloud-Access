
const IS_LARGER = 1;
const IS_SMALLER = -1;

const KEY = 0;

const HEX_STRING = 16;
const HEX_PADDING = 2;

const SHORT_DATE = "YYYYMMDD";

/**
 * An abstract base class for sorted key value pairs.
 */
class SortedMap {

  /**
   * Creates a new instance.
   */
  constructor() {
    this.entries = new Map();
  }

  /**
   * Adds a key value pair.
   * @param {string} key
   *   the key to be added.
   * @param {string} value
   *   the value to be added.
   */
  setEntry(key, value) {
    this.entries.set(key, value);
  }

  /**
   * Gets all keys in alphabetical order.
   * @returns {string[]}
   *   a sorted list containing all keys.
   */
  getKeys() {
    return [...this.entries.keys()].sort();
  }

  /**
   * Compares two entires.
   *
   * @param {string} entryA
   *   the first entry
   * @param {string} entryB
   *   the second entry
   * @returns {int}
   *   1 if a is large than b, -1 if b is lager than a otherwise 0 if both are equal;
   */
  compare(entryA, entryB) {
    if (entryA[KEY] > entryB[KEY])
      return IS_LARGER;
    if (entryA[KEY] < entryB[KEY])
      return IS_SMALLER;

    return 0;
  }

  /**
   * Flattens the sorted map it joins each pair with the given pair
   * separator and then joins all entries with the entry separator.
   *
   * @param {string} entrySeparator
   *   the separator used to joins entries
   * @param {string} pairSeparator
   *   the separator used to join  pairs.
   * @returns {string}
   *   the joined and flattened map.
   */
  join(entrySeparator, pairSeparator) {

    let entries = [...this.entries.entries()];
    entries.sort((a, b) => { return this.compare(a, b); });

    entries = entries.map((pair) => {
      return pair.join(pairSeparator);
    });

    return entries.join(entrySeparator);
  }
}

/**
 * A sorted map implementation of query string pairs.
 */
class SortedQueryStrings extends SortedMap {

  /**
   * Creates a new instance
   *
   * @param {Map<string,string>|string[]} entries
   *   a map or an array containing the query string key/value pairs.
   */
  constructor(entries) {
    super();

    if (entries instanceof Map)
      entries = [...entries.entries()];

    for (const [key, value] of entries)
      this.setEntry(key, value);
  }

  /**
   * Add a pair of query parameters.
   * It will automatically url encode key and value.
   *
   * @param {string} key
   *   the key to be added.
   * @param {string} value
   *   the value to be added
   */
  setEntry(key, value) {
    super.setEntry(
      encodeURIComponent(key),
      encodeURIComponent(value));
  }
}

/**
 * A sorted map implementation of header pairs.
 */
class SortedHeaders extends SortedMap {

  /**
   * Creates a new instance
   *
   * @param {Map<string,string>|string[]} entries
   *   a map or an array containing the header key/value pairs.
   */
  constructor(entries) {
    super();

    if (entries instanceof Map)
      entries = [...entries.entries()];

    for (const [key, value] of entries)
      this.setEntry(key, value);
  }

  /**
   * Add a header and value pair.
   * The header will be converted to lowercase
   * and the value will be trimmed for whitespace.
   *
   * @param {string} key
   *   the header to be added
   * @param {string} value
   *   the header value
   */
  setEntry(key, value) {
    super.setEntry(key.toLowerCase(), value.trim());
  }
}

/**
 * And abstract base class for canonical request authentication.
 */
class AwsCanonicalAuthentication {

  /**
   * Creates a new Canonical Header Authentication.
   * @param {string} host
   *   the host name.
   * @param {string} accessKeyId
   *   the secret access key id.
   * @param {string} region
   *   the region.
   * @param {string} service
   *   the service name.
   */
  constructor(host, accessKeyId, region, service) {
    this.host = host;
    this.keyId = accessKeyId;
    this.region = region;
    this.service = service;

    this.date = new Date();
    this.path = "/";
    this.securityToken = null;
  }

  /**
   * Gets the the host name.
   *
   * @returns {string}
   *   the hosts unique name
   */
  getHost() {
    return this.host;
  }

  /**
   * Sets the request's path.
   * @param {string} path
   *   the path to be set, needs to start with a "/"
   * @returns {AwsCanonicalBaseRequest}
   *   a self reference
   */
  setPath(path) {
    this.path = path;
    return this;
  }

  /**
   * Gets the request's path.
   *
   * @returns {string}
   *   the path as string
   */
  getPath() {
    return this.path;
  }

  /**
   * The request's date. If not set it will use the object creation date.
   *
   * @param {Date} date
   *   the date to be set.
   */
  setDate(date) {
    this.date = date;
  }

  /**
   * Returns the request's date in ISO Format.
   * @returns {string}
   *   the date in ISO Format
   */
  getIsoDate() {
    return this.date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  /**
   * Returns the request's date in a short format
   * It is the ISO Format truncated to the first 8 characters.
   *
   * @returns {string}
   *   the short date.
   */
  getShortDate() {
    return this.getIsoDate().substring(0, SHORT_DATE.length);
  }

  /**
   * Return the region.
   *
   * @returns {string}
   *   the region.
   */
  getRegion() {
    return this.region;
  }

  /**
   * Return the service.
   *
   * @returns {string}
   *   the service.
   */
  getService() {
    return this.service;
  }

  /**
   * Get the credential string which is made of the accessKeyId and a the scope.
   *
   * @returns {string}
   *   the credential string.
   */
  getCredentials() {
    return `${this.keyId}/${this.getScope()}`;
  }

  /**
   * Scope is the date,region and service joined together.
   *
   * @returns {string}
   *   the scope string.
   */
  getScope() {
    return `${this.getShortDate()}/${this.getRegion()}/${this.getService()}/aws4_request`;
  }

  /**
   * Sets teh security token.
   * The security token is optional and used to harden requests.
   *
   * @param {string} securityToken
   *   the new security token value.
   */
  setSecurityToken(securityToken) {
    this.securityToken = securityToken;
  }

  /**
   * Returns the security token.
   *
   * @returns {string|null}
   *   the optional security token or null if not set.
   */
  getSecurityToken() {
    return this.securityToken;
  }

  /**
   * Returns a reference to the webcrypto api.
   * Browsers and Node provide the webcrypto interface via different api calls.
   *
   * We first check if we have a window object which could be used.
   * If not we assume we are on node and try to import the crypto module.
   *
   * @returns {Crypto}
   *   the crypto object
   */
  async getCrypto() {
    if ((typeof(window) !== "undefined") && (window !== null))
      return window.crypto;

    return (await import('node:crypto')).webcrypto;
  }

  /**
   * Uses Web Crypto API to create a SHA256 HMAC hex string.
   *
   * @param {string|byte[]} key
   *   the key used toe encrypt the data.
   *
   * @param {string|byte[]} data
   *   the data which gets encrypted.
   *
   * @returns {byte[]}
   *   the encrypted data as byte array.
   */
  async hmac(key, data) {

    if ((typeof key === 'string') || (key instanceof String))
      key = (new TextEncoder()).encode(key);

    if ((typeof data === 'string') || (data instanceof String))
      data = (new TextEncoder()).encode(data);

    const crypto = await this.getCrypto();

    key = await crypto.subtle.importKey(
      'raw', key,
      { name: 'HMAC', hash: 'SHA-256'},
      true,
      ['sign', 'verify']
    );

    return await crypto.subtle.sign('HMAC', key, data);
  }

  /**
   * Calculates a SHA-256 hash from the given data
   * @param {string|byte[]} data
   *   the data to be hashed
   * @returns {byte[]}
   *   the sha hash as byte array.
   */
  async hash(data) {

    if ((typeof data === 'string') || (data instanceof String))
      data = (new TextEncoder()).encode(data);

    const crypto = await this.getCrypto();
    return await crypto.subtle.digest("SHA-256", data);
  }

  /**
   * Converts a byte array to a hex string.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
   *
   * @param {byte[]} data
   *   the data to be converted.
   * @returns {string}
   *   the hex string.
   */
  hex(data) {
    return Array.from(new Uint8Array(data))
      .map((b) => { return b.toString(HEX_STRING).padStart(HEX_PADDING, '0'); })
      .join('');
  }

  /**
   * Returns the list with headers and their values.
   * @abstract
   *
   * @returns {Map<string,string>}
   *   the headers.
   */
  getHeaders() {
    throw new Error("Implement me");
  }

  /**
   * Gets the headers sorted by name in alphabetical order.
   * @abstract
   *
   * @returns {Map<string,string>}
   *   the headers in alphabetical order.
   */
  getQuery() {
    throw new Error("Implement me");
  }

  /**
   * Returns the canonical query string.
   *
   * All key value pairs are url encode and sorted by the key name.
   *
   * @returns {string}
   *   the canonical query string.
   */
  getCanonicalQuery() {

    if (this.getQuery().size === 0)
      return "";

    return (new SortedQueryStrings(this.getQuery())).join("&", "=");
  }

  /**
   * Returns the canonical headers as string. The name and value is separated
   * by a colon while the header pairs are separated by line breaks.
   *
   * The headers are lowercase and sorted by their name.
   * All value are trimmed for whitespace.
   *
   * @returns {string}
   *   the canonical string.
   */
  getCanonicalHeaders() {
    return (new SortedHeaders(this.getHeaders())).join("\n", ":") + "\n";
  }

  /**
   * The singed headers a semicolon separated list.
   * Typically the same as the canonical headers.
   *
   * @returns {string}
   *   the string with the semicolons separated signed headers.
   */
  getSignedHeaders() {
    return (new SortedHeaders(this.getHeaders())).getKeys().join(";");
  }

  /**
   * Creates a new canonical request.
   *
   * It consists of the http method, the path, the canonical query,
   * the canonical headers, the signed headers and the hashed payload.
   *
   * @returns {string}
   *   the canonical request
   */
  async getCanonicalRequest() {
    return ""
      + "GET\n"
      + this.getPath() + "\n"
      + this.getCanonicalQuery() + "\n"
      + this.getCanonicalHeaders() + "\n"
      + this.getSignedHeaders() + "\n"
      + this.hex(await this.hash(""));
  }

  /**
   * Calculates the so called string to sign.
   * It contains the algorithm, the date, scope and the hashed payload.
   *
   * @returns {string}
   *   the string which needs to be signed.
   */
  async getStringToSign() {
    return ""
      + "AWS4-HMAC-SHA256\n"
      + this.getIsoDate() + "\n"
      + this.getScope() + "\n"
      + this.hex(await this.hash(await this.getCanonicalRequest()));
  }

  /**
   * Calculates the signature and signs it with the api key.
   *
   * @param {string} apiKey
   *   the api key used to sign.
   * @returns {string}
   *   the signature which protects all important request headers.
   */
  async getSignature(apiKey) {
    const dateKey = await this.hmac("AWS4" + apiKey, this.getShortDate());
    const regionKey = await this.hmac(dateKey, this.getRegion());
    const serviceKey = await this.hmac(regionKey, this.getService());
    const signingKey = await this.hmac(serviceKey, "aws4_request");

    return this.hex(await this.hmac(signingKey, await this.getStringToSign()));
  }
}

/**
 * Provides the authentication for a query string based aws authentication.
 * This is used used to authenticate the websocket connection for MQTT.
 */
class AwsCanonicalRequestAuthentication extends AwsCanonicalAuthentication{

  /**
   * @inheritdoc
   */
  getQuery() {
    const query = new Map();
    query.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    query.set("X-Amz-Credential", this.getCredentials());
    query.set("X-Amz-Date", this.getIsoDate());
    query.set("X-Amz-SignedHeaders", "host");

    return query;
  }

  /**
   * @inheritdoc
   */
  getHeaders() {
    const headers = new Map();
    headers.set("host", this.getHost());
    return headers;
  }

  /**
   * Calculates the canonical request url with the embedded aws authentication.
   *
   * @param {string} protocol
   *   the requests protocol, can he https or wss.
   * @param {string} apikey
   *   the api key which is used to sign the authentication.
   * @returns {string}
   *   the url with the embedded credentials, which can be used to authenticate against aws.
   */
  async getUrl(protocol, apikey) {
    let result = `${protocol}://${this.getHost()}${this.getPath()}`;

    result += "?" + (await this.getCanonicalQuery());
    result += "&X-Amz-Signature=" + (await this.getSignature(apikey));

    if (this.getSecurityToken())
      result += "&X-Amz-Security-Token=" + encodeURIComponent(this.getSecurityToken());

    return result;
  }

}

/**
 * Provides the authentication for a header based aws authentication
 * This is used to access the plain api.
 */
class AwsCanonicalHeaderAuthentication extends AwsCanonicalAuthentication {

  /**
   * @inheritdoc
   */
  constructor(host, accessKeyId, region, service) {
    super(host, accessKeyId, region, service);
    this.query = [];
  }

  /**
   * Sets the query string
   *
   * @param {string} query
   *   the request's query string.
   *
   * @returns {AwsCanonicalHeader}
   *   a self reference.
   */
  setQuery(query) {
    this.query = new Map(new URLSearchParams(query).entries());
    return this;
  }

  /**
   * @inheritdoc
   */
  getQuery() {
    return this.query;
  }

  /**
   * @inheritdoc
   */
  getHeaders() {
    const headers = new Map();
    headers.set("X-Amz-Date", this.getIsoDate());
    headers.set("host", this.getHost());

    // The security token is optional, and needs to be only set if present.
    if (this.getSecurityToken())
      headers.set("x-amz-security-token", this.getSecurityToken());

    return headers;
  }

  /**
   * Calculates the authentication headers's credentials.
   *
   * @param {string} apiKey
   *   the api key which is used to sign this authentication request.
   *
   * @returns {string}
   *   the value for that authentication header.
   */
  async getAuthorization(apiKey) {

    return ""
      + "AWS4-HMAC-SHA256"
      + ` Credential=${this.getCredentials()},`
      + ` SignedHeaders=${this.getSignedHeaders()},`
      + ` Signature=${await this.getSignature(apiKey)}`;
  }
}

export {
  AwsCanonicalRequestAuthentication,
  AwsCanonicalHeaderAuthentication
};
