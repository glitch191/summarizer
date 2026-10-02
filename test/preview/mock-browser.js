// Minimal stand-in for the WebExtension "browser" object, so the settings page
// can be opened in any browser for screenshots. Not shipped with the extension.

(() => {
  const request = new XMLHttpRequest();
  request.open("GET", "/manifest.json", false);
  request.send();
  const manifest = JSON.parse(request.responseText);

  const data = {};

  window.browser = {
    runtime: {
      getURL: (path) => `/${path}`,
      getManifest: () => manifest,
    },
    storage: {
      local: {
        async get(keys) {
          if (keys && typeof keys === "object" && !Array.isArray(keys)) {
            const result = { ...keys };
            for (const key of Object.keys(keys)) if (key in data) result[key] = data[key];
            return result;
          }
          const list = typeof keys === "string" ? [keys] : keys ?? Object.keys(data);
          return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, data[key]]));
        },
        async set(values) {
          Object.assign(data, values);
        },
        async remove(keys) {
          for (const key of [].concat(keys)) delete data[key];
        },
      },
    },
  };
})();
