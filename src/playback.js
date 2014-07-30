import Exploder from './exploder.js';

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
};

export default class Playback {
  constructor(xgif, element, file, opts) {
    // Set up out instance variables
    this.xgif = xgif;
    this.element = element;
    this.onReady = opts.onReady;
    this.pingPong = opts.pingPong;
    this.fill = opts.fill;
    this.stopped = opts.stopped;
    this.snap = opts.snap;
    this.nTimes = opts.nTimes;

    this.ready = new Promise((resolve, reject) => {
      var exploder = new Exploder(file)
      exploder.load().then((gif) => {
        // Once we have the GIF data, add things to the DOM
        console.debug("Received " + gif.frames.length + " frames of gif " + file)
        this.gif = gif;

        this.element.innerHTML = "";
        var createFrameElement = createImage;//(this.fill) ? createDiv : createImage;
        gif.frames.map(createFrameElement)
          .forEach(this.element.appendChild, this.element);

        if (this.fill) requestAnimationFrame(this.scaleToFill.bind(this));

        resolve();
      });
    })
  }

  scaleToFill() {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
      requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
      var xScale = this.element.parentElement.offsetWidth / this.element.offsetWidth,
        yScale = this.element.parentElement.offsetHeight / this.element.offsetHeight;

      this.element.style.webkitTransform = "scale(" + 1.1 * Math.max(xScale, yScale) + ")";
    }
  }

  setFrame(fraction, repeatCount) {
    var frameNr = (this.pingPong && repeatCount % 2 >= 1) ? this.gif.frameAt(1 - fraction) : this.gif.frameAt(fraction);
    this.element.dataset['frame'] = frameNr;
  }

  start() {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop) this.animationLoop();
  }

  stop() {
    this.stopped = true;
  }

  startSpeed(speed) {
    this.speed = speed;
    this.animationLoop = () => {
      // Calculate where we are in the GIF
      var gifLength = 10 * this.gif.length / this.speed,
        duration = performance.now() - this.startTime,
        repeatCount = duration / gifLength,
        fraction = repeatCount % 1;

      // If it's time to stop, set ourselves to the right frame (based on nTimes)
      // and fire an event (which adds the 'stopped' attribute)
      if (this.nTimes && repeatCount >= this.nTimes) {
        this.setFrame(this.nTimes % 1 || 1.0, repeatCount);
        this.element.dispatchEvent(new CustomEvent('x-gif-finished'), true);

      // Otherwise continue playing as normal, and request another animationFrame
      } else {
        this.setFrame(fraction, repeatCount);
        if (!this.stopped) requestAnimationFrame(this.animationLoop);
      }
    }

    if (!this.stopped) this.start();
  }

  fromClock(beatNr, beatDuration, beatFraction) {
    // Always bias GIFs to speeding up rather than slowing down, it looks better.
    var speedup = 1.5,
      lengthInBeats = this.snap ? 1 : Math.max(1, Math.round((1 / speedup) * 10 * this.gif.length / beatDuration)),
      subBeat = beatNr % lengthInBeats,
      repeatCount = beatNr / lengthInBeats,
      subFraction = (beatFraction / lengthInBeats) + subBeat / lengthInBeats;
    this.setFrame(subFraction, repeatCount);
  }

  changeBpm(bpm) {
    this.beatLength = 60 * 1000 / bpm;
  }

  startBpm(bpm) {
    this.changeBpm(bpm);
    this.animationLoop = () => {
      var duration = performance.now() - this.startTime,
        beatNr = Math.floor(duration / this.beatLength),
        beatFraction = (duration % this.beatLength) / this.beatLength;

      this.fromClock(beatNr, this.beatLength, beatFraction);

      if (!this.stopped) requestAnimationFrame(this.animationLoop);
    }

    if (!this.stopped) this.start();
  }
}
