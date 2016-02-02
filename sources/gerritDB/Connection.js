var mysql = require("mysql");

var app = require("../../app");

var Connection = (function () {
    "use strict";

    var appConfigPath = app.get("APP_CONFIG_PATH");
    var databaseConfig;
    var connection = null;

    if (process.env.NODE_ENV === "development") {
        databaseConfig = require(appConfigPath + "/database_config_development.json");
    } else {
        databaseConfig = require(appConfigPath + "/database_config_production.json");
    }

    function connect () {
        connection = mysql.createConnection({
            "host": databaseConfig.host,
            "user": databaseConfig.user,
            "password": databaseConfig.password,
            "database": databaseConfig.database
        });

        connection.connect(function (err) {
            if (err) {
                throw err.stack;
            }
        });

        return connection;
    }

    return {
        "connect": connect
    };
})();

module.exports = Connection;