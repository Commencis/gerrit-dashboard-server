var digest = require("http-digest-client");

var app = require("../app");

var gerrit = (function () {
    "use strict";

    var appConfigPath = app.get("APP_CONFIG_PATH");
    var gerritAPIConfig = require(appConfigPath + "/gerrit.json");

    function getRequest (path, callback) {
        var client = digest(gerritAPIConfig.username, gerritAPIConfig.password);

        client.request({
            "host": gerritAPIConfig.host,
            "path": path,
            "method": "GET",
            "headers": {"Accept": "application/json"}
        }, function (res) {
            onResponse(res, callback);
        });
    }

    function onResponse (res, callback) {
        var resp = "";

        res.on("data", function (data) {
            resp += data;
        });

        res.on("end", function () {
            try {
                // cleaning unwanted tokens
                var clean = resp.substr(5, resp.length);
                var jsonData = JSON.parse(clean);

                callback(jsonData);
            } catch (exception) {
                return callback(null);
            }
        });
    }

    return {
        "getProjects": function (callback) {
            getRequest("/a/projects/", callback);
        },
        "getOpenReviews": function (callback) {
            getRequest("/a/changes/?q=status:open", callback);
        },
        "getMergedReviews": function (callback) {
            getRequest("/a/changes/?q=status:merged", callback);
        },
        "getAbandonedReviews": function (callback) {
            getRequest("/a/changes/?q=status:abandoned", callback);
        },
        "getDraftReviews": function (callback) {
            getRequest("/a/changes/?q=status:draft", callback);
        },
        "getReviewers": function (reviewID, callback) {
            getRequest("/a/changes/" + reviewID + "/reviewers/", callback);
        },
        "getOpenAndMergedReviews": function (callback) {
            getRequest("/a/changes/?q=status:open&q=status:merged", callback);
        }
    };
})();

module.exports = gerrit;