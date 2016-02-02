var express = require("express");

var views = require("./views");
var router = express.Router();

router
    .get("/", views.getDashboardData);

module.exports = router;