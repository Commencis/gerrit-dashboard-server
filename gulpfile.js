var gulp = require("gulp");
var eslint = require("gulp-eslint");
var del = require("del");
var shell = require("gulp-shell");
var pkg = require("./package");

gulp.task("lint", function () {
    return gulp.src(
        [
            "**/*.js",
            "!dist/**/*",
            "!node_modules/**/*"
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});

gulp.task("clean", function () {
    return del.sync("dist");
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

gulp.task("build", ["clean"], function () {
    return gulp
        .src(distribution, {"base": "./"})
        .pipe(gulp.dest("dist"));
});

gulp.task("docker", function () {
    var email = process.env.DOCKER_EMAIL;
    var username = process.env.DOCKER_USERNAME;
    var password = process.env.DOCKER_PASSWORD;
    var imageName = process.env.DOCKER_IMAGE_NAME || "gerritdashboard-server";
    var version = pkg.version;

    if (!email) {
        throw new Error("DOCKER_EMAIL undefined!");
    }

    if (!username) {
        throw new Error("DOCKER_USERNAME undefined!");
    }

    if (!password) {
        throw new Error("DOCKER_PASSWORD undefined!");
    }

    return shell.task([
        `docker build -t ${imageName}:${version} .`,
        `docker tag ${imageName}:${version} ${imageName}:latest`,
        `docker login -e="${email}" -u="${username}" -p="${password}"`,
        `docker push ${imageName}:${version}`,
        `docker push ${imageName}:latest`,
    ])();
});

gulp.task("default", ["lint", "build"]);
