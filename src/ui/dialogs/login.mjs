/* global bootstrap */

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

    document.getElementById("unifi-login-credentials-user").addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("unifi-login-credentials-password").focus();
      }
    });
    document.getElementById("unifi-login-credentials-password").addEventListener("keypress", (event) => {
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

export { LoginDialog };
