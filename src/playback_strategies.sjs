"use strict";

import macros from './macros.sjs';

window.Rx = require('rx');
require('rx-dom');

var SpeedStrategy = (gif, speed) => {
  var gifLength = 10 * gif.length / speed,
    startTime = performance.now();

  return Rx.Observable.generate(
    0, () => true,
    () => {
      var duration = performance.now() - startTime,
        repeatCount = duration / gifLength,
        fraction = repeatCount % 1;
      return gif.frameAt(fraction);
    },
    x => x,
    Rx.Scheduler.requestAnimationFrame);
};

var PlaybackStrategies = {
  speed: SpeedStrategy
};

module.exports = PlaybackStrategies;
