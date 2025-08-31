
import { Settings } from "./settings.mjs";

import {
  UnifiCloudPasswordAuthentication,
  UnifiCloudCookieAuthentication
} from "./lib/unifi/cloud/unifi.cloud.login.mjs";


import { UnifiDirectConnection } from "./lib/unifi/direct/unifi.direct.mjs";
import { Vouchers } from "./ui/vouchers.mjs";
import { LoginDialog } from "./ui/login/login.mjs";


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
async function getCloudDevicesByPassword(dialog, user, password) {

  window.electron.setCookieCorsOverride([
    "https://sso.ui.com/api/sso/v1/", "https://config.ubnt.com/"]);

  const authenticator = await (new UnifiCloudPasswordAuthentication().login(user, password));

  if (!authenticator.isMultiFactor())
    return await (await (authenticator.getCloudConnection())).getDevices();

  const { factor, token } = await dialog.getAuthentication(authenticator);

  return await (await authenticator.getCloudConnection(factor, token)).getDevices();
}

/**
 *
 * Gets a list with all known cloud devices
 * which can be accessed by the authentication cookie.
 *
 * @returns {UnifiDevice[]}
 *   a list with all known unifi devices
 */
async function getCloudDevicesByCookie() {
  window.electron.setCookieCorsOverride([
    "https://sso.ui.com/api/sso/v1/", "https://config.ubnt.com/"]);

  const authenticator = await (new UnifiCloudCookieAuthentication()).login();
  return await ((await authenticator.getCloudConnection()).getDevices());
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

async function authenticate(login, settings) {

  // We first try an optimistic cookie login if possible
  // In case if fails with an exception we'll throw an try a password authentication.
  const hasAuthCookie = await window.electron.hasCookie("UBIC_AUTH");
  if (hasAuthCookie) {
    return await getCloudDevicesByCookie();
  }

  const credentials = await login.getCredentials(
    await settings.getConnectionCredentials());

  let devices = [];

  if (credentials.direct) {
    devices = await getDirectDevice(
      credentials.host, credentials.user, credentials.password);
  } else {
    devices = (await getCloudDevicesByPassword(
      login, credentials.user, credentials.password));
  }

  if (login.isRememberLogin())
    await settings.setConnectionCredentials(credentials);

  return devices;
}


(async () => {

  const login = new LoginDialog();
  const settings = new Settings();

  for (;;) {
    try {

      // Check if we are already authenticated
      await login.show();

      const devices = await authenticate(login, settings);

      let device;
      if (devices.length > 1)
        device = await login.getDevice(devices);
      else
        device = devices[0];

      await device.connect();

      await ((new Vouchers(device)).init());

      break;

    } catch (ex) {
      console.error(ex);
    }
  }

  await login.hide();
})();
