/**
 * Manages settings and credentials.
 */
class Settings {

  /**
   * Gets the saved smtp server settings which include the hostname,
   * the port as well as the sender's address.
   *
   * @returns {object}
   *   a map containing the host, port and the sender's address
   */
  async getMailServer() {
    return {
      host : localStorage.getItem("smtp.host"),
      port : localStorage.getItem("smtp.port"),
      sender : localStorage.getItem("smtp.sender")
    };
  }

  /**
   * Sets teh smtp server settings.
   *
   * @param {string} host
   *   the server's hostname
   * @param {int} port
   *   the server's port
   * @param {string} sender
   *   the sender's address to be used on the envelope
   *   as well as inside the mail
   */
  async setMailServer(host, port, sender) {
    localStorage.setItem("smtp.host", host);
    localStorage.setItem("smtp.port", port);
    localStorage.setItem("smtp.sender", sender);
  }

  /**
   * Remembers the mail subject and mail body
   *
   * @param {string} subject
   *   the subject line
   * @param {string} body
   *   the mail body.
   */
  async setMailContent(subject, body) {
    localStorage.setItem("mail.subject", subject);
    localStorage.setItem("mail.body", body);
  }

  /**
   * Gets the subject and body of the last send mail export.
   *
   * @returns {object}
   *   the mail content.
   */
  async getMailContent() {
    return {
      subject : localStorage.getItem("mail.subject"),
      body : localStorage.getItem("mail.body")
    };
  }

  /**
   *
   * @returns {object}
   */
  async getMailCredentials() {
    return {
      user : localStorage.getItem("smtp.user"),
      password : await window.electron.decryptString(
        localStorage.getItem("smtp.password"))
    };
  }

  /**
   *
   * @param {string} username
   * @param {string} password
   */
  async setMailCredentials(username, password) {
    localStorage.setItem("smtp.user", username);
    localStorage.setItem("smtp.password",
      await window.electron.encryptString(password));
  }

  /**
   * Sets the default credentials for a direct connection.
   * The password is stored encrypted.
   *
   * @param {string} host
   *   the hostname.
   * @param {string} user
   *   the username.
   * @param {string} password
   *   the password.
   */
  async setDirectConnectionCredentials(host, user, password) {

    localStorage.setItem("unifi.login.direct.host", host);
    localStorage.setItem("unifi.login.direct.user", user);
    localStorage.setItem("unifi.login.direct.password",
      await window.electron.encryptString(password));
  }

  /**
   *
   * @returns {object}
   */
  async getDirectConnectionCredentials() {

    return {
      host: localStorage.getItem("unifi.login.direct.host"),
      user: localStorage.getItem("unifi.login.direct.user"),
      password: await window.electron.decryptString(
        localStorage.getItem("unifi.login.direct.password"))
    };
  }

  /**
   *
   * @param {string} user
   *   the cloud connection's user
   * @param {string} password
   *   the cloud connection's password
   */
  async setCloudConnectionCredentials(user, password) {
    localStorage.setItem("unifi.login.cloud.user", user);
    localStorage.setItem("unifi.login.cloud.password",
      await window.electron.encryptString(password));
  }

  /**
   *
   * @returns {object}
   */
  async getCloudConnectionCredentials() {
    return {
      user: localStorage.getItem("unifi.login.cloud.user"),
      password: await window.electron.decryptString(
        localStorage.getItem("unifi.login.cloud.password"))
    };
  }

  /**
   *
   * @param {*} credentials
   */
  async setConnectionCredentials(credentials) {
    if (credentials.direct) {
      await this.setDirectConnectionCredentials(credentials.host, credentials.user, credentials.password);
      return;
    }

    await this.setCloudConnectionCredentials(credentials.user, credentials.password);
  }

  /**
   * Gets the saved cloud and connection credentials.
   * In case a credential is unknown, null is returned.
   *
   * @returns {object}
   *   all cloud and direct connection credentials
   */
  async getConnectionCredentials() {
    return {
      cloud: await this.getCloudConnectionCredentials(),
      direct: await this.getDirectConnectionCredentials()
    };
  }

  /**
   * Clears all saved direct connection credentials.
   */
  async removeDirectConnectionCredentials() {
    localStorage.removeItem("unifi.login.direct.host");
    localStorage.removeItem("unifi.login.direct.user");
    localStorage.removeItem("unifi.login.direct.password");
  }

  /**
   * Clears all saved cloud connection credentials.
   */
  async removeCloudConnectionCredentials() {
    localStorage.removeItem("unifi.login.cloud.user");
    localStorage.removeItem("unifi.login.cloud.password");
  }
}

export { Settings };
