"use strict";

var Playback = require('./playback.js');

Polymer('x-gif', {
  ready: function () {
    // Better than using a default attribute, since this
    // triggers 'fileChanged' below.
    this.file = this.file || "../gifs/nope.gif";
    console.log("READY")
  },
  fileChanged: function (oldVal, newVal) {
    console.log("Setting gif to " + newVal)
    var playback = new Playback(this.$.frames, newVal, function () {
      console.warn("UGH. Callbacks FOR THE LOSE.");
      playback.startSpeed(1.0);
    });
  }
})
