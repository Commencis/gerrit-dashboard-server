var sources = require("../sources");
var filterOptions = require("../config/filter-options");

var views = (function () {
    "use strict";

    function getStats (req, res, next) {
        var limit = req.query.limit || filterOptions.DEFAULT_LIMIT;
        var filter = req.query.filter || filterOptions.DEFAULT_FILTER;

        sources.getStats(filter, limit, function (statsData) {
            statsData.topReviewers = statsData.topReviewers.filter(function (s) {
                return filterOptions.DISALLOWED_USERS.indexOf(s.name) < 0
            });

            res.json(statsData);
        });
    }

    return {
        "getStats": getStats
    };
})();

module.exports = views;
