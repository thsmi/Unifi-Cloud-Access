import { Settings } from "../settings.mjs";
import { ExportDialog } from "./dialogs/export.mjs";
import { ProgressDialog } from "./dialogs/progress.mjs";
import { CSVFile } from "./../csv.mjs";

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_SECONDS = 1000;
const DAYS_PER_YEAR = 365;

const INPUT_COOL_DOWN = 500;

const DECIMAL = 10;

const NUMBER = 1;

/**
 * Controller for Voucher UI.
 */
class Vouchers {

  /**
   * Creates a new instance
   *
   * @param {UnifiDevice} device
   *   an unifi device instance.
   */
  constructor(device) {
    this.device = device;
  }

  /**
   * Converts a duration into days, hours and minutes.
   *
   * @param {int} duration
   *   the duration to be converted
   * @returns {string}
   *   the duration in days hours an minutes format.
   */
  formatDuration(duration) {

    const minutes = duration % MINUTES_PER_HOUR;
    duration = Math.floor(duration / MINUTES_PER_HOUR);
    const hours = duration % HOURS_PER_DAY;
    duration = Math.floor(duration / HOURS_PER_DAY);
    const days = duration % DAYS_PER_YEAR;
    duration = Math.floor(duration / DAYS_PER_YEAR);
    const years = duration;

    let result = "";

    if (years > 0)
      result += " " + years + " y";

    if (days > 0)
      result += " " + days + "d";

    if (hours > 0)
      result += " " + hours + "h";

    if (minutes > 0)
      result += " " + minutes + "m";

    return result;
  }

  /**
   * Retrieves a list of all known vouchers from the unifi controller.
   *
   * @param {string} [prefix]
   *   if specified it will return only vouchers with a name starting with this prefix.
   * @returns {object}
   *   an array containing the vouchers
   */
  async getVouchers(prefix) {

    const vouchers = (await this.device.getVouchers()).data;

    if (!prefix)
      return vouchers;

    return vouchers.filter((item) => { return item.note.startsWith(prefix); });
  }

  /**
   * Updates the batch revoke preview
   */
  async searchVouchers() {

    const exp = new RegExp(document.getElementById("unifi-vouchers-pattern").value, "i");

    const vouchers = await this.getVouchers();

    document.getElementById("unifi-vouchers-results").classList.add("d-none");

    const parent = document.getElementById("unifi-vouchers-items");
    while (parent.firstChild)
      parent.firstChild.remove();

    vouchers.sort((a, b) => { return a.note.localeCompare(b.note); });

    for (const voucher of vouchers) {

      if (!voucher.note.match(exp))
        continue;

      const elm = document.getElementById("unifi-template-voucher").content.cloneNode(true);

      let keep = false;

      if (this.isActive(voucher)) {
        elm.querySelector(".unifi-voucher-active").classList.remove("d-none");

        if (document.getElementById("unifi-vouchers-only-active").checked)
          keep = true;
      }

      if (voucher.end_time) {
        const expires = new Date(voucher.end_time * MILLISECONDS_PER_SECONDS).toISOString();
        elm.querySelector(".unifi-voucher-expires").classList.remove("d-none");
        elm.querySelector(".unifi-voucher-expires-date").textContent = expires.substring(0, 10) + " " + expires.substring(11, 16);
      } else {
        elm.querySelector(".unifi-voucher-duration").classList.remove("d-none");
        elm.querySelector(".unifi-voucher-duration-date").textContent = this.formatDuration(voucher.duration);
      }

      if (this.isExpired(voucher)) {
        elm.querySelector(".unifi-voucher-expired").classList.remove("d-none");

        if (document.getElementById("unifi-vouchers-only-expired").checked)
          keep = true;
      }

      if (this.isUnused(voucher))
        if (document.getElementById("unifi-vouchers-only-unused").checked)
          keep = true;

      if (!keep)
        continue;

      if ((voucher.status === "USED_MULTIPLE") || (voucher.status === "VALID_MULTI"))
        elm.querySelector(".unifi-voucher-multiuse").classList.remove("d-none");

      elm.querySelector(".unifi-voucher-devices").textContent = voucher.used;

      elm.querySelector(".unifi-voucher-name").textContent = voucher.note;
      elm.querySelector(".unifi-voucher-code").textContent = voucher.code;
      elm.querySelector(".unifi-voucher-id").textContent = voucher._id;

      elm.querySelector(".unifi-voucher-revoke").addEventListener("click", () => {
        this.revokeVoucher(voucher._id);
      });
      elm.querySelector(".unifi-voucher-print").addEventListener("click", () => {
        window.electron.print([{
          "code": voucher.code,
          "duration": this.formatDuration(voucher.duration),
          "note": voucher.note
        }]);
      });

      elm.firstElementChild.id = "unifi-voucher-" + voucher._id;

      parent.appendChild(elm);
    }

    if (document.querySelectorAll("#unifi-vouchers-items > li").length === 0) {
      this.disableVoucherControls();
      document.getElementById("unifi-vouchers-results").classList.add("d-none");
      // document.getElementById("unifi-create-vouchers-info").classList.remove("d-none");
      return;
    }

    this.enableVoucherControls();
    document.getElementById("unifi-vouchers-results").classList.remove("d-none");
  }

