var gulp  = require('gulp');
var config= require('../config');

gulp.task('watch', ['setWatch', 'browserSync'], function() {
  //gulp.watch(config.sass.src,   ['sass']);
  //gulp.watch(config.images.src, ['images']);
  //gulp.watch(config.markup.src, ['markup']);
});