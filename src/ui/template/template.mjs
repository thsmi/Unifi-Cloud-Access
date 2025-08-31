/**
 * Loads an html fragment from a file or url.
 */
class Template {


  /**
   * Loads an html fragment from file or url
   *
   * @param {string} tpl
   *   the path tho the template file
   * @returns {Promise<HTMLElement>}
   *   the template which should be loaded.
   */
  async load(tpl) {

    console.log(`Load template ${tpl}`);

    const html = await (await fetch(tpl, { cache: "no-store" })).text();

    const doc = (new DOMParser()).parseFromString(html, "text/html");

    return doc.body.firstElementChild;
  }
}

export { Template };