  /**
   * Disabled all voucher related controls.
   */
  disableVoucherControls() {
    document.getElementById("unifi-vouchers-revoke").disabled = true;
    document.getElementById("unifi-vouchers-print").disabled = true;
    document.getElementById("unifi-vouchers-export").disabled = true;
  }

  /**
   * Enables all voucher related controls.
   */
  enableVoucherControls() {
    document.getElementById("unifi-vouchers-revoke").disabled = false;
    document.getElementById("unifi-vouchers-print").disabled = false;
    document.getElementById("unifi-vouchers-export").disabled = false;
  }

  /**
   * Checks it the voucher is active.
   *
   * @param {object} voucher
   *   the voucher to be tested.
   *
   * @returns {boolean}
   *   true in case the voucher is active otherwise false.
   */
  isActive(voucher) {
    return (voucher.start_time ? true : false);
  }

  /**
   * Checks if the voucher is expired.
   *
   * @param {object} voucher
   *   the voucher to be tested.
   *
   * @returns {boolean}
   *   true in case the voucher is expired otherwise false.
   */
  isExpired(voucher) {
    return (new Date() > new Date(voucher.end_time * MILLISECONDS_PER_SECONDS)) ? true : false;
  }

  /**
   * Checks if the voucher is unused, means neither expired not active.
   *
   * @param {object} voucher
   *   the voucher to be tested.
   *
   * @returns {boolean}
   *   true in case the voucher is unused otherwise false.
   */
  isUnused(voucher) {
    return !this.isActive(voucher);
  }

  /**
   * Revokes the previewed items.
   */
  async revokeVouchers() {

    const elms = [...document.querySelectorAll("#unifi-vouchers-items > li")];

    if (elms.length === 0)
      return;

    const progress = await (new ProgressDialog()).show();
    let count = 0;

    for (const elm of elms) {
      count++;
      progress.update(elms.length, count, elm.querySelector(".unifi-voucher-name").textContent);

      await this.device.revokeVoucher(elm.querySelector(".unifi-voucher-id").textContent);
    }

    document.getElementById("unifi-vouchers-results").classList.add("d-none");
    this.disableVoucherControls();

    const parent = document.getElementById("unifi-vouchers-items");
    while (parent.firstChild)
      parent.firstChild.remove();

    await this.searchVouchers();

    await progress.hide();
  }

  /**
   * Revokes the given voucher.
   *
   * @param {string} id
   *   the message id to be revoked.
   */
  async revokeVoucher(id) {

    const elm = document.getElementById("unifi-voucher-" + id);
    elm.parentNode.removeChild(elm);

    await this.device.revokeVoucher(id);

    await this.searchVouchers();
  }

  /**
   * Creates a new voucher
   */
  async createVoucher() {

    const name = document.getElementById("unifi-create-voucher-name").value;

    const expiration = NUMBER
      * parseInt(document.getElementById("unifi-create-voucher-expires").value, DECIMAL)
      * parseInt(document.getElementById("unifi-create-voucher-expires-unit").value, DECIMAL);

    const devices = parseInt(document.getElementById("unifi-create-voucher-devices").value, DECIMAL);
    const quantity = parseInt(document.getElementById("unifi-create-voucher-quantity").value, DECIMAL);

    const data = [];

    const vouchers = await this.device.createVoucher(
      name, expiration, devices, quantity);

    for (const voucher of vouchers) {
      data.push({
        code: voucher.code,
        duration: this.formatDuration(voucher.duration),
        note: voucher.note
      });
    }

    window.electron.print(data);

    await this.searchVouchers();
  }

