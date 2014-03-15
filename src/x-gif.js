"use strict";

var Playback = require('./playback.js');

Polymer('x-gif', {
  ready: function () {
    // Better than using a default attribute, since this
    // triggers change detectors below.
    this.src = this.src || "../gifs/nope.gif";
    this.speed = this.speed || 1.0;
    console.log("READY")
  },
  srcChanged: function (oldVal, newVal) {
    console.log("Setting gif to " + newVal)
    this.playback = new Playback(this.$.frames, newVal, (function () {
      console.warn("UGH. Callbacks FOR THE LOSE.");
      console.log(this.speed);
      this.playback.startSpeed(this.speed);
    }).bind(this));
  }
// Hard to do this without promises
//  speedChanged: function (oldVal, newVal) {
//    this.playback.stop();
//    this.playback.startSpeed(this.speed);
//  }
})
