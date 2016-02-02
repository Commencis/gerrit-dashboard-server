var pkg = require("../package.json");
var util = require("../core/util");

var version = (function () {
    function getVersion (req, res, next) {
        var data = {
            "version": pkg.version
        };

        var resp = util.createResponse(data);

        res.json(resp);
    }

    return {
        "getVersion": getVersion
    };
})();

module.exports = version;