  /**
   * Calculates which vouchers are new.
   * It compares the given list of items with the ones existing on the
   * unifi and returns all items new to the unifi.
   *
   * @param {object[]} data
   *   the list which items to be checked if they are new or not.
   * @returns {object[]}
   *   the list of voucher which are new.
   */
  async calculateNewVouchers(data) {
    const vouchers = await this.getVouchers();

    const cache = new Map();
    for (const voucher of vouchers)
      cache.set(voucher.note.toLowerCase(), voucher.code);

    return data.filter((item) => { return !cache.has(item.note.toLowerCase()); });
  }

  /**
   * Calculates which vouchers have been deleted.
   *
   * It download the current set of vouchers and then compares
   * them against the given list of items.
   *
   * If an item exists on the unifi but not in the given list
   * of items, then it will be considered as deleted.
   *
   * @param {string} prefix
   *   the prefix to which the analysis should be limited.
   * @param {object[]} items
   *   the items which are imported.
   * @returns {object[]}
   *   a list of vouchers which should be revoked
   */
  async calculateDeletedVouchers(prefix, items) {
    const vouchers = await this.getVouchers(prefix);

    const cache = new Map();
    for (const voucher of vouchers)
      cache.set(voucher.note.toLowerCase(), {
        "id": voucher._id,
        "name": voucher.note
      });

    for (const item of items)
      cache.delete(item.note.toLowerCase());

    return cache.values();
  }

  /**
   * Called whenever the preview should be updated
   */
  async onBatchCreatePreview() {

    document.getElementById("unifi-create-vouchers-info").classList.add("d-none");
    document.getElementById("unifi-import-preview-plane").classList.add("d-none");

    const file = document.getElementById("unifi-import-file").files[0];

    const parent = document.getElementById("unifi-imports");
    while (parent.firstChild)
      parent.firstChild.remove();

    if ((typeof (file) === "undefined") || (file === null)) {
      return;
    }

    const prefix = document.getElementById("unifi-import-vouchers-prefix").value;
    const pattern = document.getElementById("unifi-import-vouchers-pattern").value;

    const data = (new CSVFile())
      .load(await file.arrayBuffer())
      .toVouchers(`${prefix} - ${pattern}`);

    for (const item of await this.calculateNewVouchers(data)) {
      const elm = document.getElementById("unifi-import-item-template").content.cloneNode(true);

      elm.querySelector(".unifi-import-item-text").textContent = item.note;
      elm.querySelector(".unifi-import-item-add").classList.remove("d-none");
      elm.querySelector(".unifi-import-item-add-btn").classList.remove("d-none");

      elm.querySelector(".unifi-import-item-add-btn").addEventListener("click", async () => {

        const expiration = NUMBER
          * parseInt(document.getElementById("unifi-import-expires").value, DECIMAL)
          * parseInt(document.getElementById("unifi-import-expires-unit").value, DECIMAL);

        const devices = parseInt(document.getElementById("unifi-import-devices").value, DECIMAL);

        await this.device.createVoucher(item.note, expiration, devices);

        this.onBatchCreatePreview();
      });

      if (item.partial)
        elm.querySelector(".unifi-import-item-active").checked = false;

      document.getElementById("unifi-imports").appendChild(elm);
    }


    const strategy = document.getElementById("unifi-import-vouchers-strategy").value;

    if (strategy === "mirror") {
      for (const item of await this.calculateDeletedVouchers(prefix, data)) {
        const elm = document.getElementById("unifi-import-item-template").content.cloneNode(true);

        elm.querySelector(".unifi-voucher-id").textContent = item.id;
        elm.querySelector(".unifi-import-item-text").textContent = item.name;
        elm.querySelector(".unifi-import-item-remove").classList.remove("d-none");
        elm.querySelector(".unifi-import-item-remove-btn").classList.remove("d-none");

        elm.querySelector(".unifi-import-item-remove-btn").addEventListener("click", async () => {
          await this.device.revokeVoucher(item.id);

          this.onBatchCreatePreview();
        });

        document.getElementById("unifi-imports").appendChild(elm);
      }
    }

    // Sort the elements...
    let elms = [...document.querySelectorAll("#unifi-imports > li")];

    elms = elms.sort((a, b) => {
      return a.querySelector(".unifi-import-item-text").textContent.trim().localeCompare(
        b.querySelector(".unifi-import-item-text").textContent.trim());
    });

    elms.forEach((elm) => {
      document.getElementById("unifi-imports").appendChild(elm);
    });

    if (!elms.length) {
      document.getElementById("unifi-import-create").disabled = true;
      document.getElementById("unifi-create-vouchers-info").classList.remove("d-none");
      return;
    }

    document.getElementById("unifi-import-create").disabled = false;
    document.getElementById("unifi-import-preview-plane").classList.remove("d-none");
  }

