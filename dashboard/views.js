var sources = require("../sources");

var views = (function () {
    "use strict";

    function getDashboardData (req, res, next) {
        sources.getDashboard(function (dashboardData) {
           res.json(dashboardData);
        });
    }

    return {
      "getDashboardData": getDashboardData
    };
})();

module.exports = views;