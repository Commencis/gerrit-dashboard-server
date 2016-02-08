var moment = require("moment");
var async = require("async");

var Connection = require("./Connection");
var cacheConfig = require("../../config/cache-config");
var index = require("../../core/index");
var cache = require("../cache");
var util = require("../../util/index");

var gerritDB = (function () {
    "use strict";

    var getFilterDate = index.getFilterDate;

    var setCacheData = cache.setCacheData;
    var getCacheData = cache.getCacheData;
    var isCached = cache.isCached;

    var changeStatus = {
        "MERGED": "M",
        "ABANDONED": "A",
        "DRAFT": "d"
    };

    function doQuery (query, callback) {
        var connection = Connection.connect();

        connection.query(query, function (err, rows, fields) {
            if (err) {
                throw err;
            } else {
                callback(rows);

                connection.end();
            }
        });
    }

    function getTotalNumberOfProjects (callback) {
        var query = "SELECT COUNT(DISTINCT dest_project_name) AS count"
            + " FROM changes";

        doQuery(query, function (queryResult) {
            callback(queryResult[0].count);
        });
    }

    function getNumberOfReviews (callback) {
        var numberOfReviews = {
            "open": null,
            "merged": null,
            "abandoned": null,
            "draft": null
        };

        var query = "SELECT COUNT(*) AS Count, status AS reviewType"
            + " FROM changes"
            + " GROUP BY reviewType";

        doQuery(query, function (queryResult) {
            var newReview = 0;
            var mergedReview = 0;
            var abandonedReview = 0;
            var draftReview = 0;

            for (var reviewIndex = 0; reviewIndex < queryResult.length; reviewIndex++) {
                if (queryResult[reviewIndex].reviewType === changeStatus.ABANDONED) {
                    abandonedReview = queryResult[reviewIndex].Count;
                } else if (queryResult[reviewIndex].reviewType === changeStatus.MERGED) {
                    mergedReview = queryResult[reviewIndex].Count;
                } else if (queryResult[reviewIndex].reviewType === changeStatus.DRAFT) {
                    draftReview = queryResult[reviewIndex].Count;
                } else {
                    newReview = queryResult[reviewIndex].Count;
                }
            }
            numberOfReviews.open = newReview + draftReview;
            numberOfReviews.merged = mergedReview;
            numberOfReviews.draft = draftReview;
            numberOfReviews.abandoned = abandonedReview;

            callback(numberOfReviews);
        })
    }

    function getNumberOfCommits (filterOptions, callback) {
        var filterDate = getFilterDate(filterOptions);

        var query = "SELECT COUNT(change_key) AS numberOfCommits"
            + " FROM gerrit.changes"
            + " WHERE changes.status != " + "'" + changeStatus.DRAFT + "'"
            + " AND date_format(changes.created_on, '%Y-%m-%d') >=" + "'" + filterDate + "'";

        doQuery(query, function (queryResult) {
            callback(queryResult);
        })
    }

    function getMostCommittedProjects (filterOption, callback) {
        var mostCommittedProjectsList = null;
        var filterDate = getFilterDate(filterOption);

        var query = "SELECT dest_project_name AS name, count(dest_project_name) AS commits"
            + " FROM changes"
            + " WHERE status != " + "'" + changeStatus.DRAFT + "'"
            + " AND date_format(changes.created_on, '%Y-%m-%d') >=" + "'" + filterDate + "'"
            + " GROUP BY name"
            + " ORDER BY commits DESC";

        doQuery(query, function (queryResult) {
            mostCommittedProjectsList = queryResult;

            callback(mostCommittedProjectsList);
        })
    }

    function getTopCommitters (filterOption, callback) {
        var filterDate = getFilterDate(filterOption);

        var query = "SELECT full_name AS name, COUNT(change_key) AS commits"
            + " FROM  gerrit.accounts, gerrit.changes"
            + " WHERE changes.status != " + "'" + changeStatus.DRAFT + "'"
            + " AND date_format(changes.created_on, '%Y-%m-%d') >=" + "'" + filterDate + "'"
            + " AND changes.owner_account_id = accounts.account_id"
            + " GROUP BY name"
            + " ORDER BY commits desc";

        doQuery(query, function (queryData) {
            callback(queryData);
        })
    }

    function getAverageReviewInterval (callback) {
        var query = "SELECT created_on AS createdDate, last_updated_on AS updatedDate"
            + " FROM gerrit.changes"
            + " WHERE status = " + "'" + changeStatus.MERGED + "'";

        doQuery(query, function (queryResult) {
            var average = 0;
            var total = 0;
            var numberOfMergedReview = 0;
            var interval = 0;

            var TIME_PERIOD_TYPE = "hours";

            numberOfMergedReview = queryResult.length;

            for (var reviewIndex = 0; reviewIndex < numberOfMergedReview; reviewIndex++) {
                var reviewCreateTime = moment(queryResult[reviewIndex].createdDate);
                var reviewUpdateTime = moment(queryResult[reviewIndex].updatedDate);

                interval = reviewUpdateTime.diff(reviewCreateTime, TIME_PERIOD_TYPE);

                total += interval;
            }

            average = Math.ceil(total / numberOfMergedReview);

            callback(average);
        })
    }

    function getTopReviewers (filterOption, callback) {
        var filterDate = getFilterDate(filterOption);

        var query = "select full_name,"
            +" dest_project_name,"
            +" patch_set_approvals.value"
            +" from patch_set_approvals"
            +" inner join changes on patch_set_approvals.change_id = changes.change_id"
            +" inner join accounts on patch_set_approvals.account_id = accounts.account_id"
            +" where date_format(patch_set_approvals.granted, '%Y-%m-%d') >=" + "'" + filterDate + "'"
            +" and patch_set_approvals.category_id = 'Code-Review'"
            +" and changes.owner_account_id != accounts.account_id"
            +" and full_name != 'Jenkins'";

        doQuery(query, function (queryResult) {
            callback(queryResult);
        })
    }

    function getStats (filter, limit, callback) {
        var numberOfCommits = null;
        var mostCommittedProjects = null;
        var topCommitters = null;
        var topReviewers = null;

        async.parallel({
            "getNumberOfCommits": function (callback) {
                var cacheKey = cacheConfig[filter].numberOfCommits.key;
                var cacheTTL = cacheConfig[filter].numberOfCommits.TTL;

                if (isCached(cacheKey)) {
                    var cacheData = getCacheData(cacheKey);
                    callback(null, cacheData);
                } else {
                    getNumberOfCommits(filter, function (numberOfCommits) {
                        var commits = numberOfCommits[0].numberOfCommits;
                        setCacheData(cacheKey, commits, cacheTTL);

                        callback(null, commits);
                    });
                }
            },

            "getMostCommittedProjects": function (callback) {
                var cacheKey = cacheConfig[filter].mostCommittedProjects.key;
                var cacheTTL = cacheConfig[filter].mostCommittedProjects.TTL;

                if (isCached(cacheKey)) {
                    var cacheData = getCacheData(cacheKey);
                    callback(null, cacheData);
                } else {
                    getMostCommittedProjects(filter, function (projects) {
                        setCacheData(cacheKey, projects, cacheTTL);

                        callback(null, projects);
                    });
                }
            },

            "getTopCommitters": function (callback) {
                var cacheKey = cacheConfig[filter].topCommitters.key;
                var cacheTTL = cacheConfig[filter].topCommitters.TTL;

                if (isCached(cacheKey)) {
                    var cacheData = getCacheData(cacheKey);
                    callback(null, cacheData);
                } else {
                    getTopCommitters(filter, function (topCommitters) {
                        setCacheData(cacheKey, topCommitters, cacheTTL);

                        callback(null, topCommitters);
                    });
                }
            },

            "getTopReviewers": function (callback) {
                var cacheKey = cacheConfig[filter].topReviewers.key;
                var cacheTTL = cacheConfig[filter].topReviewers.TTL;

                if (isCached(cacheKey)) {
                    var cacheData = getCacheData(cacheKey);
                    callback(null, cacheData);
                } else {
                    getTopReviewers(filter, function (rawData) {
                        var reviewersList = [];
                        var reviewer, reviewerIndex, projectIndex;
                        var dataLength = rawData.length;

                        for (var dataIndex = 0; dataIndex < dataLength; dataIndex++) {
                            reviewer = {};

                            reviewerIndex = util.arrayUtil.findObjectByProperty(reviewersList, "name",
                                rawData[dataIndex].full_name);

                            if (reviewerIndex == null) {
                                reviewer.name = rawData[dataIndex].full_name;
                                reviewer.reviews = 0;
                                reviewer.projectReviews = [];
                                reviewer.scores = {"2": 0, "1": 0, "0": 0, "-2": 0, "-1": 0};
                                reviewer.reviews += 1;

                                projectIndex = util.arrayUtil.findObjectByProperty(reviewer.projectReviews,
                                    "projectName", rawData[dataIndex].dest_project_name);

                                if (projectIndex == null) {
                                    reviewer.projectReviews.push({
                                        "projectName": rawData[dataIndex].dest_project_name,
                                        "reviewCount": 1
                                    });
                                } else {
                                    reviewer.projectReviews[projectIndex].reviewCount += 1;
                                }

                                reviewer.scores[rawData[dataIndex].value.toString()] += 1;

                                reviewersList.push(reviewer);
                            } else {
                                reviewersList[reviewerIndex].reviews += 1;

                                projectIndex =
                                    util.arrayUtil.findObjectByProperty(reviewersList[reviewerIndex].projectReviews,
                                    "projectName", rawData[dataIndex].dest_project_name);

                                if (projectIndex == null) {
                                    reviewersList[reviewerIndex].projectReviews.push({
                                        "projectName": rawData[dataIndex].dest_project_name,
                                        "reviewCount": 1
                                    });
                                } else {
                                    reviewersList[reviewerIndex].projectReviews[projectIndex].reviewCount += 1;
                                }

                                reviewersList[reviewerIndex].scores[rawData[dataIndex].value.toString()] += 1;
                            }
                        }

                        reviewersList.sort(function (a, b) {
                            return b.reviews - a.reviews;
                        });

                        setCacheData(cacheKey, reviewersList, cacheTTL);

                        callback(null, reviewersList);
                    });
                }
            }
        }, function (err, results) {
            if (err) {
                throw (err);
            } else {

                if (limit) {
                    numberOfCommits = results.getNumberOfCommits;
                    mostCommittedProjects = results.getMostCommittedProjects.splice(0, limit);
                    topCommitters = results.getTopCommitters.splice(0, limit);
                    topReviewers = results.getTopReviewers.splice(0, limit);
                } else {
                    numberOfCommits = results.getNumberOfCommits;
                    mostCommittedProjects = results.getMostCommittedProjects;
                    topCommitters = results.getTopCommitters;
                    topReviewers = results.getTopReviewers;
                }

                var jsonData = {
                    "numberOfCommits": numberOfCommits,
                    "mostCommittedProjects": mostCommittedProjects,
                    "topCommitters": topCommitters,
                    "topReviewers": topReviewers
                };

                callback(jsonData);
            }
        });
    }

    function getDashboard (callback) {
        async.parallel({
            "getNumberOfReviews": function (callback) {
                var cacheKey = cacheConfig.numberOfReviews.key;
                var cacheTTL = cacheConfig.numberOfReviews.TTL;

                if (isCached(cacheKey)) {
                    var cachedData = getCacheData(cacheKey);
                    callback(null, cachedData);
                } else {
                    getNumberOfReviews(function (numberOfReviews) {
                        setCacheData(cacheKey, numberOfReviews, cacheTTL);
                        callback(null, numberOfReviews);
                    });
                }
            },

            "getAverageReviewInterval": function (callback) {
                var cacheKey = cacheConfig.averageReviewInterval.key;
                var cacheTTL = cacheConfig.averageReviewInterval.TTL;

                if (isCached(cacheKey)) {
                    var cachedData = getCacheData(cacheKey);
                    callback(null, cachedData);
                } else {
                    getAverageReviewInterval(function (avarageReviewInterval) {
                        setCacheData(cacheKey, avarageReviewInterval, cacheTTL);
                        callback(null, avarageReviewInterval);
                    });
                }
            },

            "getTotalNumberOfProjects": function (callback) {
                var cacheKey = cacheConfig.totalNumberOfProjects.key;
                var cacheTTL = cacheConfig.totalNumberOfProjects.TTL;

                if (isCached(cacheKey)) {
                    var cacheData = getCacheData(cacheKey);
                    callback(null, cacheData);
                } else {
                    getTotalNumberOfProjects(function (totalNumberOfProjects) {
                        setCacheData(cacheKey, totalNumberOfProjects, cacheTTL);
                        callback(null, totalNumberOfProjects);
                    });
                }
            }
        }, function (err, results) {
            if (err) {
                throw (err);
            } else {
                var dashboardData = {
                    "totalNumberOfProjects": results.getTotalNumberOfProjects,
                    "numberOfReviews": results.getNumberOfReviews,
                    "averageReviewInterval": results.getAverageReviewInterval
                };

                callback(dashboardData);
            }
        });
    }

    return {
        "getStats": getStats,
        "getDashboard": getDashboard
    };
})();

module.exports = gerritDB;
