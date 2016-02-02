var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var corsConfig = require("./config/cors");
var cors = require("cors");

var app = module.exports = express();

app.set("APP_CONFIG_PATH", process.env.GERRIT_DASHBOARD_CONFIG_PATH || __dirname + "/config");

var routes = require("./routes");

// view engine setup
app.set("x-powered-by", false);

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({"extended": false}));
app.use(cors(corsConfig));

app.use("/", routes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error("Not Found");
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.send(err.message);
        console.log(err.stack);
    });
}
