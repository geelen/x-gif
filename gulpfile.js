var gulp = require('gulp'),
  $ = require('gulp-load-plugins')();

gulp.task('js', function () {
  gulp.src('src/x-gif.js')
    .pipe($.plumber())
    .pipe($.browserify())
    .pipe(gulp.dest('dist'));
});

gulp.task('html', function () {
  gulp.src('src/*.html')
    .pipe(gulp.dest('dist'));
})

gulp.task('css', function () {
  gulp.src('src/x-gif.scss')
    .pipe($.sass())
    .pipe($.autoprefixer("last 2 versions", "> 1%"))
    .pipe(gulp.dest('dist'));
})

gulp.task('build', ['js', 'html', 'css']);

gulp.task('default', ['build'], function () {
  gulp.watch(['src/*.js'], ['js']);
  gulp.watch(['src/*.html'], ['html']);
  gulp.watch(['src/*.scss'], ['css']);
});
