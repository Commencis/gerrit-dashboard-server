var express = require("express");
var router = express.Router();

var views = require("./views");

router
    .get("/", views.getStats);

module.exports = router;