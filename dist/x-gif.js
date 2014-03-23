(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
;
var DirectDomUpdater$17732 = function (element$17733) {
    this.element = element$17733;
};
DirectDomUpdater$17732.prototype.initNewGif = function (gif$17734, fill$17735) {
    this.element.innerHTML = '';
    gif$17734.frames.map(function (frame$17738) {
        var image$17739 = new Image();
        image$17739.src = frame$17738.url;
        image$17739.classList.add('frame');
        if (frame$17738.disposal == 2)
            image$17739.classList.add('disposal-restore');
        this.element.appendChild(image$17739);
    }.bind(this));
    if (fill$17735)
        requestAnimationFrame(this.scaleToFill.bind(this));
};
DirectDomUpdater$17732.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$17740 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$17741 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$17740, yScale$17741) + ')';
    }
};
DirectDomUpdater$17732.prototype.setFrame = function (frameNr$17742) {
    this.element.dataset['frame'] = frameNr$17742;
};
module.exports = DirectDomUpdater$17732;

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
var defaultFrameDelay$17884 = 10;
var Gif$17885 = function (frames$17886) {
    this.frames = frames$17886;
    this.length = 0;
    this.offsets = [];
    frames$17886.forEach(function (frame$17889) {
        this.offsets.push(this.length);
        this.length += frame$17889.delay || defaultFrameDelay$17884;
    }.bind(this));
};
Gif$17885.prototype.frameAt = function (fraction$17890) {
    var offset$17891 = fraction$17890 * this.length;
    for (var i$17892 = 1, l$17893 = this.offsets.length; i$17892 < l$17893; i$17892++) {
        if (this.offsets[i$17892] > offset$17891)
            break;
    }
    return i$17892 - 1;
};
module.exports = Gif$17885;

},{}],5:[function(require,module,exports){
'use strict';
;
var Exploder$17568 = require('./exploder.js');
var Playback$17569 = function (xgif$17570, domUpdater$17571, file$17572, opts$17573) {
    // Set up out instance variables
    this.xgif = xgif$17570;
    this.domUpdater = domUpdater$17571;
    this.onReady = opts$17573.onReady;
    this.pingPong = opts$17573.pingPong;
    this.fill = opts$17573.fill;
    this.stopped = opts$17573.stopped;
    new Exploder$17568(file$17572, function (gif$17575) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$17575.frames.length + ' frames of gif ' + file$17572);
        this.gif = gif$17575;
        this.domUpdater.initNewGif(gif$17575);
        this.onReady();
    }.bind(this));
};
Playback$17569.prototype.setFrame = function (fraction$17576, repeatCount$17577) {
    var frameNr$17578 = this.pingPong && repeatCount$17577 % 2 >= 1 ? this.gif.frameAt(1 - fraction$17576) : this.gif.frameAt(fraction$17576);
    this.domUpdater.setFrame(frameNr$17578);
};
Playback$17569.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$17569.prototype.stop = function () {
    this.stopped = true;
};
Playback$17569.prototype.startSpeed = function (speed$17579, nTimes$17580) {
    this.speed = speed$17579;
    this.animationLoop = function () {
        var gifLength$17582 = 10 * this.gif.length / this.speed, duration$17583 = performance.now() - this.startTime, repeatCount$17584 = duration$17583 / gifLength$17582, fraction$17585 = repeatCount$17584 % 1;
        if (!nTimes$17580 || repeatCount$17584 < nTimes$17580) {
            this.setFrame(fraction$17585, repeatCount$17584);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$17580 % 1 || 1, repeatCount$17584);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$17569.prototype.fromClock = function (beatNr$17586, beatDuration$17587, beatFraction$17588) {
    var speedup$17589 = 1.5, lengthInBeats$17590 = Math.max(1, Math.round(1 / speedup$17589 * 10 * this.gif.length / beatDuration$17587)), subBeat$17591 = beatNr$17586 % lengthInBeats$17590, repeatCount$17592 = beatNr$17586 / lengthInBeats$17590, subFraction$17593 = beatFraction$17588 / lengthInBeats$17590 + subBeat$17591 / lengthInBeats$17590;
    this.setFrame(subFraction$17593, repeatCount$17592);
};
Playback$17569.prototype.startHardBpm = function (bpm$17594) {
    var beatLength$17595 = 60 * 1000 / bpm$17594;
    this.animationLoop = function () {
        var duration$17597 = performance.now() - this.startTime, repeatCount$17598 = duration$17597 / beatLength$17595, fraction$17599 = repeatCount$17598 % 1;
        this.setFrame(fraction$17599, repeatCount$17598);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$17569.prototype.startBpm = function (bpm$17600) {
    var beatLength$17601 = 60 * 1000 / bpm$17600;
    this.animationLoop = function () {
        var duration$17603 = performance.now() - this.startTime, beatNr$17604 = Math.floor(duration$17603 / beatLength$17601), beatFraction$17605 = duration$17603 % beatLength$17601 / beatLength$17601;
        this.fromClock(beatNr$17604, beatLength$17601, beatFraction$17605);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$17569;

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