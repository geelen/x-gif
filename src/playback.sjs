"use strict";

import macros from './macros.sjs';
var Exploder = require('./exploder.js');

var Playback = function (xgif, domUpdater, file, opts) {
  // Set up out instance variables
  this.xgif = xgif;
  this.domUpdater = domUpdater;
  this.onReady = opts.onReady;
  this.pingPong = opts.pingPong;
  this.fill = opts.fill;
  this.stopped = opts.stopped;

  new Exploder(file, (gif) => {
    // Once we have the GIF data, add things to the DOM
    console.warn("Callbacks will hurt you. I promise.")
    console.log("Received " + gif.frames.length + " frames of gif " + file)
    this.gif = gif;

    this.domUpdater.initNewGif(gif);

    this.onReady();
  });
};

Playback.prototype.setFrame = function (fraction, repeatCount) {
  var frameNr = (this.pingPong && repeatCount % 2 >= 1) ? this.gif.frameAt(1 - fraction) : this.gif.frameAt(fraction);
  this.domUpdater.setFrame(frameNr);
}

Playback.prototype.start = function () {
  this.stopped = false;
  this.startTime = performance.now();
  if (this.animationLoop) this.animationLoop();
}

Playback.prototype.stop = function () {
  this.stopped = true;
}

Playback.prototype.startSpeed = function (speed, nTimes) {
  this.speed = speed;
  this.animationLoop = () => {
    var gifLength = 10 * this.gif.length / this.speed,
      duration = performance.now() - this.startTime,
      repeatCount = duration / gifLength,
      fraction = repeatCount % 1;
    if (!nTimes || repeatCount < nTimes) {
      this.setFrame(fraction, repeatCount);

      if (!this.stopped) requestAnimationFrame(this.animationLoop);
    } else {
      this.setFrame(nTimes % 1 || 1.0, repeatCount);
      this.xgif.fire('x-gif-finished');
    }
  }

  if (!this.stopped) this.start();
}

Playback.prototype.fromClock = function (beatNr, beatDuration, beatFraction) {
  var speedup = 1.5,
    lengthInBeats = Math.max(1, Math.round((1 / speedup) * 10 * this.gif.length / beatDuration)),
    subBeat = beatNr % lengthInBeats,
    repeatCount = beatNr / lengthInBeats,
    subFraction = (beatFraction / lengthInBeats) + subBeat / lengthInBeats;
  this.setFrame(subFraction, repeatCount);
}

Playback.prototype.startHardBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm;
  this.animationLoop = () => {
    var duration = performance.now() - this.startTime,
      repeatCount = duration / beatLength,
      fraction = repeatCount % 1;
    this.setFrame(fraction, repeatCount);

    if (!this.stopped) requestAnimationFrame(this.animationLoop);
  }

  if (!this.stopped) this.start();
}

Playback.prototype.startBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm;
  this.animationLoop = () => {
    var duration = performance.now() - this.startTime,
      beatNr = Math.floor(duration / beatLength),
      beatFraction = (duration % beatLength) / beatLength;

    this.fromClock(beatNr, beatLength, beatFraction);

    if (!this.stopped) requestAnimationFrame(this.animationLoop);
  }

  if (!this.stopped) this.start();
}

module.exports = Playback;