  /**
   * Creates all the active items shown in the import preview.
   */
  async onBatchCreate() {

    let elms = [...document.querySelectorAll("#unifi-imports > li")];

    elms = elms.filter((elm) => {
      return elm.querySelector(".unifi-import-item-active").checked === true;
    });

    if (elms.length === 0)
      return;

    const progress = await (new ProgressDialog()).show();

    let count = 0;

    const expiration = NUMBER
      * parseInt(document.getElementById("unifi-import-expires").value, DECIMAL)
      * parseInt(document.getElementById("unifi-import-expires-unit").value, DECIMAL);

    const devices = parseInt(document.getElementById("unifi-import-devices").value, DECIMAL);


    for (const elm of elms) {
      count++;
      const name = elm.querySelector(".unifi-import-item-text").textContent;

      if (elm.querySelector(".unifi-import-item-add").classList.contains("d-none") === false) {
        progress.update(elms.length, count, `Adding ${name}`);
        await this.device.createVoucher(name, expiration, devices);
      }

      if (elm.querySelector(".unifi-import-item-remove").classList.contains("d-none") === false) {
        progress.update(elms.length, count, `Revoking ${name}`);
        await this.device.revokeVoucher(elm.querySelector(".unifi-voucher-id").textContent);
      }

      elm.remove();
    }

    document.getElementById("unifi-create-vouchers-info").classList.add("d-none");

    await this.searchVouchers();

    await progress.hide();
  }

  /**
   * Called whenever a search dialog is updated.
   * It will trigger a delayed update as soon as search changes cool down.
   */
  onSearchPatternChange() {
    if (this.searchPatternTimer)
      clearTimeout(this.searchPatternTimer);

    this.searchPatternTimer = setTimeout(async () => { await this.searchVouchers(); }, INPUT_COOL_DOWN);
  }

  /**
   * Called whenever the import dialog is changes.
   * It will trigger a delayed update as soon as changes to the import dialog cooled down.
   */
  onImportChange() {
    if (this.importPatterTimer)
      clearTimeout(this.importPatterTimer);

    this.importPatterTimer = setTimeout(async () => { await this.onBatchCreatePreview(); }, INPUT_COOL_DOWN);
  }

  /**
   * Prints all vouchers currently visible in the search.
   */
  async printVouchers() {
    const vouchers = [...document.querySelectorAll("#unifi-vouchers-items > li")];

    const data = [];

    for (const voucher of vouchers) {
      data.push({
        code: voucher.querySelector(".unifi-voucher-code").textContent,
        duration: voucher.querySelector(".unifi-voucher-duration-date").textContent,
        note: voucher.querySelector(".unifi-voucher-name").textContent
      });
    }

    window.electron.print(data);
  }

  /**
   * Activates all items in the batch import.
   */
  batchSelectAll() {
    const elms = [...document.querySelectorAll("#unifi-imports .unifi-import-item-active")];

    for (const elm of elms) {
      elm.checked = true;
    }
  }

  /**
   * Deactivates all items in the batch import.
   **/
  batchSelectNone() {
    const elms = [...document.querySelectorAll("#unifi-imports .unifi-import-item-active")];

    for (const elm of elms) {
      elm.checked = false;
    }
  }

  /**
   * Shows the export dialog.
   */
  async showExportDialog() {
    await (new ExportDialog(this)).show();
  }

  /**
   * Returns the currently visible vouchers.
   *
   * @returns {object[]}
   *   a list with all visible vouchers.
   */
  getSelectedVouchers() {
    const vouchers = [];

    for (const voucher of [...document.querySelectorAll("#unifi-vouchers-items > li")]) {

      vouchers.push({
        id: voucher.querySelector(".unifi-voucher-id").textContent.trim(),
        code: voucher.querySelector(".unifi-voucher-code").textContent.trim(),
        duration: voucher.querySelector(".unifi-voucher-duration-date").textContent.trim(),
        note: voucher.querySelector(".unifi-voucher-name").textContent.trim(),
        expired: voucher.querySelector(".unifi-voucher-expired.d-none") === undefined,
        active: voucher.querySelector(".unifi-voucher-active.d-none") === undefined,
        devices: voucher.querySelector(".unifi-voucher-devices").textContent.trim(),
        multiuse: voucher.querySelector(".unifi-voucher-multiuse.d-none") === undefined,
        expires: voucher.querySelector(".unifi-voucher-expires-date").textContent.trim()
      });
    }

    return vouchers;
  }

