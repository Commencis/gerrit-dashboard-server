var moment = require("moment");

var datetimeConfig = require("../config/datetime-config");

function getFilterDate (filterOption) {
    "use strict";

    var filterDate = null;

    var FILTER_OPTIONS = {
        "TODAY": "TODAY",
        "THIS_WEEK": "THIS_WEEK",
        "THIS_MONTH": "THIS_MONTH",
        "LAST_30_DAYS": "LAST_30_DAYS",
        "LAST_6_MONTHS": "LAST_6_MONTHS"
    };
    var DATE_FORMAT = datetimeConfig.DATE_FORMAT;

    var todayDate = moment().format(DATE_FORMAT);
    var startDayOfThisWeek = moment().startOf("isoweek").format(DATE_FORMAT);
    var startDayOfThisMonth = moment().startOf("month").format(DATE_FORMAT);
    var dateOf30DaysAgo = moment().subtract(30, "days").format(DATE_FORMAT);
    var dateOf6Monthsago = moment().subtract(6, "months").format(DATE_FORMAT);

    if (filterOption === FILTER_OPTIONS.TODAY) {
        filterDate = todayDate;
    } else if (filterOption === FILTER_OPTIONS.THIS_WEEK) {
        filterDate = startDayOfThisWeek;
    } else if (filterOption === FILTER_OPTIONS.THIS_MONTH) {
        filterDate = startDayOfThisMonth;
    } else if (filterOption === FILTER_OPTIONS.LAST_30_DAYS) {
        filterDate = dateOf30DaysAgo;
    } else if (filterOption === FILTER_OPTIONS.LAST_6_MONTHS) {
        filterDate = dateOf6Monthsago;
    }

    return filterDate
}

exports.getFilterDate = getFilterDate;
