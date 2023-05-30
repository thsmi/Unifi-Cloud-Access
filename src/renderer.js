import { Unifi } from "./lib/unifi/unifi.cloud.mjs";

const SECONDS_PER_MINUTE = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_SECONDS = 1000;

const INPUT_COOL_DOWN = 500;

/* global bootstrap */

/**
 * Creates a simplistic progress dialog.
 * It has a static backdrop, can't be canceled and consumes any events.
 */
class ProgressDialog {

  /**
   * Creates a new Progress Dialog instance.
   */
  constructor() {
    this.id = "#unifi-progress";
  }

  /**
   * Shows the progress dialog.
   *
   * @returns {ProgressDialog}
   *   a self reference.
   */
  async show() {
    document.querySelector(`${this.id}-status`).style.width = `0%`;
    document.querySelector(`${this.id}-text`).textContent = "";

    return new Promise((resolve) => {
      const elm = document.querySelector(this.id);
      elm.addEventListener(
        "shown.bs.modal", () => { resolve(this); }, {once : true});
      bootstrap.Modal.getOrCreateInstance(elm).show();
    });
  }

  /**
   * Hides the progress dialog.
   *
   * @returns {ProgressDialog}
   *   a self reference.
   */
  async hide() {
    return new Promise((resolve) => {
      const elm = document.querySelector(this.id);
      elm.addEventListener(
        "hidden.bs.modal", () => { resolve(this); }, {once : true});
      bootstrap.Modal.getOrCreateInstance(elm).hide();
    });
  }

