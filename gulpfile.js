var gulp = require('gulp'),
  es6ify = require('es6ify'),
  $ = require('gulp-load-plugins')();

gulp.task('js', function () {
  gulp.src('src/x-gif.js')
    .pipe($.plumber())
    .pipe($.browserify({
      add: [ es6ify.runtime ],
      transform: ['es6ify']
    }))
    .pipe(gulp.dest('build/x-gif'))
    .pipe($.uglify())
    .pipe(gulp.dest('dist/x-gif'));
});

gulp.task('html', function () {
  gulp.src('src/x-gif.html')
    .pipe(gulp.dest('build/x-gif'))
    .pipe($.rename('x-gif.local.html'))
    .pipe(gulp.dest('dist/x-gif'));
});

gulp.task('vulcan', function () {
  gulp.src('dist/x-gif/x-gif.local.html')
    .pipe($.rename('x-gif.html'))
    .pipe(gulp.dest('dist/x-gif'))
    .pipe($.vulcanize({dest: 'dist/x-gif', inline: true}))
    .pipe(gulp.dest('dist/x-gif'));
})

gulp.task('css', function () {
  gulp.src('src/x-gif.scss')
    .pipe($.rubySass())
    .pipe($.autoprefixer("last 2 versions", "> 1%"))
    .pipe(gulp.dest('build/x-gif'))
    .pipe(gulp.dest('dist/x-gif'));
});

gulp.task('jade', function () {
  gulp.src(['src/examples/**/*.jade', '!src/examples/**/_*.jade'])
    .pipe($.jade({pretty: true}))
    .pipe(gulp.dest('build'))
    .pipe(gulp.dest('dist'))
});

gulp.task('build', ['js', 'html', 'css', 'jade'], function () {
});

gulp.task('release', ['vulcan']);

gulp.task('clean', function () {
  gulp.src(['x-gif.html', 'build', 'dist'], {read: false})
    .pipe($.clean())
})

gulp.task('default', ['build', 'connect'], function () {
  gulp.watch(['src/**/*.js'], ['js']);
  gulp.watch(['src/*.html'], ['html']);
  gulp.watch(['src/*.scss'], ['css']);
  gulp.watch(['dist/x-gif/x-gif.local.html', 'dist/x-gif/x-gif.js', 'dist/x-gif/x-gif.css'], ['vulcan']);

  gulp.watch(['build/**'], function (event) {
    return gulp.src(event.path)
      .pipe($.connect.reload());
  });
});

gulp.task('connect', function () {
  $.connect.server({
    root: ['build'],
    port: 1983,
    livereload: {port: 2983}
  })
});
