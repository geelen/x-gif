"use strict";

import macros from './macros.sjs';

window.Rx = require('rx');
require('rx-dom');

var SpeedStrategy = Rx.Observable.generate(
  0, () => true,
  x => (Math.random() > 0.9) ? x + 1 : x,
  x => x,
  Rx.Scheduler.requestAnimationFrame);

var sub = SpeedStrategy.distinctUntilChanged().subscribe(function (x) {
  console.log("SUB1 " + x);
  if (x > 10) sub.dispose();
});

var PlaybackStrategies = {
  speed: SpeedStrategy
};

module.exports = PlaybackStrategies;
