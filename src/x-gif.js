"use strict";

var Playback = require('./playback.js');

var Strategies = {
  speed: function () {
    this.playback.startSpeed(this.speed, this['n-times'], (function () {
      this.fire('x-gif-stopped')
    }).bind(this));
  },
  hardBpm: function () {
    this.playback.startHardBpm(this['hard-bpm']);
  },
  bpm: function () {
    this.playback.startBpm(this.bpm);
  },
  noop: function () {
  }
}

Polymer('x-gif', {
  ready: function () {
    // Better than using a default attribute, since this
    // triggers change detectors below.
    this.src = this.src || "../gifs/nope.gif";
    if (this.exploded != null) {
      this.playbackStrategy = Strategies.noop.bind(this);
    } else if (this.clock != null) {
      this.playbackStrategy = Strategies.noop.bind(this);
    } else if (this['hard-bpm']) {
      this.playbackStrategy = Strategies.hardBpm.bind(this);
    } else if (this.bpm) {
      this.playbackStrategy = Strategies.bpm.bind(this);
    } else {
      this.speed = this.speed || 1.0;
      this.playbackStrategy = Strategies.speed.bind(this);
    }

    console.log("READY")
  },
  srcChanged: function (oldVal, newVal) {
    this.playback = new Playback(this.$.frames, newVal, this.playbackStrategy, this['ping-pong'] != null);
  },
  clock: function (beatNr, beatDuration, beatFraction) {
//    console.log(beatNr, beatDuration, beatFraction);
    this.playback.fromClock(beatNr, beatDuration, beatFraction);
  }
// Hard to do this without promises
//  speedChanged: function (oldVal, newVal) {
//    this.playback.stop();
//    this.playback.startSpeed(this.speed);
//  }
})