  /**
   * Updates the progress status.
   *
   * @param {int} progress
   *   the progress status in percent.
   * @param {string} text
   *   the progress message to be displayed.
   * @returns {ProgressDialog}
   *   a self reference.
   */
  update(progress, text) {
    document.querySelector(`${this.id}-status`).style.width = `${progress}%`;
    document.querySelector(`${this.id}-text`).textContent = text;
    return this;
  }
}

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
    this.unifi = device;
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
    const minutes = duration % SECONDS_PER_MINUTE;
    duration = Math.floor(duration / SECONDS_PER_MINUTE);
    const hours = duration % HOURS_PER_DAY;
    duration = Math.floor(duration / HOURS_PER_DAY);
    const days = duration;

    let result = "";
    if (days > 0)
      result += " " + days + "d";

    if (hours > 0)
      result += " " + hours + "h";

    if (minutes > 0)
      result += " " + minutes + "m";

    return result;
  }

  /**
   * Updates the batch revoke preview
   */
  async searchVouchers() {

    const exp = new RegExp(document.getElementById("unifi-vouchers-pattern").value);

    const channel = await this.unifi.openApiChannel();
    let vouchers = [];

    try {
      vouchers = (await channel.getVouchers()).data;
    } finally {
      channel.close();
    }

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
        this.print([{
          "code": voucher.code,
          "duration": this.formatDuration(voucher.duration),
          "note" : voucher.note
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

    const channel = await this.unifi.openApiChannel();
    try {

      for (const elm of elms) {
        count++;
        progress.update((100 / elms.length) * count, elm.querySelector(".unifi-voucher-name").textContent);

        await channel.revokeVoucher(elm.querySelector(".unifi-voucher-id").textContent);
      }

    } finally {
      channel.close();
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

    const channel = await this.unifi.openApiChannel();
    try {
      await channel.revokeVoucher(id);
    } finally {
      channel.close();
    }

    await this.searchVouchers();
  }

  /**
   * Prints the voucher
   *
   * @param {object[]} vouchers
   *   the array of voucher object.
   */
  print(vouchers) {
    window.electron.print(vouchers);
  }

  /**
   * Creates a new voucher
   */
  async createVoucher() {

    const name = document.getElementById("unifi-create-voucher-name").value;

    const expiration = 1
      * parseInt(document.getElementById("unifi-create-voucher-expires").value, 10)
      * parseInt(document.getElementById("unifi-create-voucher-expires-unit").value, 10);

    const devices = parseInt(document.getElementById("unifi-create-voucher-devices").value, 10);
    const quantity = parseInt(document.getElementById("unifi-create-voucher-quantity").value, 10);

    const data = [];

    const channel = await this.unifi.openApiChannel();
    try {
      const vouchers = await channel.createVoucher(
        name, expiration, devices, quantity);

      for (const voucher of vouchers) {
        data.push({
          code : voucher.code,
          duration : this.formatDuration(voucher.duration),
          note : voucher.note
        });
      }
    } finally {
      channel.close();
    }

    this.print(data);

    await this.searchVouchers();
  }

  async filter(data) {
    let vouchers;

    const channel = await this.unifi.openApiChannel();
    try {
      vouchers = await await channel.getVouchers();
    } finally {
      channel.close();
    }

    const cache = new Map();

    for (const voucher of vouchers.data)
      cache.set(voucher.note, voucher.code);

    return data.filter((item) => { return !cache.has(item); });
  }

  /**
   * Called whenever the preview should be updated
   */
  async onBatchCreatePreview() {
    document.getElementById("unifi-import-preview-plane").classList.add("d-none");

    document.getElementById("unifi-create-vouchers-info").classList.add("d-none");

    const file = document.getElementById("unifi-import-file").files[0];

    const parent = document.getElementById("unifi-imports");
    while (parent.firstChild)
      parent.firstChild.remove();

    if ((typeof (file) === "undefined") || (file === null)) {
      console.log("No file to import specified.");
      return;
    }

    let data = (await (file.text())).split("\r\n");
    const headers = data.shift().split(";");

    data = data.map((item) => {
      return item.split(";");
    });

    // Remove empty lines...
    data = data.filter((item) => {
      return (item.length >= headers.length);
    });

    const pattern = document.getElementById("unifi-import-pattern").value;



    data = data.map((item) => {

      let result = pattern;

      headers.forEach((header, idx) => {
        result = result.replace("${" + header.toLowerCase() + "}", item[idx]);
      });

      return result;
    });

    data = await this.filter(data);

    for (const item of data) {
      const elm = document.createElement("li");
      elm.textContent = item;
      elm.classList.add("list-group-item");

      document.getElementById("unifi-imports").appendChild(elm);
    }

    if (!data.length) {
      document.getElementById("unifi-import-create").disabled = true;
      document.getElementById("unifi-create-vouchers-info").classList.remove("d-none");
      return;
    }

    document.getElementById("unifi-import-create").disabled = false;
    document.getElementById("unifi-import-preview-plane").classList.remove("d-none");
  }

  async onBatchCreate() {

    const elms = [...document.querySelectorAll("#unifi-imports > li")];

    if (elms.length === 0)
      return;

    const progress = await (new ProgressDialog()).show();

    let count = 0;

    const expiration = 1
      * parseInt(document.getElementById("unifi-import-expires").value, 10)
      * parseInt(document.getElementById("unifi-import-expires-unit").value, 10);

    const devices = parseInt(document.getElementById("unifi-import-devices").value, 10);

    const channel = await this.unifi.openApiChannel();
    try {
      for (const elm of elms) {
        count++;
        progress.update((100 / elms.length) * count, elm.textContent);

        await channel.createVoucher(elm.textContent, expiration, devices);
      }
    } finally {
      channel.close();
    }

    document.getElementById("unifi-import-preview-plane").classList.add("d-none");
    document.getElementById("unifi-import-create").disabled = true;

    const parent = document.getElementById("unifi-imports");
    while (parent.firstChild)
      parent.firstChild.remove();

    document.getElementById("unifi-create-vouchers-info").classList.add("d-none");

    await this.searchVouchers();

    await progress.hide();
  }

  onSearchPatternChange() {
    if (this.searchPatternTimer)
      clearTimeout(this.searchPatternTimer);

    this.searchPatternTimer = setTimeout(async () => { await this.searchVouchers(); }, INPUT_COOL_DOWN);
  }

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
        code : voucher.querySelector(".unifi-voucher-code").textContent,
        duration : voucher.querySelector(".unifi-voucher-duration-date").textContent,
        note : voucher.querySelector(".unifi-voucher-name").textContent
      });
    }

    this.print(data);
  }

  /**
   * Exports all vouchers currently visible in the search.
   */
  async exportVouchers() {
    const vouchers = [...document.querySelectorAll("#unifi-vouchers-items > li")];

    const data = [];
    data.push(["id", "code", "duration", "note", "expired", "active", "devices", "multiuse", "expires"]);

    for (const voucher of vouchers) {
      data.push([
        voucher.querySelector(".unifi-voucher-id").textContent.trim(),
        voucher.querySelector(".unifi-voucher-code").textContent.trim(),
        voucher.querySelector(".unifi-voucher-duration-date").textContent.trim(),
        voucher.querySelector(".unifi-voucher-name").textContent.trim(),
        voucher.querySelector(".unifi-voucher-expired.d-none") === undefined,
        voucher.querySelector(".unifi-voucher-active.d-none") === undefined,
        voucher.querySelector(".unifi-voucher-devices").textContent.trim(),
        voucher.querySelector(".unifi-voucher-multiuse.d-none") === undefined,
        voucher.querySelector(".unifi-voucher-expires-date").textContent.trim()
      ]);
    }

    for (const idx in data)
      data[idx] = data[idx].join(";");

    window.electron.save(data.join("\r\n"));
  }

  /**
   * Entry point which initializes the UI.
   * @returns {Vouchers}
   *   a self reference
   */
  async init() {
    document.getElementById("unifi-import-file").addEventListener("change", () => { this.onBatchCreatePreview(); });

    document.getElementById("unifi-import-create").addEventListener("click", () => { this.onBatchCreate(); });
    document.getElementById("unifi-import-pattern").addEventListener("input", () => { this.onImportChange(); });

    document.getElementById("unifi-voucher-create").addEventListener("click", () => { this.createVoucher(); });
    document.getElementById("unifi-vouchers-revoke").addEventListener("click", () => { this.revokeVouchers(); });
    document.getElementById("unifi-vouchers-print").addEventListener("click", () => { this.printVouchers(); });
    document.getElementById("unifi-vouchers-export").addEventListener("click", () => { this.exportVouchers(); });

    document.getElementById("unifi-vouchers-pattern").addEventListener("input", () => { this.onSearchPatternChange(); });
    document.getElementById("unifi-vouchers-only-active").addEventListener("change", () => { this.searchVouchers(); });
    document.getElementById("unifi-vouchers-only-expired").addEventListener("change", () => { this.searchVouchers(); });
    document.getElementById("unifi-vouchers-only-unused").addEventListener("change", () => { this.searchVouchers(); });
    document.getElementById("unifi-vouchers-search").addEventListener("click", () => { this.searchVouchers(); });

    await this.searchVouchers();

    return this;
  }
}

