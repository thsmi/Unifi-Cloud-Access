/* global bootstrap */

import { MailBody } from "../../lib/smtp/smtp.mail.mjs";
import { Settings } from "./../../settings.mjs";

const HUNDRED_PERCENT = 100;
const MAIL_COOL_DOWN = 7000;

/**
 * Shows an export dialog which allows exporting the currently visible
 * vouchers as CSV, PDF or Mail.
 */
class ExportDialog {

  /**
   * Creates a new instance
   *
   * @param {Vouchers} vouchers
   *   the class maintaining the vouchers.
   */
  constructor(vouchers) {
    this.vouchers = vouchers;
  }

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
   * Shows the dialog prompting the user for the desired
   * export format.
   *
   * Mail will be only activated if a mail server is configured.
   *
   * @returns {string}
   *   either cvs, pdf or mail.
   */
  async getExportFormat() {
    document.getElementById("unifi-export-progress-dialog").classList.add("d-none");
    document.getElementById("unifi-export-mail-compose-dialog").classList.add("d-none");

    document.getElementById("unifi-export-format-dialog").classList.remove("d-none");
    document.getElementById("unifi-export-close").classList.remove("d-none");

    const server = await (new Settings()).getMailServer();
    if (!server || !server.host || !server.port || !server.sender) {
      document.getElementById("unifi-export-format-mail-warning").classList.remove("d-none");
      document.getElementById("unifi-export-format-mail").disabled = true;
    } else {
      document.getElementById("unifi-export-format-mail-warning").classList.add("d-none");
      document.getElementById("unifi-export-format-mail").disabled = false;
    }

    await this.waitForEvent("#unifi-export-format-next", "click");

    return document.querySelector('input[name="unifi-export-format"]:checked').value;
  }

  /**
   * Exports all currently visible vouchers as csv file.
   */
  async exportAsCvs() {
    const vouchers = this.vouchers.getSelectedVouchers();

    const data = [];
    data.push(["id", "code", "duration", "note", "expired", "active", "devices", "multiuse", "expires"]);

    for (const voucher of vouchers) {
      data.push([
        voucher.id, voucher.code, voucher.duration, voucher.note,
        voucher.expired, voucher.active, voucher.devices,
        voucher.multiuse, voucher.expires
      ]);
    }

    for (const idx in data)
      data[idx] = data[idx].join(";");

    window.electron.exportAsCsv(data.join("\r\n"));
  }

  /**
   * Exports the currently visible vouchers into pdf files.
   */
  async exportAsPdf() {

    const vouchers = this.vouchers.getSelectedVouchers();

    if (!vouchers.length)
      return;

    const folder = await window.electron.browseForFolder();
    if (!folder)
      return;

    let count = 0;

    for (const voucher of vouchers) {
      const data = {
        id: voucher.id,
        code: voucher.code,
        duration: voucher.duration,
        note: voucher.note
      };

      count++;
      this.showProgress(vouchers.length, count, `Exporting ${data.code} - ${data.note}`);

      await window.electron.exportAsPdf(data, folder);
    }
  }

  /**
   * Shows the export dialog.
   */
  async show() {

    bootstrap.Modal.getOrCreateInstance("#unifi-export-dialog", { keyboard: false }).show();
    await this.waitForEvent("#unifi-export-dialog", "shown.bs.modal");

    const format = await this.getExportFormat();

    if (format === "pdf") {
      await this.exportAsPdf();
    } else if (format === "csv") {
      await this.exportAsCvs();
    } else if (format === "mail") {
      await this.exportAsMail();
    }

    await this.hide();
  }

  /**
   * Hides the export dialog.
   */
  async hide() {
    bootstrap.Modal.getOrCreateInstance("#unifi-export-dialog", { keyboard: false }).hide();
    await this.waitForEvent("#unifi-export-dialog", "hidden.bs.modal");
  }


  /**
   * Shows the exports progress dialog and hides all other panes
   *
   * @param {int} max
   *   maximal progress to be displayed
   * @param {int} count
   *   the current progress
   * @param {string} text
   *   the text for the current progress
   */
  showProgress(max, count, text) {
    document.getElementById("unifi-export-format-dialog").classList.add("d-none");
    document.getElementById("unifi-export-mail-compose-dialog").classList.add("d-none");

    document.getElementById("unifi-export-close").classList.add("d-none");
    document.getElementById("unifi-export-progress-dialog").classList.remove("d-none");

    document.getElementById("unifi-export-progress-status").style.width = `${(HUNDRED_PERCENT / max) * count}%`;
    document.getElementById("unifi-export-progress-text").textContent = text;
  }

  /**
   * Shows a dialog prompting for the mail contents.
   *
   * @param {object} [defaults]
   *   an optional object which the default values for the subject and the body.
   * @returns {object}
   *   the mail content with the keys from, subject and body.
   */
  async getMailContent(defaults) {
    document.getElementById("unifi-export-format-dialog").classList.add("d-none");
    document.getElementById("unifi-export-progress-dialog").classList.add("d-none");

    document.getElementById("unifi-export-mail-compose-dialog").classList.remove("d-none");
    document.getElementById("unifi-export-close").classList.remove("d-none");

    if (defaults) {
      if (defaults.subject)
        document.getElementById("unifi-export-mail-compose-subject").value = defaults.subject;
      if (defaults.body)
        document.getElementById("unifi-export-mail-compose-body").value = defaults.body;
    }

    await this.waitForEvent("#unifi-export-mail-compose-next", "click");

    return {
      subject : document.getElementById("unifi-export-mail-compose-subject").value,
      body : document.getElementById("unifi-export-mail-compose-body").value
    };
  }

