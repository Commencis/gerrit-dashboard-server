var moment = require("moment");

var index = require("../../core/index");
var datetimeConfig = require("../../config/datetime-config");

var util = (function () {
    "use strict";

    var DATE_FORMAT = datetimeConfig.DATE_FORMAT;
    var getFilterDate = index.getFilterDate;

    function getMostCommitedProjects (projectList) {
        var mostCommitedProjects = [];
        var projectListSize = projectList.length;

        // Calculates projects frequencies
        for (var projectIndex = 0; projectIndex < projectListSize; projectIndex++) {
            var frequency = 0;
            var project = projectList[projectIndex].project;

            if (project !== "explored") {
                for (var exploredProjectIndex = 0; exploredProjectIndex < projectListSize; exploredProjectIndex++) {
                    if (projectList[exploredProjectIndex].project === project) {
                        frequency++;
                        projectList[exploredProjectIndex].project = "explored";
                    }
                }
                mostCommitedProjects.push({"name": project, "commits": frequency});
            }
        }

        // Array sorting by descending order
        mostCommitedProjects.sort(function (projectFrequencyObj, anotherProjectFrequencyObj) {
            return anotherProjectFrequencyObj.commits - projectFrequencyObj.commits;
        });

        return mostCommitedProjects;
    }

    function getTopCommitters (reviewList) {
        var topCommitters = [];
        var reviewListSize = reviewList.length;

        for (var reviewIndex = 0; reviewIndex < reviewListSize; reviewIndex++) {
            var frequency = 0;
            var committer = reviewList[reviewIndex].owner.name;

            if (committer !== "explored") {
                for (var unexploredReviewIndex = 0; unexploredReviewIndex < reviewListSize; unexploredReviewIndex++) {
                    if (reviewList[unexploredReviewIndex].owner.name === committer) {
                        frequency++;
                        reviewList[unexploredReviewIndex].owner.name = "explored";
                    }
                }
                topCommitters.push({"name": committer, "commits": frequency});
            }
        }

        topCommitters.sort(function (commitFrequencyObj, anotherCommitFrequencyObj) {
            return anotherCommitFrequencyObj.commits - commitFrequencyObj.commits;
        });

        return topCommitters;
    }

    function getTopReviewers (reviewerList) {
        var topReviewers = [];
        var reviewerListSize = reviewerList.length;

        for (var reviewerIndex = 0; reviewerIndex < reviewerListSize; reviewerIndex++) {
            var frequency = 0;
            var reviewer = reviewerList[reviewerIndex];

            if (reviewer !== "explored") {
                for (var unexploredReviewer = 0; unexploredReviewer < reviewerListSize; unexploredReviewer++) {
                    if (reviewerList[unexploredReviewer] === reviewer) {
                        frequency++;
                        reviewerList[unexploredReviewer] = "explored";
                    }
                }
                topReviewers.push({"name": reviewer, "reviews": frequency});
            }
        }

        topReviewers.sort(function (reviewerFrequencyObj, anotherReviewerFrequencyObj) {
            return anotherReviewerFrequencyObj.reviews - reviewerFrequencyObj.reviews;
        });

        return topReviewers;
    }

    function getReviewsByFilter (reviewList, filterOption) {
        var filteredList = [];
        var filterDate = getFilterDate(filterOption);

        for (var review in reviewList) {
            if (reviewList.hasOwnProperty(review)) {
                var createdDateOfReview = reviewList[review].created;
                var formatedCreatedDateOfReview = moment(createdDateOfReview).format(DATE_FORMAT);

                if (formatedCreatedDateOfReview >= filterDate) {
                    filteredList.push(reviewList[review]);
                }
            }
        }

        return filteredList;
    }

    return {
        "getMostCommitedProjects": getMostCommitedProjects,
        "getTopCommitters": getTopCommitters,
        "getTopReviewers": getTopReviewers,
        "getReviewsByFilter": getReviewsByFilter
    };
})();

module.exports = util;
