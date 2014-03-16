"use strict";

var Exploder = require('./exploder.js');

// Private functions for setup
function addClasses(element, frame) {
  element.classList.add('frame');
  if (frame.disposal == 2) element.classList.add('disposal-restore');
}
var createImage = function (frame) {
    var image = new Image();
    image.src = frame.url;
    addClasses(image, frame);
    return image;
  },
  createDiv = function (frame) {
    var div = document.createElement("div");
    div.style.backgroundImage = "url(" + frame.url + ")";
    addClasses(div, frame);
    return div;
  };

var Playback = function (element, file, opts) {
  // Set up out instance variables
  this.element = element;
  this.onReady = opts.onReady;
  this.pingPong = opts.pingPong;
  this.fill = opts.fill;
  this.stopped = opts.stopped;

  new Exploder(file, (function (gif) {
    // Once we have the GIF data, add things to the DOM
    console.warn("Callbacks will hurt you. I promise.")
    this.gif = gif;

    this.element.innerHTML = "";
    var createFrameElement = createImage;//(this.fill) ? createDiv : createImage;
    gif.frames.map(createFrameElement)
      .forEach(this.element.appendChild, this.element);

    if (this.fill) requestAnimationFrame(this.scaleToFill.bind(this));

    this.onReady();
  }).bind(this));
};

Playback.prototype.scaleToFill = function () {
  var xScale = this.element.parentElement.offsetWidth / this.element.offsetWidth,
    yScale = this.element.parentElement.offsetHeight / this.element.offsetHeight;

  this.element.style.webkitTransform = "scale(" + Math.max(xScale, yScale) + ")";
}

Playback.prototype.setFrame = function (fraction, repeatCount) {
  var frameNr = (this.pingPong && repeatCount % 2 >= 1) ? this.gif.frameAt(1 - fraction) : this.gif.frameAt(fraction);
  this.element.dataset['frame'] = frameNr;
}

Playback.prototype.start = function () {
  console.log("START")
  this.stopped = false;
  if (this.animationLoop) this.animationLoop();
}

Playback.prototype.stop = function () {
  console.log("STOP")
  this.stopped = true;
}

Playback.prototype.startSpeed = function (speed, nTimes, endCb) {
  var gifLength = 10 * this.gif.length / speed,
    startTime = performance.now();
  this.animationLoop = (function () {
    var duration = performance.now() - startTime,
      repeatCount = duration / gifLength,
      fraction = repeatCount % 1;
    if (!nTimes || repeatCount < nTimes) {
      this.setFrame(fraction, repeatCount);

      if (!this.stopped) requestAnimationFrame(this.animationLoop);
    } else {
      this.setFrame(1.0, repeatCount);
      if (endCb) endCb();
    }
  }).bind(this);

  if (!this.stopped) this.start();
}

Playback.prototype.fromClock = function (beatNr, beatDuration, beatFraction) {
  var speedup = 2,
    lengthInBeats = Math.max(1, Math.round((1 / speedup) * 10 * this.gif.length / beatDuration)),
    subBeat = beatNr % lengthInBeats,
    repeatCount = beatNr / lengthInBeats,
    subFraction = (beatFraction / lengthInBeats) + subBeat / lengthInBeats;
  this.setFrame(subFraction, repeatCount);
}

Playback.prototype.startHardBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm,
    startTime = performance.now(),
    animationLoop = (function () {
      var duration = performance.now() - startTime,
        repeatCount = duration / beatLength,
        fraction = repeatCount % 1;
      this.setFrame(fraction, repeatCount);

      if (this.playing) requestAnimationFrame(animationLoop);
    }).bind(this);

  this.playing = true;
  animationLoop();
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

module.exports = Playback;
