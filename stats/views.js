var sources = require("../sources");
var filterOptions = require("../config/filter-options");

var views = (function () {
    "use strict";

    function getStats (req, res, next) {
        var limit = req.query.limit || filterOptions.DEFAULT_LIMIT;
        var filter = req.query.filter || filterOptions.DEFAULT_FILTER;

        sources.getStats(filter, limit, function (statsData) {
            res.json(statsData);
        });
    }

    return {
        "getStats": getStats
    };
})();

module.exports = views;
