"use strict";

var Playback = require('./playback.js')

Polymer('x-gif', {
  file: "../gifs/nope.gif",
  ready: function () {
    console.log("READY")
  },
  fileChanged: function (oldVal, newVal) {
    var playback = new Playback(this.$.frames, newVal, function () {
      console.warn("UGH. Callbacks FOR THE LOSE.");
      playback.startLoop(1.0);
    });
  }
})
