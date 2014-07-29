import Playback from './playback.js';
import Strategies from './strategies.js';

// Shim & native-safe ownerDocument lookup
var owner = (document._currentScript || document.currentScript).ownerDocument;

class XGifController {
  constructor(xgif) {
    this.xgif = xgif;
//    this.setupComponent();
//  }
//
//  setupComponent() {
    // Create a shadow root
    this.shadow = this.xgif.createShadowRoot();

    // stamp out our template in the shadow dom
    var template = owner.querySelector("#template").content.cloneNode(true);
    this.shadow.appendChild(template);

    if (xgif.hasAttribute('exploded')) {
      this.playbackStrategy = 'noop'
    } else if (xgif.hasAttribute('sync')) {
      this.playbackStrategy = 'noop';
    } else if (xgif.getAttribute('hard-bpm')) {
      this.playbackStrategy = 'hardBpm';
    } else if (xgif.getAttribute('bpm')) {
      this.playbackStrategy = 'bpm';
    } else {
      this.speed = parseFloat(xgif.getAttribute('speed')) || 1.0;
      this.playbackStrategy = 'speed';
    }

    this.srcChanged = function (src) {
      if (!src) return;
      console.log("Loading " + src)
      var playbackStrategy = Strategies[this.playbackStrategy];

      this.playback = new Playback(this, this.shadow.querySelector('#frames'), src, {
        pingPong: xgif.hasAttribute('ping-pong'),
        fill: xgif.hasAttribute('fill'),
        stopped: xgif.hasAttribute('stopped')
      });
      this.playback.ready.then(playbackStrategy.bind(this));
    }
    this.srcChanged(xgif.getAttribute('src'))

    this.speedChanged = function (speedStr) {
      this.speed = parseFloat(speedStr) || this.speed;
      if (this.playback) this.playback.speed = this.speed;
    }

    this.stoppedChanged = function (newVal) {
      var nowStop = newVal != null;
      if (this.playback && nowStop && !this.playback.stopped) {
        this.playback.stop();
      } else if (this.playback && !nowStop && this.playback.stopped) {
        this.playback.start();
      }
    }

//    src speed bpm hard-bpm exploded n-times ping-pong sync fill stopped

    xgif.togglePingPong = () => {
      if (xgif.hasAttribute('ping-pong')) {
        xgif.removeAttribute('ping-pong')
      } else {
        xgif.setAttribute('ping-pong', '')
      }
      if (this.playback) this.playback.pingPong = xgif.hasAttribute('ping-pong');
    }

    xgif.clock = (beatNr, beatDuration, beatFraction) => {
      if (this.playback && this.playback.gif) this.playback.fromClock(beatNr, beatDuration, beatFraction);
    };

    xgif.relayout = () => {
      if (xgif.hasAttribute('fill')) this.playback.scaleToFill();
    }
  }
}

// Register the element in the document
class XGif extends HTMLElement {
  createdCallback() {
    this.controller = new XGifController(this);
  }

  attributeChangedCallback(attribute, oldVal, newVal) {
    if (attribute == "src") this.controller.srcChanged(newVal)
    if (attribute == "speed") this.controller.speedChanged(newVal)
    if (attribute == "stopped") this.controller.stoppedChanged(newVal)
  }
}

// Register our todo-item tag with the document
document.registerElement('x-gif', XGif);