  /**
   * Shows a dialog prompting for the mail server's credentials.
   * @param {string} [message]
   *   the optional message to be displayed e.g. to indicate a login error.
   * @returns {object}
   *   the credentials as object containing the user, password and a flag if the password
   *   shall be remembered or not.
   */
  async getMailCredentials(message) {
    document.getElementById("unifi-export-format-dialog").classList.add("d-none");
    document.getElementById("unifi-export-progress-dialog").classList.add("d-none");
    document.getElementById("unifi-export-mail-compose-dialog").classList.add("d-none");

    document.getElementById("unifi-export-mail-credentials-dialog").classList.remove("d-none");
    document.getElementById("unifi-export-close").classList.remove("d-none");

    if (message) {
      document.getElementById("unifi-export-mail-credentials-error").classList.remove("d-none");
      document.getElementById("unifi-export-mail-credentials-error").textContent = message;
    } else {
      document.getElementById("unifi-export-mail-credentials-error").classList.add("d-none");
    }

    await this.waitForEvent("#unifi-export-mail-credentials-next", "click");

    return {
      user : document.getElementById("unifi-export-mail-credentials-user").value,
      password : document.getElementById("unifi-export-mail-credentials-password").value,
      remember : document.getElementById("unifi-export-mail-credentials-remember").checked
    };
  }

  /**
   * Analyzes the vouchers an tries to extract the mail addresses from the
   * from the given list of vouchers. In case the mail address is valid
   * it is added to the voucher as extra key named email.
   *
   * The returned object has a good key ad a bad key. All vouchers with
   * valid mail addresses area added to the good key. While all without
   * a mail address are added to the bad key.
   *
   * @param {object[]} vouchers
   *   the list of vouchers to be analyzed.
   * @returns {object}
   *   a map containing all vouchers with an email address in the good key
   *   an all vouchers without and email address in the bad key.
   */
  getMailAddresses(vouchers) {

    const regex = /\((?<mail>[^()]*@[^()]*)\)[^()]*$/;

    const result = {
      good : [],
      bad : []
    };

    for (const voucher of vouchers) {
      const match = voucher.note.match(regex);

      if (match) {
        voucher["mail"] = match.groups.mail;
        result.good.push(voucher);
        continue;
      }

      voucher["error"] = "Invalid E-Mail Address";
      result.bad.push(voucher);
    }

    return result;
  }

  /**
   * Exports the selected items as mail.
   */
  async exportAsMail() {

    const settings = new Settings();

    const vouchers = this.getMailAddresses(
      this.vouchers.getSelectedVouchers());

    const content = await this.getMailContent(
      await settings.getMailContent());

    // Remember whatever is entered as mail content.
    settings.setMailContent(content.subject, content.body);

    let credentials = await settings.getMailCredentials();
    const server = await settings.getMailServer();

    // Prompt for credentials in case they are not saved.
    if (!credentials || !credentials.user || !credentials.password) {
      let message = null;

      do {
        credentials = await this.getMailCredentials(message);

        message = await window.electron.verifyMailCredentials(
          server.host, server.port, credentials.user, credentials.password);

      } while ((typeof(message) !== "undefined") && (message !== null));
    }

    if (credentials.remember)
      await settings.setMailCredentials(credentials.user, credentials.password);

    let count = 0;

    const bad = vouchers.bad;
    const good = [];

    for (const voucher of vouchers.good) {

      count++;
      this.showProgress(vouchers.good.length, count, `Sending mail to ${voucher.mail}`);

      // Delay to avoid flooding the mail server
      const attachment = await window.electron.exportAsPdf(voucher);

      const body = new MailBody();

      body.setFrom(server.sender);
      body.setTo(voucher.mail);
      body.setReplyTo(server.sender);

      body.setSubject(content.subject);
      body.setBody(content.body);
      body.addAttachment(`${voucher.id}.pdf`, attachment);

      const rv = await window.electron.sendMail(
        server.host, server.port,
        credentials.user, credentials.password,
        server.sender, voucher.mail,
        await body.getRaw());

      await new Promise((resolve) => { setTimeout(resolve, MAIL_COOL_DOWN); });

      if (!rv) {
        good.push(voucher);
        continue;
      }

      voucher["error"] = rv;
      bad.push(voucher);
    }

    if (bad.length)
      await this.showMailErrors(bad);
  }

  /**
   * Shows a dialog listing all failed mail addresses.
   *
   * @param {object[]} errors
   *   the list of errors to be displayed. Each error is made of
   *   the voucher's note field and an error description.
   */
  async showMailErrors(errors) {
    document.getElementById("unifi-export-format-dialog").classList.add("d-none");
    document.getElementById("unifi-export-progress-dialog").classList.add("d-none");
    document.getElementById("unifi-export-mail-compose-dialog").classList.add("d-none");
    document.getElementById("unifi-export-mail-credentials-dialog").classList.add("d-none");

    document.getElementById("unifi-export-mail-error-dialog").classList.remove("d-none");
    document.getElementById("unifi-export-close").classList.remove("d-none");

    const parent = document.getElementById("unifi-export-mail-error-items");
    while (parent.firstChild)
      parent.firstChild.remove();

    for (const item of errors) {
      const elm = document.createElement("li");
      elm.classList.add("list-group-item");

      const voucher = document.createElement("div");
      voucher.textContent = item.note;
      elm.appendChild(voucher);

      const error = document.createElement("div");
      error.textContent = item.error;
      elm.appendChild(error);

      parent.appendChild(elm);
    }

    await this.waitForEvent("#unifi-export-mail-error-dialog-close", "click");
  }
}

export { ExportDialog };
