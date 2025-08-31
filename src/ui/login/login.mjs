/* global bootstrap */

import { Template } from "../template/template.mjs";

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

    if (document.getElementById("unifi-login-dialog")) {
      if (bootstrap.Modal.getInstance("#unifi-login-dialog"))
        return;

      bootstrap.Modal.getOrCreateInstance("#unifi-login-dialog", { keyboard: false }).show();
      await this.waitForEvent("#unifi-login-dialog", "shown.bs.modal");
    }

    const template = await ((new Template()).load("ui/login/login.html"));
    document.body.appendChild(template);

    this.showProgress();

    document.getElementById("unifi-login-connection").addEventListener("change", (event) => {
      if (event.target.value === "direct") {
        document.getElementById("unifi-login-direct-host").parentElement.parentElement.classList.remove("d-none");
        document.getElementById("unifi-login-direct-user").parentElement.parentElement.classList.remove("d-none");
        document.getElementById("unifi-login-direct-password").parentElement.parentElement.classList.remove("d-none");

        document.getElementById("unifi-login-cloud-user").parentElement.parentElement.classList.add("d-none");
        document.getElementById("unifi-login-cloud-password").parentElement.parentElement.classList.add("d-none");
        return;
      }

      document.getElementById("unifi-login-cloud-user").parentElement.parentElement.classList.remove("d-none");
      document.getElementById("unifi-login-cloud-password").parentElement.parentElement.classList.remove("d-none");

      document.getElementById("unifi-login-direct-host").parentElement.parentElement.classList.add("d-none");
      document.getElementById("unifi-login-direct-user").parentElement.parentElement.classList.add("d-none");
      document.getElementById("unifi-login-direct-password").parentElement.parentElement.classList.add("d-none");
    });

    document.getElementById("unifi-login-direct-host").addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("unifi-login-direct-user").focus();
      }
    });

    document.getElementById("unifi-login-direct-user").addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("unifi-login-direct-password").focus();
      }
    });

    document.getElementById("unifi-login-direct-password").addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("unifi-login-credentials-next").click();
      }
    });

    document.getElementById("unifi-login-cloud-user").addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("unifi-login-direct-password").focus();
      }
    });

    document.getElementById("unifi-login-cloud-password").addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("unifi-login-credentials-next").click();
      }
    });

    bootstrap.Modal.getOrCreateInstance("#unifi-login-dialog", { keyboard: false }).show();
    await this.waitForEvent("#unifi-login-dialog", "shown.bs.modal");
  }

  /**
   * Shows the progress page
   */
  showProgress() {
    document.getElementById("unifi-login-device").classList.add("d-none");
    document.getElementById("unifi-login-credentials").classList.add("d-none");
    document.getElementById("unifi-login-mfa").classList.add("d-none");

    document.getElementById("unifi-loading").classList.remove("d-none");
  }

  /**
   * Shows the credentials page.
   */
  showCredentials() {
    document.getElementById("unifi-login-device").classList.add("d-none");
    document.getElementById("unifi-loading").classList.add("d-none");
    document.getElementById("unifi-login-mfa").classList.add("d-none");

    document.getElementById("unifi-login-credentials").classList.remove("d-none");
  }

  /**
   * Shows the device page.
   */
  showDevice() {
    document.getElementById("unifi-login-credentials").classList.add("d-none");
    document.getElementById("unifi-loading").classList.add("d-none");
    document.getElementById("unifi-login-mfa").classList.add("d-none");

    document.getElementById("unifi-login-device").classList.remove("d-none");
  }

  /**
   * SHows the multi factor authentication.
   */
  showAuthentication() {
    document.getElementById("unifi-login-credentials").classList.add("d-none");
    document.getElementById("unifi-loading").classList.add("d-none");
    document.getElementById("unifi-login-device").classList.add("d-none");

    document.getElementById("unifi-login-mfa").classList.remove("d-none");
  }

  /**
   * Prompts the user for credentials.
   *
   * @param {object} [defaults]
   *   optional default values to prefill the fields.
   * @returns {object}
   *   object containing the username and password.
   */
  async getCredentials(defaults) {

    if (defaults) {
      if (defaults.direct) {
        if (defaults.direct.host)
          document.getElementById("unifi-login-direct-host").value = defaults.direct.host;
        if (defaults.direct.hostname)
          document.getElementById("unifi-login-direct-user").value = defaults.direct.user;
        if (defaults.direct.password)
          document.getElementById("unifi-login-direct-password").value = defaults.direct.password;
      }

      if (defaults.cloud) {
        if (defaults.cloud.user)
          document.getElementById("unifi-login-cloud-user").value = defaults.cloud.user;
        if (defaults.cloud.password)
          document.getElementById("unifi-login-cloud-password").value = defaults.cloud.password;
      }
    }

    this.showCredentials();

    await this.waitForEvent("#unifi-login-credentials-next", "click");

    this.showProgress();

    if (document.getElementById("unifi-login-connection").value === "direct") {
      return {
        direct:  true,
        host : document.getElementById("unifi-login-direct-hostname").value,
        user : document.getElementById("unifi-login-direct-user").value,
        password : document.getElementById("unifi-login-direct-password").value };
    }

    return {
      direct: false,
      user : document.getElementById("unifi-login-cloud-user").value,
      password : document.getElementById("unifi-login-cloud-password").value };
  }

  /**
   * Prompts the user for the multi factor authentication.
   *
   * @param {AbstractUnifiCloudAuthenticator} authenticator
   *   the authenticator to be rendered.
   * @returns {object}
   *   object containing the authenticator id and the token.
   */
  async getAuthentication(authenticator) {

    const factor = authenticator.getPreferredFactor();

    document.getElementById("unifi-login-mfa-description").textContent = factor.getDescription();

    this.showAuthentication();

    await this.waitForEvent("#unifi-login-mfa-next", "click");

    this.showProgress();

    const result = {
      factor : factor.getId(),
      token: document.getElementById("unifi-login-mfa-token").value
    };

    return result;
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
   * Checks if the user has chosen to remember the password.
   *
   * @returns {boolean}
   *   true in case the password should be remembered.
   */
  isRememberLogin() {
    return document.getElementById("unifi-login-remember").checked;
  }

  /**
   * Hides the dialog and waits until it faded out.
   */
  async hide() {
    bootstrap.Modal.getOrCreateInstance("#unifi-login-dialog", { keyboard: false }).hide();
    await this.waitForEvent("#unifi-login-dialog", "hidden.bs.modal");
  }
}

export { LoginDialog };
