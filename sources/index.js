var sourceTypes = require("./types");

var source = (function () {
    "use strict";

    var sourceType = process.env.SOURCE_TYPE || sourceTypes.DB;
    var source = null;

    if (sourceType === sourceTypes.API) {
        source = require("./gerritAPI");
    } else {
        source = require("./gerritDB");
    }

    return {
        "getStats": source.getStats,
        "getDashboard": source.getDashboard
    };
})();

module.exports = source;
