"use strict";

import macros from './macros.sjs';

window.Rx = require('rx');
require('rx-dom');

var SpeedStrategy = Rx.Observable.generate(
  0,
  function () { return true; },
  function (x) { return (Math.random() > 0.9) ? x + 1 : x; },
  function (x) { return x; },
  Rx.Scheduler.requestAnimationFrame);

SpeedStrategy.distinctUntilChanged().subscribe(function (x) {
  console.log("SUB1 " + x);
});

var PlaybackStrategies = {
  speed: SpeedStrategy
};

module.exports = PlaybackStrategies;
