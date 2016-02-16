module.exports = (function () {
    "use strict";

    function findObjectByProperty (array, property, value) {
        var arraySize = array.length;
        var obj = null;
        var result = null;

        for (var index = 0; index < arraySize; index++) {
            obj = array[index];

            if (obj) {
                if (obj[property] === value) {
                    result = index;
                    break;
                }
            }
        }

        return result;
    }

    return {
        "findObjectByProperty": findObjectByProperty
    }
})();
