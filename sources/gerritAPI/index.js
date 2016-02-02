var async = require("async");
var moment = require("moment");

var gerrit = require("../../core/gerrit");
var util = require("./util");
var cacheConfig = require("../../config/cache-config");
var cache = require("../cache");

var gerritAPI = (function () {
    "use strict";

    var setCacheData = cache.setCacheData;
    var getCacheData = cache.getCacheData;
    var isCached = cache.isCached;

    function getOpenAndMergedReviewsList (callback) {
        var openReviewsList;
        var mergedReviewsList;
        var totalList;

        async.parallel({
            "openReviewsList": function (callback) {
                gerrit.getOpenReviews(function (openReviewList) {
                    callback(null, openReviewList);
                });
            },

            "mergedReviewList": function (callback) {
                gerrit.getMergedReviews(function (mergedReviewsList) {
                    callback(null, mergedReviewsList);
                });
            }
        }, function (err, results) {
            if (err) {
                callback(new Error(err));
            } else {
                openReviewsList = results.openReviewsList;
                mergedReviewsList = results.mergedReviewList;
                totalList = null;

                if (openReviewsList !== null && mergedReviewsList !== null) {
                    totalList = openReviewsList.concat(mergedReviewsList);
                }

                callback(totalList);
            }
        });
    }

    function getReviewers (reviewList, reviewerList, flag, callback) {
        var reviewID;
        var reviewerName;

        if (flag === reviewList.length) {
            callback(reviewerList);
        } else {
            reviewID = reviewList[flag].id;

            gerrit.getReviewers(reviewID, function (reviewers) {
                for (var reviewer in reviewers) {
                    if (reviewers.hasOwnProperty(reviewer)) {
                        reviewerName = reviewers[reviewer].name;

                        reviewerList.push(reviewerName);
                    }
                }

                flag++;
                getReviewers(reviewList, reviewerList, flag, callback);
            });
        }
    }

    function getTotalNumberOfProjects (callback) {
        var numberOfProjects;

        gerrit.getProjects(function (projectList) {
            numberOfProjects = Object.keys(projectList).length;

            callback(numberOfProjects);
        });
    }

    function getNumberOfReviews (callback) {
        var numberOfReviews = {
            "open": null,
            "merged": null,
            "abandoned": null,
            "draft": null
        };

        async.parallel({
            "numberOfOpenReviews": function (callback) {
                gerrit.getOpenReviews(function (openReviewsList) {
                    var numberOfOpenReviews = null;

                    if (openReviewsList !== null) {
                        numberOfOpenReviews = openReviewsList.length;
                    }

                    callback(null, numberOfOpenReviews);
                });
            },

            "numberOfMergedReviews": function (callback) {
                gerrit.getMergedReviews(function (mergedReviewsList) {
                    var numberOfMergedReviews = null;

                    if (mergedReviewsList !== null) {
                        numberOfMergedReviews = mergedReviewsList.length;
                    }

                    callback(null, numberOfMergedReviews);
                });
            },

            "numberOfAbandonedReviews": function (callback) {
                gerrit.getAbandonedReviews(function (abandonedReviewsList) {
                    var numberOfAbandonedReviews = null;

                    if (abandonedReviewsList !== null) {
                        numberOfAbandonedReviews = abandonedReviewsList.length;
                    }

                    callback(null, numberOfAbandonedReviews);
                });
            },

            "numberOfDraftReviews": function (callback) {
                gerrit.getDraftReviews(function (draftReviewsList) {
                    var numberOfDraftReviews = null;

                    if (draftReviewsList !== null) {
                        numberOfDraftReviews = draftReviewsList.length;
                    }

                    callback(null, numberOfDraftReviews);
                });
            }
        }, function (err, results) {
            if (err) {
                new Error(err);
            } else {
                numberOfReviews.open = results.numberOfOpenReviews;
                numberOfReviews.merged = results.numberOfMergedReviews;
                numberOfReviews.abandoned = results.numberOfAbandonedReviews;
                numberOfReviews.draft = results.numberOfDraftReviews;

                callback(numberOfReviews);
            }
        });
    }

    function getAverageReviewInterval (callback) {
        var average = 0,
            total = 0,
            numberOfMergedReview = 0,
            interval = 0;

        var TIME_PERIOD_TYPE = "hours";
        var reviewCreateTime;
        var reviewUpdateTime;

        gerrit.getMergedReviews(function (mergedReviewsList) {
            if (mergedReviewsList !== null) {
                numberOfMergedReview = mergedReviewsList.length;

                for (var review in mergedReviewsList) {
                    if (mergedReviewsList.hasOwnProperty(review)) {
                        reviewCreateTime = moment(mergedReviewsList[review].created);
                        reviewUpdateTime = moment(mergedReviewsList[review].updated);

                        interval = reviewUpdateTime.diff(reviewCreateTime, TIME_PERIOD_TYPE);

                        total += interval;
                    }
                }

                average = Math.ceil(total / numberOfMergedReview);

                callback(average);
            } else {
                callback(null);
            }
        });
    }

    function getTopReviewers (filterOption, callback) {
        var reviewerList = [];
        var topReviewerList;

        async.waterfall([
            function (callback) {
                getOpenAndMergedReviewsList(function (totalReviewList) {
                    var filteredReviews = util.getReviewsByFilter(totalReviewList, filterOption);

                    callback(null, filteredReviews);
                })
            },
            function (arg1, callback) {
                getReviewers(arg1, reviewerList, 0, function (reviewerList) {
                    topReviewerList = util.getTopReviewers(reviewerList);

                    callback(null, topReviewerList);
                })
            }
        ], function (err, result) {
            if (err) {
                throw err;
            } else {
                callback(result);
            }
        });
    }

    function getNumberOfCommits (filterOption, callback) {
        var filteredReviews;
        var numberOfCommits;

        getOpenAndMergedReviewsList(function (reviewList) {
            filteredReviews = util.getReviewsByFilter(reviewList, filterOption);
            numberOfCommits = filteredReviews.length;

            callback(numberOfCommits);
        })
    }

    function getMostCommitedProjects (filterOption, callback) {
        var filteredReviews;
        var mostCommitedProjects;

        getOpenAndMergedReviewsList(function (reviewList) {
            filteredReviews = util.getReviewsByFilter(reviewList, filterOption);
            mostCommitedProjects = util.getMostCommitedProjects(filteredReviews);

            callback(mostCommitedProjects);
        })
    }

    function getTopCommitters (filterOption, callback) {
        var filteredReviews;
        var topCommitters;

        getOpenAndMergedReviewsList(function (reviewList) {
            filteredReviews = util.getReviewsByFilter(reviewList, filterOption);
            topCommitters = util.getTopCommitters(filteredReviews);

            callback(topCommitters);
        })
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
                    var cachedData = getCacheData(cacheKey);
                    callback(null, cachedData);
                } else {
                    getTotalNumberOfProjects(function (totalNumberOfProjects) {
                        setCacheData(cacheKey, totalNumberOfProjects, cacheTTL);
                        callback(null, totalNumberOfProjects);
                    });
                }
            }
        }, function (err, results) {
            if (err) {
                new Error(err);
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

    function getStats (filter, limit, callback) {
        var numberOfCommits = null;
        var mostCommitedProjects = null;
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
                        setCacheData(cacheKey, numberOfCommits, cacheTTL);

                        callback(null, numberOfCommits);
                    });
                }
            },

            "getMostCommitedProjects": function (callback) {
                var cacheKey = cacheConfig[filter].mostCommittedProjects.key;
                var cacheTTL = cacheConfig[filter].mostCommittedProjects.TTL;

                if (isCached(cacheKey)) {
                    var cacheData = getCacheData(cacheKey);
                    callback(null, cacheData);
                } else {
                    getMostCommitedProjects(filter, function (projects) {
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
                    getTopReviewers(filter, function (topReviewers) {
                        setCacheData(cacheKey, topReviewers, cacheTTL);

                        callback(null, topReviewers);
                    });
                }
            }
        }, function (err, results) {
            if (err) {
                throw (err);
            } else {

                numberOfCommits = results.getNumberOfCommits;
                mostCommitedProjects = results.getMostCommitedProjects.splice(0, limit);
                topCommitters = results.getTopCommitters.splice(0, limit);
                topReviewers = results.getTopReviewers.splice(1, limit);

                var jsonData = {
                    "numberOfCommits": numberOfCommits,
                    "mostCommittedProjects": mostCommitedProjects,
                    "topCommitters": topCommitters,
                    "topReviewers": topReviewers
                };

                callback(jsonData);
            }
        });
    }

    return {
        "getStats": getStats,
        "getDashboard": getDashboard
    };
})();

module.exports = gerritAPI;
