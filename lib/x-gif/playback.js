export default class Playback {
  constructor(gif, renderer, opts) {
    this.onReady = opts.onReady;
    this.pingPong = opts.pingPong;
    this.stopped = opts.stopped;
    this.snap = opts.snap;
    this.nTimes = opts.nTimes;

    this.gif = gif;
    this.renderer = renderer;
  }


  setFrame(fraction, repeatCount) {
    var frameNr = (this.pingPong && repeatCount % 2 >= 1) ? this.gif.frameAt(1 - fraction) : this.gif.frameAt(fraction);
    this.renderer.setFrame(frameNr)
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
        this.renderer.emit('x-gif-finished')

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
      lengthInBeats = this.snap ? 1 : Math.max(1, Math.min(16, Math.round((1 / speedup) * 10 * this.gif.length / beatDuration))),
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
