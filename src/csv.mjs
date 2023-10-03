
const CHAR_SINGLE_QUOTE = 0x22;
const CHAR_DOUBLE_QUOTE = 0x27;

const FIRST_CHAR = 1;
const LAST_CHAR = -1;

/**
 * Represents a line of CSV file.
 */
class CSVDataSet {
  /**
   * Creates a new instance
   * @param {Map} headers
   *   a reference to the CSV File's headers
   * @param {string[]} data
   *   the data for this dataset.
   * @param {boolean} trim
   *   the true in case the data needs to be trimmed because it is quoted.
   */
  constructor(headers, data, trim) {
    this.headers = headers;
    this.data = data;
    this.trim = trim;
  }

  /**
   * Returns the data for the given header.
   * In case the header is unknown or the dataset does not contain any
   * data it will return the default value.
   *
   * @param {string} header
   *   the header for which data should be returned.
   * @param {string} [defaultValue]
   *   the default value to be returned in case the header is unknown or
   *   the data set has no value for the header.
   * @returns {string}
   *   the data for the given header as string.
   */
  getData(header, defaultValue) {
    const idx = this.headers.get(header.toLowerCase());

    if (idx === undefined)
      return defaultValue;

    if (this.trim)
      return this.data[idx].slice(FIRST_CHAR, LAST_CHAR);

    return this.data[idx];
  }
}

/**
 * Parses a CSV File.
 */
class CSVFile {

  /**
   * Creates a new instance.
   */
  constructor() {
    this.headers = new Map();
    this.data = [];
    this.trim = false;
  }

  /**
   * Tries to convert the given byte array into a string.
   *
   * It first decodes the string as UTF-8 in case it stumbles upon
   * invalid code points it interprets the string as Windows 1252.
   *
   * @param {ArrayBuffer} bytes
   *   the byte to be converted.
   * @returns {string}
   *   the converted string.
   */
  decode(bytes) {
    try {
      return (new TextDecoder("utf-8", { fatal : true})).decode(bytes);
    } catch (ex) {
      if (!(ex instanceof TypeError))
        throw ex;
    }

    // Ok decoding as utf-8 failed we fallback to ASCII
    return (new TextDecoder("windows-1252", { fatal : true})).decode(bytes);
  }


  /**
   * Loads and parses the given csv file.
   *
   * @param {ArrayBuffer} bytes
   *   the CSV file to be parsed.
   * @returns {CSVFile}
   *   a self reference.
   */
  load(bytes) {

    this.headers = new Map();
    this.data = [];

    if (bytes[0] === CHAR_DOUBLE_QUOTE)
      this.trim = true;

    if (bytes[0] === CHAR_SINGLE_QUOTE)
      this.trim = true;

    const text = this.decode(bytes);

    // detect if the values in the csv are quoted.
    if (text[0] === '"' || text[0] === "'")
      this.trim = true;

    const lines = text.split("\r\n");

    // Handle the headers
    const headers = lines.shift().split(";");
    for (const idx in headers) {
      let header = headers[idx].toLowerCase();

      // In case we are a quoted we need to remove the first and last character.
      if (this.trim)
        header = header.slice(FIRST_CHAR, LAST_CHAR);

      this.headers.set(header, idx);
    }

    // Parse the data line by line.
    for (const line of lines) {
      const items = line.split(";");

      // Remove empty or incomplete lines.
      if (items.length < this.headers.size)
        continue;

      this.data.push(new CSVDataSet(this.headers, items, this.trim));
    }

    return this;
  }

  /**
   * Converts the CSV File's content into a unifi voucher compatible json format.
   *
   * Parses the given CSV file and interpolates the given
   * pattern with each dataset.
   *
   * @param {string} pattern
   *   the pattern which should be interpolated
   * @returns {object[]}
   *   the interpolated data in unifi voucher format.
   */
  toVouchers(pattern) {
    const regex = /\$\{(?<pattern>[^}]*)\}/gm;
    const data = [];

    for (const dataSet of this.data) {
      let partial = false;

      const note = pattern.replaceAll(regex, (match, group) => {

        const value = dataSet.getData(group, "");
        if (value === "")
          partial = true;

        return value;
      });

      data.push({
        note : note,
        partial : partial,
        code : null
      });
    }

    return data;
  }

}

export { CSVFile };
