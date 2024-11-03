
import { LoginDialog } from "./ui/dialogs/login.mjs";
import { Settings } from "./settings.mjs";

import { UnifiCloudAuthentication } from "./lib/unifi/cloud/unifi.cloud.mjs";
import { UnifiDirectConnection } from "./lib/unifi/direct/unifi.direct.mjs";
import { Vouchers } from "./ui/vouchers.mjs";


/**
 * Gets a list with all known cloud devices
 * for the user with the given username and password.
 *
 * In case MFA is activated it will request the user
 * to enter a corresponding token.
 *
 * It configures cookie overrides to bypass CORS issues.
 *
 * @param {LoginDialog} dialog
 *   the dialog used to interact with the user.
 * @param {string} user
 *   the username used for authentication
 * @param {string} password
 *   the password used for authentication
 *
 * @returns {UnifiDevice[]}
 *   a list with all known unifi devices
 */
async function getCloudDevices(dialog, user, password) {

  window.electron.setCookieCorsOverride([
    "https://sso.ui.com/api/sso/v1/", "https://config.ubnt.com/"]);

  const authenticators = await (new UnifiCloudAuthentication().login(user, password));

  if (!authenticators.isMultiFactor())
    return await authenticators.getCloudDevices();

  const {authenticator, token} = await dialog.getAuthentication(
    authenticators.getPreferredAuthenticator());

  return await authenticators.getCloudDevices(authenticator, token);
}

/**
 * Connects directly to a unifi machine.
 * It configures cookie overrides to bypass CORS issues.
 *
 * @param {string} host
 *   the hostname of the unifi machine
 * @param {string} user
 *   the username as string
 * @param {string} password
 *   the password as string
 * @returns {UnifiDevice[]}
 *   a list with zero or one device.
 */
async function getDirectDevice(host, user, password) {
  window.electron.setCookieCorsOverride([`https://${host}/`]);

  return await (new UnifiDirectConnection().login(host, user, password));
}

(async () => {

  await window.electron.clearCookies();

  const login = new LoginDialog();
  const settings = new Settings();

  for (;;) {
    try {

      await login.show();

      let devices = [];
      const credentials = await login.getCredentials(
        await settings.getConnectionCredentials());

      if (credentials.direct) {
        devices = await getDirectDevice(
          credentials.host, credentials.user, credentials.password);
      } else {
        devices = await getCloudDevices(
          login, credentials.user, credentials.password);
      }

      let device;
      if (devices.length > 1)
        device = await login.getDevice(devices);
      else
        device = devices[0];

      await device.connect();

      if (login.isRememberLogin())
        await settings.setConnectionCredentials(credentials);

      await ((new Vouchers(device)).init());

      break;

    } catch (ex) {
      console.error(ex);
    }
  }

  await login.hide();
})();
