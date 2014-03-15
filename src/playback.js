"use strict";

var Exploder = require('./exploder.js');

var Playback = function (el, file, cb) {
  this.exploder = new Exploder(file, function (frames) {
    console.warn("Callbacks will hurt you. I promise.")
    console.log(frames.length)

    el.innerHTML = "";
    frames.forEach(function (frame) {
      var image = new Image();
      image.src = frame.url;
      el.appendChild(image);
    })

    cb();
  });
};

Playback.prototype.startLoop = function (speed) {
  console.log("OK")
}

module.exports = Playback;
