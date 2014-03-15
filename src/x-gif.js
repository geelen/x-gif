"use strict";

var Playback = require('./playback.js');

var Strategies = {
  speed: function () {
    this.playback.startSpeed(this.speed, this['n-times'], (function () {
      this.fire('x-gif-stopped')
    }).bind(this));
  },
  hardBpm: function () {
    this.playback.startHardBpm(this.bpm);
  },
  bpm: function () {
    this.playback.startBpm(this.bpm);
  },
  exploded: function () {
    this.$.frames.classList.add('exploded')
  }
}

Polymer('x-gif', {
  ready: function () {
    // Better than using a default attribute, since this
    // triggers change detectors below.
    this.src = this.src || "../gifs/nope.gif";
    if (this.exploded) {
      this.playbackStrategy = Strategies.exploded.bind(this);
    } else if (this.bpm) {
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
    this.playback = new Playback(this.$.frames, newVal, this.playbackStrategy);
  }
// Hard to do this without promises
//  speedChanged: function (oldVal, newVal) {
//    this.playback.stop();
//    this.playback.startSpeed(this.speed);
//  }
})
