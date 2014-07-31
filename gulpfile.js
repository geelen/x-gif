var gulp = require('gulp'),
  es6ify = require('es6ify'),
  $ = require('gulp-load-plugins')();

gulp.task('js', function () {
  gulp.src([
    'src/x-gif.js',
    'src/x-gif.angular.js',
    'src/x-gif.raw.js'
  ])
    .pipe($.plumber())
    .pipe($.browserify({
      add: [ es6ify.runtime ],
      transform: ['es6ify']
    }))
    .pipe($.uglify())
    .pipe(gulp.dest('dist'));
});

gulp.task('html', function () {
  gulp.src('src/x-gif.html')
    .pipe($.rename('x-gif.local.html'))
    .pipe(gulp.dest('dist'));
})

gulp.task('css', function () {
  gulp.src('src/x-gif.scss')
    .pipe($.rubySass())
    .pipe($.autoprefixer("last 2 versions", "> 1%"))
    .pipe(gulp.dest('dist'));
})

gulp.task('vulcanize', function () {
  gulp.src('dist/x-gif.local.html')
    .pipe($.vulcanize({dest: 'dist', inline: true}))
    .pipe($.rename('x-gif.html'))
    .pipe(gulp.dest('dist'));
})

gulp.task('copy', function () {
  gulp.src([
    'bower_components/platform/platform.js',
    'bower_components/polymer/polymer*',
    'bower_components/polymer/layout*',
  ])
    .pipe(gulp.dest('dist'));
});

gulp.task('build', ['js', 'html', 'css', 'copy', 'vulcanize']);

gulp.task('default', ['build', 'connect'], function () {
  gulp.watch(['src/*.*js'], ['js']);
  gulp.watch(['src/*.html'], ['html']);
  gulp.watch(['src/*.scss'], ['css']);
  gulp.watch(['bower_components'], ['copy']);
  gulp.watch(['dist/x-gif.local.html', 'dist/x-gif.js', 'dist/x-gif.css'], ['vulcanize']);

  gulp.watch(['index.html', 'dist/**.*', 'demos/**.*'], function (event) {
    return gulp.src(event.path)
      .pipe($.connect.reload());
  });
});

gulp.task('connect', function () {
  $.connect.server({
    root: [__dirname],
    port: 1983,
    livereload: {port: 2983}
  })
});
