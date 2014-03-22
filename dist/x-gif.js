(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
;
var DirectDomUpdater$487 = function (element$488) {
    this.element = element$488;
};
DirectDomUpdater$487.prototype.initNewGif = function (gif$489, fill$490) {
    this.element.innerHTML = '';
    gif$489.frames.map(function (frame$493) {
        var image$494 = new Image();
        image$494.src = frame$493.url;
        image$494.classList.add('frame');
        if (frame$493.disposal == 2)
            image$494.classList.add('disposal-restore');
        this.element.appendChild(image$494);
    }.bind(this));
    if (fill$490)
        requestAnimationFrame(this.scaleToFill.bind(this));
};
DirectDomUpdater$487.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$495 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$496 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$495, yScale$496) + ')';
    }
};
DirectDomUpdater$487.prototype.setFrame = function (frameNr$497) {
    this.element.dataset['frame'] = frameNr$497;
};
module.exports = DirectDomUpdater$487;

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
var defaultFrameDelay$561 = 10;
var Gif$562 = function (frames$563) {
    this.frames = frames$563;
    this.length = 0;
    this.offsets = [];
    frames$563.forEach(function (frame$566) {
        this.offsets.push(this.length);
        this.length += frame$566.delay || defaultFrameDelay$561;
    }.bind(this));
};
Gif$562.prototype.frameAt = function (fraction$567) {
    var offset$568 = fraction$567 * this.length;
    for (var i$569 = 1, l$570 = this.offsets.length; i$569 < l$570; i$569++) {
        if (this.offsets[i$569] > offset$568)
            break;
    }
    return i$569 - 1;
};
module.exports = Gif$562;

},{}],5:[function(require,module,exports){
'use strict';
;
var Exploder$401 = require('./exploder.js');
var Playback$402 = function (xgif$403, domUpdater$404, file$405, opts$406) {
    // Set up out instance variables
    this.xgif = xgif$403;
    this.domUpdater = domUpdater$404;
    this.onReady = opts$406.onReady;
    this.pingPong = opts$406.pingPong;
    this.fill = opts$406.fill;
    this.stopped = opts$406.stopped;
    new Exploder$401(file$405, function (gif$408) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$408.frames.length + ' frames of gif ' + file$405);
        this.gif = gif$408;
        this.domUpdater.initNewGif(gif$408);
        this.onReady();
    }.bind(this));
};
Playback$402.prototype.setFrame = function (fraction$409, repeatCount$410) {
    var frameNr$411 = this.pingPong && repeatCount$410 % 2 >= 1 ? this.gif.frameAt(1 - fraction$409) : this.gif.frameAt(fraction$409);
    this.domUpdater.setFrame(frameNr$411);
};
Playback$402.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$402.prototype.stop = function () {
    this.stopped = true;
};
Playback$402.prototype.startSpeed = function (speed$412, nTimes$413) {
    this.speed = speed$412;
    this.animationLoop = function () {
        var gifLength$415 = 10 * this.gif.length / this.speed, duration$416 = performance.now() - this.startTime, repeatCount$417 = duration$416 / gifLength$415, fraction$418 = repeatCount$417 % 1;
        if (!nTimes$413 || repeatCount$417 < nTimes$413) {
            this.setFrame(fraction$418, repeatCount$417);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$413 % 1 || 1, repeatCount$417);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$402.prototype.fromClock = function (beatNr$419, beatDuration$420, beatFraction$421) {
    var speedup$422 = 1.5, lengthInBeats$423 = Math.max(1, Math.round(1 / speedup$422 * 10 * this.gif.length / beatDuration$420)), subBeat$424 = beatNr$419 % lengthInBeats$423, repeatCount$425 = beatNr$419 / lengthInBeats$423, subFraction$426 = beatFraction$421 / lengthInBeats$423 + subBeat$424 / lengthInBeats$423;
    this.setFrame(subFraction$426, repeatCount$425);
};
Playback$402.prototype.startHardBpm = function (bpm$427) {
    var beatLength$428 = 60 * 1000 / bpm$427;
    this.animationLoop = function () {
        var duration$430 = performance.now() - this.startTime, repeatCount$431 = duration$430 / beatLength$428, fraction$432 = repeatCount$431 % 1;
        this.setFrame(fraction$432, repeatCount$431);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$402.prototype.startBpm = function (bpm$433) {
    var beatLength$434 = 60 * 1000 / bpm$433;
    this.animationLoop = function () {
        var duration$436 = performance.now() - this.startTime, beatNr$437 = Math.floor(duration$436 / beatLength$434), beatFraction$438 = duration$436 % beatLength$434 / beatLength$434;
        this.fromClock(beatNr$437, beatLength$434, beatFraction$438);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$402;

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