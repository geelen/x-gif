(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
;
var DirectDomUpdater$3252 = function (element$3253) {
    this.element = element$3253;
};
DirectDomUpdater$3252.prototype.initNewGif = function (gif$3254, fill$3255) {
    this.element.innerHTML = '';
    gif$3254.frames.map(function (frame$3258) {
        var image$3259 = new Image();
        image$3259.src = frame$3258.url;
        image$3259.classList.add('frame');
        if (frame$3258.disposal == 2)
            image$3259.classList.add('disposal-restore');
        this.element.appendChild(image$3259);
    }.bind(this));
    if (fill$3255)
        requestAnimationFrame(this.scaleToFill.bind(this));
};
DirectDomUpdater$3252.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$3260 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$3261 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$3260, yScale$3261) + ')';
    }
};
DirectDomUpdater$3252.prototype.setFrame = function (frameNr$3262) {
    this.element.dataset['frame'] = frameNr$3262;
};
module.exports = DirectDomUpdater$3252;

},{}],2:[function(require,module,exports){
"use strict";

var StreamReader = require('./stream_reader.js'),
  Gif = require('./gif.sjs'),
  url = (URL && URL.createObjectURL) ? URL : webkitURL;

var Exploder = function (file, cb) {
  this.file = file;
  this.doneCallback = cb;
  this.loadAndExplode();
};

Exploder.prototype.loadAndExplode = function () {
  var loader = new XMLHttpRequest(),
    exploder = this.explode.bind(this);
  loader.open('GET', this.file, true);
  loader.responseType = 'arraybuffer';
  loader.onload = function () {
    exploder(this.response);
  };
  loader.send();
}

Exploder.prototype.explode = function (buffer) {
  var frames = [],
    streamReader = new StreamReader(buffer);

  // Ensure this is an animated GIF
  if (streamReader.readAscii(6) != "GIF89a") {
//    deferred.reject();
    return;
  }

  streamReader.skipBytes(4); // Height & Width
  if (streamReader.peekBit(1)) {
    streamReader.log("GLOBAL COLOR TABLE")
    var colorTableSize = streamReader.readByte() & 0x07;
    streamReader.log("GLOBAL COLOR TABLE IS " + 3 * Math.pow(2, colorTableSize + 1) + " BYTES")
    streamReader.skipBytes(2);
    streamReader.skipBytes(3 * Math.pow(2, colorTableSize + 1));
  } else {
    streamReader.log("NO GLOBAL COLOR TABLE")
  }
  // WE HAVE ENOUGH FOR THE GIF HEADER!
  var gifHeader = buffer.slice(0, streamReader.index);

  var spinning = true, expectingImage = false;
  while (spinning) {

    if (streamReader.isNext([0x21, 0xFF])) {
      streamReader.log("APPLICATION EXTENSION")
      streamReader.skipBytes(2);
      var blockSize = streamReader.readByte();
      streamReader.log(streamReader.readAscii(blockSize));

      if (streamReader.isNext([0x03, 0x01])) {
        // we cool
        streamReader.skipBytes(5)
      } else {
        streamReader.log("A weird application extension. Skip until we have 2 NULL bytes");
        while (!(streamReader.readByte() === 0 && streamReader.peekByte() === 0));
        streamReader.log("OK moving on")
        streamReader.skipBytes(1);
      }
    } else if (streamReader.isNext([0x21, 0xFE])) {
      streamReader.log("COMMENT EXTENSION")
      streamReader.skipBytes(2);

      while (!streamReader.isNext([0x00])) {
        var blockSize = streamReader.readByte();
        streamReader.log(streamReader.readAscii(blockSize));
      }
      streamReader.skipBytes(1); //NULL terminator

    } else if (streamReader.isNext([0x2c])) {
      streamReader.log("IMAGE DESCRIPTOR!");
      if (!expectingImage) {
        // This is a bare image, not prefaced with a Graphics Control Extension
        // so we should treat it as a frame.
        frames.push({ index: streamReader.index, delay: 0 });
      }
      expectingImage = false;

      streamReader.skipBytes(9);
      if (streamReader.peekBit(1)) {
        streamReader.log("LOCAL COLOR TABLE");
        var colorTableSize = streamReader.readByte() & 0x07;
        streamReader.log("LOCAL COLOR TABLE IS " + 3 * Math.pow(2, colorTableSize + 1) + " BYTES")
        streamReader.skipBytes(2);
        streamReader.skipBytes(3 * Math.pow(2, colorTableSize + 1));
      } else {
        streamReader.log("NO LOCAL TABLE PHEW");
        streamReader.skipBytes(1);
      }

      streamReader.log("MIN CODE SIZE " + streamReader.readByte());
      streamReader.log("DATA START");

      while (!streamReader.isNext([0x00])) {
        var blockSize = streamReader.readByte();
//        streamReader.log("SKIPPING " + blockSize + " BYTES");
        streamReader.skipBytes(blockSize);
      }
      streamReader.log("DATA END");
      streamReader.skipBytes(1); //NULL terminator
    } else if (streamReader.isNext([0x21, 0xF9, 0x04])) {
      streamReader.log("GRAPHICS CONTROL EXTENSION!");
      // We _definitely_ have a frame. Now we're expecting an image
      var index = streamReader.index;

      streamReader.skipBytes(3);
      var disposalMethod = streamReader.readByte() >> 2;
      streamReader.log("DISPOSAL " + disposalMethod);
      var delay = streamReader.readByte() + streamReader.readByte() * 256;
      frames.push({ index: index, delay: delay, disposal: disposalMethod });
      streamReader.log("FRAME DELAY " + delay);
      streamReader.skipBytes(2);
      expectingImage = true;
    } else {
      var maybeTheEnd = streamReader.index;
      while (!streamReader.finished() && !streamReader.isNext([0x21, 0xF9, 0x04])) {
        streamReader.readByte();
      }
      if (streamReader.finished()) {
        streamReader.index = maybeTheEnd;
        streamReader.log("WE END");
        spinning = false;
      } else {
        streamReader.log("UNKNOWN DATA FROM " + maybeTheEnd);
      }
    }
  }
  var endOfFrames = streamReader.index;

  var gifFooter = buffer.slice(-1); //last bit is all we need
  for (var i = 0; i < frames.length; i++) {
    var frame = frames[i];
    var nextIndex = (i < frames.length - 1) ? frames[i + 1].index : endOfFrames;
    frame.blob = new Blob([ gifHeader, buffer.slice(frame.index, nextIndex), gifFooter ], {type: 'image/gif'});
    frame.url = url.createObjectURL(frame.blob);
  }

  this.doneCallback(new Gif(frames));
}

module.exports = Exploder;

},{"./gif.sjs":4,"./stream_reader.js":6}],3:[function(require,module,exports){
"use strict";

var Playback = require('./playback.sjs'),
  DirectDomUpdater = require('./direct_dom_updater.sjs');

var XGif = function () {
  var Strategies = {
    speed: function () {
      this.playback.startSpeed(this.speed, this['n-times']);
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

  this.ready = function () {
    // Better than using a default attribute, since this
    // triggers change detectors below.
    this.src = this.src || "../gifs/nope.gif";
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

  this.srcChanged = function () {
    var playbackStrategy = Strategies[this.playbackStrategy].bind(this);
    console.log("GO TIME")
    var domUpdater = new DirectDomUpdater(this.$.frames);
    this.playback = new Playback(this, domUpdater, this.src, {
      onReady: playbackStrategy,
      pingPong: this['ping-pong'] != null,
      fill: this.fill != null,
      stopped: this.stopped != null
    });
  };

  this.speedChanged = function (oldVal, newVal) {
    console.log("SPEED CHANGED")
    if (this.playback) this.playback.speed = newVal;
  }

  this.stoppedChanged = function (oldVal, newVal) {
    var nowStop = newVal != null;
    if (this.playback && nowStop && !this.playback.stopped) {
      console.log("TIME TO STOP")
      this.playback.stop();
    } else if (this.playback && !nowStop && this.playback.stopped) {
      console.log("TIME TO START")
      this.playback.start();
    }
  }

  this.togglePingPong = function () {
    this['ping-pong'] = (this['ping-pong'] != null) ? null : true;
    if (this.playback) this.playback.pingPong = this['ping-pong'] != null;
  }

  this.clock = function (beatNr, beatDuration, beatFraction) {
    if (this.playback && this.playback.gif) this.playback.fromClock(beatNr, beatDuration, beatFraction);
  };

  this.relayout = function () {
    if (this.fill != null) this.playback.scaleToFill();
  }
}

Polymer('x-gif', new XGif());

},{"./direct_dom_updater.sjs":1,"./playback.sjs":5}],4:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$3399 = 10;
var Gif$3400 = function (frames$3401) {
    this.frames = frames$3401;
    this.length = 0;
    this.offsets = [];
    frames$3401.forEach(function (frame$3404) {
        this.offsets.push(this.length);
        this.length += frame$3404.delay || defaultFrameDelay$3399;
    }.bind(this));
};
Gif$3400.prototype.frameAt = function (fraction$3405) {
    var offset$3406 = fraction$3405 * this.length;
    for (var i$3407 = 1, l$3408 = this.offsets.length; i$3407 < l$3408; i$3407++) {
        if (this.offsets[i$3407] > offset$3406)
            break;
    }
    return i$3407 - 1;
};
module.exports = Gif$3400;

},{}],5:[function(require,module,exports){
'use strict';
;
var Exploder$3166 = require('./exploder.js');
var Playback$3167 = function (xgif$3168, domUpdater$3169, file$3170, opts$3171) {
    // Set up out instance variables
    this.xgif = xgif$3168;
    this.domUpdater = domUpdater$3169;
    this.onReady = opts$3171.onReady;
    this.pingPong = opts$3171.pingPong;
    this.fill = opts$3171.fill;
    this.stopped = opts$3171.stopped;
    new Exploder$3166(file$3170, function (gif$3173) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$3173.frames.length + ' frames of gif ' + file$3170);
        this.gif = gif$3173;
        this.domUpdater.initNewGif(gif$3173);
        this.onReady();
    }.bind(this));
};
Playback$3167.prototype.setFrame = function (fraction$3174, repeatCount$3175) {
    var frameNr$3176 = this.pingPong && repeatCount$3175 % 2 >= 1 ? this.gif.frameAt(1 - fraction$3174) : this.gif.frameAt(fraction$3174);
    this.domUpdater.setFrame(frameNr$3176);
};
Playback$3167.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$3167.prototype.stop = function () {
    this.stopped = true;
};
Playback$3167.prototype.startSpeed = function (speed$3177, nTimes$3178) {
    this.speed = speed$3177;
    this.animationLoop = function () {
        var gifLength$3180 = 10 * this.gif.length / this.speed, duration$3181 = performance.now() - this.startTime, repeatCount$3182 = duration$3181 / gifLength$3180, fraction$3183 = repeatCount$3182 % 1;
        if (!nTimes$3178 || repeatCount$3182 < nTimes$3178) {
            this.setFrame(fraction$3183, repeatCount$3182);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$3178 % 1 || 1, repeatCount$3182);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$3167.prototype.fromClock = function (beatNr$3184, beatDuration$3185, beatFraction$3186) {
    var speedup$3187 = 1.5, lengthInBeats$3188 = Math.max(1, Math.round(1 / speedup$3187 * 10 * this.gif.length / beatDuration$3185)), subBeat$3189 = beatNr$3184 % lengthInBeats$3188, repeatCount$3190 = beatNr$3184 / lengthInBeats$3188, subFraction$3191 = beatFraction$3186 / lengthInBeats$3188 + subBeat$3189 / lengthInBeats$3188;
    this.setFrame(subFraction$3191, repeatCount$3190);
};
Playback$3167.prototype.startHardBpm = function (bpm$3192) {
    var beatLength$3193 = 60 * 1000 / bpm$3192;
    this.animationLoop = function () {
        var duration$3195 = performance.now() - this.startTime, repeatCount$3196 = duration$3195 / beatLength$3193, fraction$3197 = repeatCount$3196 % 1;
        this.setFrame(fraction$3197, repeatCount$3196);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$3167.prototype.startBpm = function (bpm$3198) {
    var beatLength$3199 = 60 * 1000 / bpm$3198;
    this.animationLoop = function () {
        var duration$3201 = performance.now() - this.startTime, beatNr$3202 = Math.floor(duration$3201 / beatLength$3199), beatFraction$3203 = duration$3201 % beatLength$3199 / beatLength$3199;
        this.fromClock(beatNr$3202, beatLength$3199, beatFraction$3203);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$3167;

},{"./exploder.js":2}],6:[function(require,module,exports){
"use strict";

var StreamReader = function (arrayBuffer) {
  this.data = new Uint8Array(arrayBuffer);
  this.index = 0;
  this.log("TOTAL LENGTH: " + this.data.length);
}

StreamReader.prototype.finished = function () {
  return this.index >= this.data.length;
}
StreamReader.prototype.readByte = function () {
  return this.data[this.index++];
};
StreamReader.prototype.peekByte = function () {
  return this.data[this.index];
};
StreamReader.prototype.skipBytes = function (n) {
  this.index += n;
};
StreamReader.prototype.peekBit = function (i) {
  return !!(this.peekByte() & (1 << 8 - i));
};
StreamReader.prototype.readAscii = function (n) {
  var s = '';
  for (var i = 0; i < n; i++) {
    s += String.fromCharCode(this.readByte());
  }
  return s;
};
StreamReader.prototype.isNext = function (array) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] !== this.data[this.index + i]) return false;
  }
  return true;
};
StreamReader.prototype.log = function (str) {
//  console.log(this.index + ": " + str);
};
StreamReader.prototype.error = function (str) {
  console.error(this.index + ": " + str);
}

module.exports = StreamReader;

},{}]},{},[3])