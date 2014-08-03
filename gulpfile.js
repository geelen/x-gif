var gulp = require('gulp'),
  es6ify = require('es6ify'),
  $ = require('gulp-load-plugins')();

gulp.task('js', function () {
  return gulp.src('src/x-gif.js')
    .pipe($.plumber())
    .pipe($.browserify({
      add: [ es6ify.runtime ],
      transform: ['es6ify']
    }))
    .pipe($.uglify())
    .pipe(gulp.dest('build'));
});

gulp.task('vulcan', ['js', 'css'], function () {
  return gulp.src('src/x-gif.html')
    .pipe(gulp.dest('build'))
    .pipe($.vulcanize({dest: 'dist/x-gif', inline: true}))
    .pipe(gulp.dest('dist/x-gif'));
})

gulp.task('css', function () {
  return gulp.src('src/x-gif.scss')
    .pipe($.rubySass())
    .pipe($.autoprefixer("last 2 versions", "> 1%"))
    .pipe(gulp.dest('build'));
});

gulp.task('jade', function () {
  return gulp.src(['src/examples/**/*.jade', '!src/examples/**/_*.jade'])
    .pipe($.jade({pretty: true}))
    .pipe(gulp.dest('dist'))
});

gulp.task('assets', function () {
  return gulp.src('src/examples/assets/**')
    .pipe(gulp.dest('dist/assets'))
});

gulp.task('build', ['vulcan', 'jade', 'assets'], function () {
});

gulp.task('clean', function () {
  return gulp.src(['x-gif.html', 'build', 'dist'], {read: false})
    .pipe($.clean())
})

gulp.task('default', ['build', 'connect'], function () {
  gulp.watch(['src/x-gif.html', 'src/**/*.js', 'src/*.scss'], ['vulcan']);
  gulp.watch(['src/examples/**/*.jade'], ['jade']);
  gulp.watch(['src/examples/assets/**'], ['assets']);

  gulp.watch(['dist/**'], function (event) {
    return gulp.src(event.path)
      .pipe($.connect.reload());
  });
});

gulp.task('connect', function () {
  $.connect.server({
    root: ['dist'],
    port: 1983,
    livereload: {port: 2983}
  })
});
