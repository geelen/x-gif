"use strict";

var Strategies = {
  speed: function () {
    this.playback.startSpeed(this.speed, this.context.getAttribute('n-times'));
  },
  hardBpm: function () {
    this.playback.startHardBpm(parseFloat(this.context.getAttribute('hard-bpm')));
  },
  bpm: function () {
    this.playback.startBpm(parseFloat(this.context.getAttribute('bpm')));
  },
  noop: function () {
  }
};

export default Strategies;
