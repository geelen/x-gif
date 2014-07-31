import Playback from './playback.js';
import Strategies from './strategies.js';

class XGif {
  ready() {
    if (this.exploded != null) {
      this.playbackStrategy = 'noop'
    } else if (this.sync != null) {
      this.playbackStrategy = 'noop';
    } else if (this['hard-bpm']) {
      this.playbackStrategy = 'hardBpm';
    } else if (this.bpm) {
      this.playbackStrategy = 'bpm';
    } else {
      this.speed = this.speed || 1.0;
      this.playbackStrategy = 'speed';
    }
  };

  srcChanged() {
    var playbackStrategy = Strategies[this.playbackStrategy];
    this.playback = new Playback(this, this.$.frames, this.src, {
      pingPong: this['ping-pong'] != null,
      fill: this.fill != null,
      stopped: this.stopped != null
    });
    this.playback.ready.then(playbackStrategy.bind(this));
  };

  speedChanged(oldVal, newVal) {
    if (this.playback) this.playback.speed = newVal;
  }

  stoppedChanged(oldVal, newVal) {
    var nowStop = newVal != null;
    if (this.playback && nowStop && !this.playback.stopped) {
      this.playback.stop();
    } else if (this.playback && !nowStop && this.playback.stopped) {
      this.playback.start();
    }
  }

  togglePingPong() {
    this['ping-pong'] = (this['ping-pong'] != null) ? null : true;
    if (this.playback) this.playback.pingPong = this['ping-pong'] != null;
  }

  clock(beatNr, beatDuration, beatFraction) {
    if (this.playback && this.playback.gif) this.playback.fromClock(beatNr, beatDuration, beatFraction);
  };

  relayout() {
    if (this.fill != null) this.playback.scaleToFill();
  }
}

Polymer('x-gif', new XGif());
