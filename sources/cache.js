var NodeCache = require("node-cache");

var cache = (function () {
    "use strict";

    var cache = new NodeCache();

    function setCacheData (key, value, ttl) {
        cache.set(key, value, ttl);
    }

    function getCacheData (key) {
        var cacheData = cache.get(key);

        return cacheData === undefined ? null : cacheData;
    }

    function isCached (key) {
        var value = cache.get(key);

        return value !== undefined;
    }

    return {
        "setCacheData": setCacheData,
        "getCacheData": getCacheData,
        "isCached": isCached
    }
})();

module.exports = cache;
