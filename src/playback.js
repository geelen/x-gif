"use strict";

var Exploder = require('./exploder.js');

var Playback = function (el, file, cb) {
  this.exploder = new Exploder(file, function () {
    console.warn("Callbacks will hurt you. I promise.")

    cb();
  });
};

Playback.prototype.startLoop = function (speed) {
  console.log("OK")
}

module.exports = Playback;
