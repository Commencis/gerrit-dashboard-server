var express = require("express");
var router = express.Router();

router.use("/dashboard", require("./dashboard/routes"));
router.use("/stats", require("./stats/routes"));
router.use("/version", require("./version/routes"));

module.exports = router;