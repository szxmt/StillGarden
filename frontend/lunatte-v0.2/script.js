(function () {
  "use strict";

  const requiredGlobals = ["LunatteCore", "LunatteApi", "LunatteState", "LunatteWebApp"];
  const missing = requiredGlobals.filter((name) => !window[name]);
  if (missing.length) {
    throw new Error(`Lunette boot failed: missing ${missing.join(", ")}`);
  }

  window.LunatteWebApp.boot();
})();
