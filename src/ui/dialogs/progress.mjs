/* global bootstrap */

const HUNDRED_PERCENT = 100;

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
   * @param {int} max
   *   the maximal progress indication
   * @param {int} count
   *   the current progress  indication
   * @param {string} text
   *   the progress message to be displayed.
   * @returns {ProgressDialog}
   *   a self reference.
   */
  update(max, count, text) {
    document.querySelector(`${this.id}-status`).style.width = `${(HUNDRED_PERCENT / max) * count}%`;
    document.querySelector(`${this.id}-text`).textContent = text;
    return this;
  }
}

export { ProgressDialog };
