"use strict";

var Exploder = require('./exploder.js');

var Playback = function (el, file, cb) {
  this.el = el;
  this.cb = cb;

  new Exploder(file, this.afterExploded.bind(this));
};

Playback.prototype.afterExploded = function (gif) {
  console.warn("Callbacks will hurt you. I promise.")
  this.gif = gif;

  this.el.innerHTML = "";
  gif.frames.forEach(function (frame) {
    var image = new Image();
    image.src = frame.url;
    this.el.appendChild(image);
  }, this)

  this.cb();
}

Playback.prototype.setFrame = function (frameNr) {
  // TODO: Fix when I upgrade sass
  this.el.className = "frame-" + frameNr;
//  this.el.dataset['frame'] = frameNr;
}

Playback.prototype.stop = function () {
  this.playing = false;
}

Playback.prototype.startSpeed = function (speed) {
  var gifLength = 10 * this.gif.length / speed,
    startTime = performance.now(),
    animationLoop = (function () {
      var duration = performance.now() - startTime;
      var fraction = duration / gifLength % 1;
      this.setFrame(this.gif.frameAt(fraction));

      if (this.playing) requestAnimationFrame(animationLoop);
    }).bind(this);

  this.playing = true;
  animationLoop();
}

Playback.prototype.fromClock = function (beatNr, beatDuration, beatFraction) {
  var speedup = 2,
    lengthInBeats = Math.max(1, Math.round((1 / speedup) * 10 * this.gif.length / beatDuration)),
    subBeat = beatNr % lengthInBeats,
    subFraction = (beatFraction / lengthInBeats) + subBeat / lengthInBeats;
  this.setFrame(this.gif.frameAt(subFraction))
}

Playback.prototype.startBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm,
    startTime = performance.now(),
    animationLoop = (function () {
      var duration = performance.now() - startTime,
        beatNr = Math.floor(duration / beatLength),
        beatFraction = (duration % beatLength) / beatLength;

      this.fromClock(beatNr, beatLength, beatFraction);

      if (this.playing) requestAnimationFrame(animationLoop);
    }).bind(this);

  this.playing = true;
  animationLoop();
}

Playback.prototype.startHardBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm,
    startTime = performance.now(),
    animationLoop = (function () {
      var duration = performance.now() - startTime;
      var fraction = duration / beatLength % 1;
      this.setFrame(this.gif.frameAt(fraction));

      if (this.playing) requestAnimationFrame(animationLoop);
    }).bind(this);

  this.playing = true;
  animationLoop();
}

Playback.prototype.startBpm;
Playback.prototype.startBeats;

module.exports = Playback;