/**
 * A login dialog implementation
 */
class LoginDialog {

  /**
   * Waits for the given event to occur.
   *
   * @param {string} selector
   *   the selector which identifies the element.
   * @param {string} eventName
   *   the event name to which should be listened.
   */
  async waitForEvent(selector, eventName) {
    const elm = document.querySelector(selector);

    await new Promise((resolve) => {
      elm.addEventListener(
        eventName,
        () => { resolve(); }, {once: true});
    });
  }

  /**
   * Shows the dialog and waits until the animation completed.
   */
  async show() {
    this.showCredentials();

    bootstrap.Modal.getOrCreateInstance("#unifi-login-dialog", { keyboard: false }).show();
    await this.waitForEvent("#unifi-login-dialog", "shown.bs.modal");
  }

  /**
   * Shows the progress page
   */
  showProgress() {
    document.getElementById("unifi-login-device").classList.add("d-none");
    document.getElementById("unifi-login-credentials").classList.add("d-none");
    document.getElementById("unifi-loading").classList.remove("d-none");
  }

  /**
   * Shows the credentials page
   */
  showCredentials() {
    document.getElementById("unifi-login-device").classList.add("d-none");
    document.getElementById("unifi-loading").classList.add("d-none");
    document.getElementById("unifi-login-credentials").classList.remove("d-none");
  }

  /**
   * Shows the device page
   */
  showDevice() {
    document.getElementById("unifi-login-credentials").classList.add("d-none");
    document.getElementById("unifi-loading").classList.add("d-none");
    document.getElementById("unifi-login-device").classList.remove("d-none");
  }

  /**
   * Prompts the user for credentials
   *
   * @returns {object}
   *   object containing the username and password.
   */
  async getCredentials() {

    this.showCredentials();

    await this.waitForEvent("#unifi-login-credentials-next", "click");

    this.showProgress();

    return {
      user : document.getElementById("unifi-login-credentials-user").value,
      password : document.getElementById("unifi-login-credentials-password").value };
  }

  /**
   * Prompts the user for the device he wants to connect to
   *
   * @param {UnifiDevice[]} devices
   *   the list of possible devices.
   * @returns {UnifiDevice}
   *   the selected device
   */
  async getDevice(devices) {

    for (const device in devices) {
      const elm = document.getElementById("unifi-login-device-template").content.cloneNode(true);

      // Make the id a bit more readable
      let id = devices[device].getDeviceId().split(":");
      id[0] = id[0].match(/.{1,10}/g).join("-");
      id = id.join(":");

      elm.querySelector(".form-check-label").textContent = id;
      elm.querySelector(".form-check-label").htmlFor = "unifi-login-device-" + device;

      elm.querySelector(".form-check-input").id = "unifi-login-device-" + device;
      elm.querySelector(".form-check-input").value = device;

      document.getElementById("unifi-login-devices").appendChild(elm);
    }

    document.querySelectorAll('#unifi-login-devices input[name="unifi-login-device"]')[0].checked = true;

    this.showDevice();

    await this.waitForEvent("#unifi-login-device-next", "click");

    this.showProgress();

    const idx = document.querySelector('#unifi-login-devices input[name="unifi-login-device"]:checked').value;
    return devices[idx];
  }

  /**
   * Hides the dialog and waits until it faded out.
   */
  async hide() {
    bootstrap.Modal.getOrCreateInstance("#unifi-login-dialog", { keyboard: false }).hide();
    await this.waitForEvent("#unifi-login-dialog", "hidden.bs.modal");
  }
}

(async () => {
  const login = new LoginDialog();
  await login.show();

  const credentials = await login.getCredentials();

  const unifi = new Unifi();
  await unifi.login(
    credentials.user,
    credentials.password);

  const devices = await unifi.getDevices();

  let device;
  if (devices.length > 1)
    device = await login.getDevice(devices);
  else
    device = devices[0];

  await device.connect();
  await ((new Vouchers(device)).init());

  await login.hide();
})();


