"use strict";

exports.injectExcludedProjectsIntoSql = function (excludedProjects, projectColumnName) {
    var colName = projectColumnName || "dest_project_name";
    var sql = "";

    if (!excludedProjects || excludedProjects.length === 0) {
        return " true "; // don't fail conditions
    }

    excludedProjects.forEach(function (project, i) {
        if (i === 0) {
            sql += ` ${colName} NOT LIKE '%${project}%' `;
        } else {
            sql += ` AND ${colName} NOT LIKE '%${project}%' `;
        }
    });

    return sql;
}
