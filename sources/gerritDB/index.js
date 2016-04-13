var debug = require("debug")("gerritDB");
var moment = require("moment");
var async = require("async");

var Connection = require("./Connection");
var cacheConfig = require("../../config/cache-config");
var filterOptions = require("../../config/filter-options");
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

    function doQuery (fn, query, callback) {
        var connection = Connection.connect();
        var debugStr = "[" + fn + "] ";

        debug(debugStr + query);

        connection.query(query, function (err, rows, fields) {
            if (err) {
                throw err;
            } else {
                debug(debugStr + "Returned number of records: " + rows.length);

                callback(rows);

                connection.end();
            }
        });
    }

    function getTotalNumberOfProjects (callback) {
        var query =
            `SELECT COUNT(DISTINCT dest_project_name) AS count
            FROM changes`;

        doQuery("getTotalNumberOfProjects", query, function (queryResult) {
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

        var query =
            `SELECT COUNT(*) AS Count, status AS reviewType
            FROM changes
            GROUP BY reviewType`;

        doQuery("getNumberOfReviews", query, function (queryResult) {
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

    function getNumberOfCommits (filterOption, callback) {
        var filterDate = getFilterDate(filterOption);
        var query =
            `SELECT COUNT(change_key) AS numberOfCommits
            FROM gerrit.changes
            WHERE changes.status != '${changeStatus.DRAFT}'
                AND date_format(changes.created_on, '%Y-%m-%d') >= '${filterDate}'`;

        doQuery("getNumberOfCommits", query, function (queryResult) {
            callback(queryResult);
        })
    }

    function getMostCommittedProjects (filterOption, callback) {
        var mostCommittedProjectsList = null;
        var filterDate = getFilterDate(filterOption);

        var query =
            `SELECT dest_project_name AS name, count(dest_project_name) AS commits
            FROM changes
            WHERE status != '${changeStatus.DRAFT}'
                AND date_format(changes.created_on, '%Y-%m-%d') >= '${filterDate}'
            GROUP BY name
            ORDER BY commits DESC`;

        doQuery("getMostCommittedProjects", query, function (queryResult) {
            mostCommittedProjectsList = queryResult;

            callback(mostCommittedProjectsList);
        })
    }

    function getTopCommitters (filterOption, callback) {
        var filterDate = getFilterDate(filterOption);
        var query =
            `SELECT full_name AS name, COUNT(change_key) AS commits
            FROM  gerrit.accounts, gerrit.changes
            WHERE changes.status != '${changeStatus.DRAFT}'
                AND date_format(changes.created_on, '%Y-%m-%d') >= '${filterDate}'
                AND changes.owner_account_id = accounts.account_id
            GROUP BY name
            ORDER BY commits DESC`;

        doQuery("getTopCommitters", query, function (queryData) {
            callback(queryData);
        })
    }

    function getAverageReviewInterval (callback) {
        var query =
            `SELECT created_on AS createdDate, last_updated_on AS updatedDate
            FROM gerrit.changes
            WHERE status = '${changeStatus.MERGED}'`;

        doQuery("getAverageReviewInterval", query, function (queryResult) {
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
        var query =
            `SELECT full_name,
                dest_project_name,
                patch_set_approvals.value
            FROM patch_set_approvals
                INNER JOIN changes ON patch_set_approvals.change_id = changes.change_id
                INNER JOIN accounts ON patch_set_approvals.account_id = accounts.account_id
            WHERE DATE_FORMAT(patch_set_approvals.granted, '%Y-%m-%d') >= '${filterDate}'
                AND patch_set_approvals.category_id = 'Code-Review'
                AND changes.owner_account_id != accounts.account_id`;

        doQuery("getTopReviewers", query, function (queryResult) {
            callback(queryResult);
        })
    }

    /*
     * Generated view that named PatchSet is responsible for getting creation time of each patchset.
     * MergeStatisticsView is responsible for finding the merge time related to patch.
     * Mathematical functions that used for calculating to best matching time duration between creation time
     * and first action time.
     *
     * TODO: Onboarding and other possible disallowed projects should be configurable.
     */
    function getAverageMergeDurationByProject (filterOption, callback) {
        var query =
            `SELECT Project, AVG(MergeProcessTime) AvgMergeDuration FROM (
                SELECT RealDiff,WorkingDayDiff,ChangeID, Project, CreatedTime, MergeTime,
                    CASE WorkingDayDiff
                       WHEN 0 THEN MergeTime
                       ELSE DATE_SUB(MergeTime ,
                           INTERVAL (((RealDiff-WorkingDayDiff)*24 +(WorkingDayDiff *14)))HOUR)
                    END calculatedMergeTime,
                    TIMESTAMPDIFF(SECOND,CreatedTime,
                    CASE WorkingDayDiff
                       WHEN 0 THEN MergeTime
                       ELSE DATE_SUB(MergeTime, INTERVAL (((RealDiff-WorkingDayDiff)*24 +(WorkingDayDiff*14)))HOUR)
                    END) / 60 MergeProcessTime
                FROM (
                    SELECT DATEDIFF(MAX(Changes.last_updated_on),PatchSet.createdTime) RealDiff,
                       dest_project_name Project,
                       ABS(5 * (DATEDIFF(PatchSet.createdTime, MAX(Changes.last_updated_on)) DIV 7) +
                       MID('0123444401233334012222340111123400012345001234550', 7 * WEEKDAY(PatchSet.createdTime) +
                       WEEKDAY(MAX(Changes.last_updated_on)) + 1, 1))  WorkingDayDiff,
                       PatchSet.change_id ChangeID, PatchSet.patch_set_id,
                       MAX(Changes.last_updated_on) MergeTime,PatchSet.createdTime CreatedTime
                    FROM change_messages Message
                       INNER JOIN changes Changes ON Changes.change_id = Message.change_id
                       INNER JOIN
                           (
                               SELECT patches.change_id,patch_set_id,uploader_account_id account_id,
                                   MIN(patches.created_on) AS createdTime
                               FROM gerrit.patch_sets patches
                                   INNER JOIN changes ON changes.change_id=patches.change_id AND changes.status='M'
                               GROUP BY patches.change_id,patch_set_id,uploader_account_id
                           ) AS PatchSet ON PatchSet.change_id = Message.patchset_change_id AND
                       PatchSet.patch_set_id = Message.patchset_patch_set_id AND PatchSet.patch_set_id =1
                    WHERE Message.author_id NOT IN (${filterOptions.DISALLOWED_USERIDS})
                    GROUP BY PatchSet.change_id,PatchSet.patch_set_id
               ) AS MergeStatisticsView
            ) ProjectMerge
            WHERE Project NOT LIKE '%Onboarding%'
            GROUP BY Project`;

        doQuery("getAverageMergeDurationByProject", query, function (queryResult) {
            callback(queryResult);
        })
    }

    /*
     * Generated view that named PatchSet is responsible for getting creation time of each patchset.
     * FirstReviewActionTimeView is responsible for finding the first review/comment time related to patch from
     * other reviewers(accounts except patchset owner and Jenkins accounts).
     * Mathematical functions that used for calculating to best matching time duration between creation time
     * and first action time.
     *
     * TODO: Onboarding and other possible disallowed projects should be configurable.
     */
    function getAverageFirstReviewDurationByProject (filterOption, callback) {
        var query =
            `SELECT Project, AVG(FirstReviewTime) AvgFirstReviewDuration FROM (
                SELECT RealDiff,WorkingDayDiff,ChangeID, Project, CreatedTime,
                    CASE WorkingDayDiff
                        WHEN 0 THEN FirstReviewTime
                            ELSE DATE_SUB(FirstReviewTime,
                            INTERVAL (((RealDiff-WorkingDayDiff)*24 +(WorkingDayDiff *14)))HOUR)
                        END calculatedFirstReviewTime,
                    TIMESTAMPDIFF(SECOND,CreatedTime,
                    CASE WorkingDayDiff
                        WHEN 0 THEN FirstReviewTime
                        ELSE DATE_SUB(FirstReviewTime,INTERVAL(((RealDiff-WorkingDayDiff)*24 +
                        (WorkingDayDiff*14)))HOUR)
                    END) / 60 FirstReviewTime
                FROM (
                    SELECT DATEDIFF(MIN(Message.written_on),PatchSet.createdTime) RealDiff,
                        dest_project_name Project,
                        ABS(5 * (DATEDIFF(PatchSet.createdTime, MIN(Message.written_on)) DIV 7) +
                        MID('0123444401233334012222340111123400012345001234550', 7 * WEEKDAY(PatchSet.createdTime) +
                        WEEKDAY(MIN(Message.written_on)) + 1, 1))  WorkingDayDiff,
                        PatchSet.change_id ChangeID, PatchSet.patch_set_id, PatchSet.createdTime CreatedTime,
                        MIN(Message.written_on) FirstReviewTime
                    FROM gerrit.change_messages Message
                        INNER JOIN gerrit.changes Changes ON Changes.change_id = Message.change_id
                        INNER JOIN
                            (
                                SELECT patches.change_id,patch_set_id,uploader_account_id account_id,
                                    MIN(patches.created_on) AS createdTime
                                FROM gerrit.patch_sets patches
                                    INNER JOIN gerrit.changes changes ON changes.change_id=patches.change_id
                                GROUP BY patches.change_id,patch_set_id,uploader_account_id
                            ) AS PatchSet ON PatchSet.change_id = Message.patchset_change_id AND
                        PatchSet.patch_set_id = Message.patchset_patch_set_id
                    WHERE Message.author_id NOT IN (${filterOptions.DISALLOWED_USERIDS})
                        AND PatchSet.account_id <> Message.author_id
                    GROUP BY PatchSet.change_id,PatchSet.patch_set_id
                ) AS FirstReviewActionTimeView
            ) ProjectReview
            WHERE Project NOT LIKE '%Onboarding%'
            GROUP BY Project`;

        doQuery("getAverageFirstReviewDurationByProject", query, function (queryResult) {
            callback(queryResult);
        })
    }

    function getStats (filter, limit, callback) {
        var numberOfCommits = null;
        var mostCommittedProjects = null;
        var topCommitters = null;
        var topReviewers = null;
        var avgMergeDurationByProject = null;
        var avgFirstReviewDurationByProject = null;

        async.parallel({
            "getAverageMergeDurationByProject": function (callback) {
                var cacheKey = cacheConfig.getAverageMergeDurationByProject.key;
                var cacheTTL = cacheConfig.getAverageMergeDurationByProject.TTL;

                if (isCached(cacheKey)) {
                    var cached = getCacheData(cacheKey);

                    callback(null, cached);
                } else {
                    getAverageMergeDurationByProject(filter, function (averageMergeDurations) {
                        setCacheData(cacheKey, averageMergeDurations, cacheTTL);
                        callback(null, averageMergeDurations);
                    });
                }
            },
            "getAverageFirstReviewDurationByProject": function (callback) {
                var cacheKey = cacheConfig.getAverageFirstReviewDurationByProject.key;
                var cacheTTL = cacheConfig.getAverageFirstReviewDurationByProject.TTL;

                if (isCached(cacheKey)) {
                    var cached = getCacheData(cacheKey);

                    callback(null, cached);
                } else {
                    getAverageFirstReviewDurationByProject(filter, function (averageFirstReviewDurations) {
                        setCacheData(cacheKey, averageFirstReviewDurations, cacheTTL);
                        callback(null, averageFirstReviewDurations);
                    });
                }
            },
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
                    avgMergeDurationByProject = results.getAverageMergeDurationByProject.slice(0, limit);
                    avgFirstReviewDurationByProject = results.getAverageFirstReviewDurationByProject.slice(0, limit);

                } else {
                    numberOfCommits = results.getNumberOfCommits;
                    mostCommittedProjects = results.getMostCommittedProjects;
                    topCommitters = results.getTopCommitters;
                    topReviewers = results.getTopReviewers;
                    avgMergeDurationByProject = results.getAverageMergeDurationByProject;
                    avgFirstReviewDurationByProject = results.getAverageFirstReviewDurationByProject;
                }

                var jsonData = {
                    "numberOfCommits": numberOfCommits,
                    "mostCommittedProjects": mostCommittedProjects,
                    "topCommitters": topCommitters,
                    "topReviewers": topReviewers,
                    "avgMergeTime": avgMergeDurationByProject,
                    "avgFirstReviewTime": avgFirstReviewDurationByProject
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