  /**
   * Entry point which initializes the UI.
   * @returns {Vouchers}
   *   a self reference
   */
  async init() {

    document.querySelector('a[data-bs-target="#unifi-vouchers-pane"]').addEventListener("show.bs.tab", () => {
      this.searchVouchers();
    });

    document.querySelector('a[data-bs-target="#unifi-create-vouchers-pane"]').addEventListener("show.bs.tab", () => {
      this.onBatchCreatePreview();
    });

    document
      .getElementById("unifi-import-file")
      .addEventListener("change", () => { this.onBatchCreatePreview(); });
    document
      .getElementById("unifi-import-vouchers-prefix")
      .addEventListener("input", () => { this.onImportChange(); });
    document
      .getElementById("unifi-import-vouchers-pattern")
      .addEventListener("input", () => { this.onImportChange(); });
    document
      .getElementById("unifi-import-vouchers-strategy")
      .addEventListener("change", () => { this.onImportChange(); });

    document.getElementById("unifi-import-create").addEventListener("click", () => { this.onBatchCreate(); });
    document.getElementById("unifi-import-select-all").addEventListener("click", () => { this.batchSelectAll(); });
    document.getElementById("unifi-import-select-none").addEventListener("click", () => { this.batchSelectNone(); });


    document.getElementById("unifi-voucher-create").addEventListener("click", () => { this.createVoucher(); });
    document.getElementById("unifi-vouchers-revoke").addEventListener("click", () => { this.revokeVouchers(); });
    document.getElementById("unifi-vouchers-print").addEventListener("click", () => { this.printVouchers(); });
    document
      .getElementById("unifi-vouchers-export")
      .addEventListener("click", () => { this.showExportDialog(); });

    document.getElementById("unifi-vouchers-pattern").addEventListener("input", () => { this.onSearchPatternChange(); });
    document.getElementById("unifi-vouchers-only-active").addEventListener("change", () => { this.searchVouchers(); });
    document.getElementById("unifi-vouchers-only-expired").addEventListener("change", () => { this.searchVouchers(); });
    document.getElementById("unifi-vouchers-only-unused").addEventListener("change", () => { this.searchVouchers(); });
    document.getElementById("unifi-vouchers-search").addEventListener("click", () => { this.searchVouchers(); });

    const settings = new Settings();
    document
      .getElementById("unifi-voucher-settings-direct-forget")
      .addEventListener("click", () => { settings.removeDirectConnectionCredentials(); });

    const directCreds = await settings.getDirectConnectionCredentials();
    document
      .getElementById("unifi-voucher-settings-direct-user")
      .value = directCreds.user;
    document
      .getElementById("unifi-voucher-settings-direct-user")
      .value = directCreds.host;

    if (directCreds.password) {
      document
        .getElementById("unifi-voucher-settings-direct")
        .classList.remove("d-none");
    }


    document
      .getElementById("unifi-voucher-settings-cloud-forget")
      .addEventListener("click", () => { (new Settings()).removeCloudConnectionCredentials(); });

    const cloudCreds = await settings.getCloudConnectionCredentials();
    document
      .getElementById("unifi-voucher-settings-cloud-user")
      .value = cloudCreds.user;

    if (cloudCreds.password) {
      document
        .getElementById("unifi-voucher-settings-cloud")
        .classList.remove("d-none");
    }

    const mailSettings = await settings.getMailServer();
    document
      .getElementById("unifi-vouchers-mail-hostname")
      .value = mailSettings.host;

    document
      .getElementById("unifi-vouchers-mail-port")
      .value = mailSettings.port;

    document
      .getElementById("unifi-vouchers-mail-sender")
      .value = mailSettings.sender;

    const mailCreds = await settings.getMailCredentials();
    if (mailCreds.password) {
      document
        .getElementById("unifi-voucher-mail-forget")
        .classList.remove("d-none");
    }

    await this.searchVouchers();

    return this;
  }
}

export { Vouchers };
