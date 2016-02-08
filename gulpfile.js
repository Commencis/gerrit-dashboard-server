var gulp = require("gulp");
var eslint = require("gulp-eslint");
var del = require("del");

gulp.task("lint", function () {
    return gulp.src(
        [
            "**/*.js",
            "!node_modules/**/*"
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});

gulp.task("clean", function () {
    return del("dist");
});

var distribution = [
    "bin/**/*",
    "config/**/*",
    "core/**/*",
    "dashboard/**/*",
    "node_modules/**/*",
    "sources/**/*",
    "stats/**/*",
    "version/**/*",
    "app.js",
    "package.json",
    "routes.js",
    "util/**/*"
];

gulp.task("build", function () {
    return gulp
        .src(distribution, {"base": "./"})
        .pipe(gulp.dest("dist"));
});
