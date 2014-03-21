(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
;
var DirectDomUpdater$401 = function (element$402) {
    this.element = element$402;
};
DirectDomUpdater$401.prototype.initNewGif = function (gif$403, fill$404) {
    this.element.innerHTML = '';
    gif$403.frames.map(function (frame$407) {
        var image$408 = new Image();
        image$408.src = frame$407.url;
        image$408.classList.add('frame');
        if (frame$407.disposal == 2)
            image$408.classList.add('disposal-restore');
        this.element.appendChild(image$408);
    }.bind(this));
    if (fill$404)
        requestAnimationFrame(this.scaleToFill.bind(this));
};
DirectDomUpdater$401.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$409 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$410 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$409, yScale$410) + ')';
    }
};
DirectDomUpdater$401.prototype.setFrame = function (frameNr$411) {
    this.element.dataset['frame'] = frameNr$411;
};
module.exports = DirectDomUpdater$401;

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
var Exploder$460 = require('./exploder.js');
var Playback$461 = function (xgif$462, domUpdater$463, file$464, opts$465) {
    // Set up out instance variables
    this.xgif = xgif$462;
    this.domUpdater = domUpdater$463;
    this.onReady = opts$465.onReady;
    this.pingPong = opts$465.pingPong;
    this.fill = opts$465.fill;
    this.stopped = opts$465.stopped;
    new Exploder$460(file$464, function (gif$467) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$467.frames.length + ' frames of gif ' + file$464);
        this.gif = gif$467;
        this.domUpdater.initNewGif(gif$467);
        this.onReady();
    }.bind(this));
};
Playback$461.prototype.setFrame = function (fraction$468, repeatCount$469) {
    var frameNr$470 = this.pingPong && repeatCount$469 % 2 >= 1 ? this.gif.frameAt(1 - fraction$468) : this.gif.frameAt(fraction$468);
    this.domUpdater.setFrame(frameNr$470);
};
Playback$461.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$461.prototype.stop = function () {
    this.stopped = true;
};
Playback$461.prototype.startSpeed = function (speed$471, nTimes$472) {
    this.speed = speed$471;
    this.animationLoop = function () {
        var gifLength$474 = 10 * this.gif.length / this.speed, duration$475 = performance.now() - this.startTime, repeatCount$476 = duration$475 / gifLength$474, fraction$477 = repeatCount$476 % 1;
        if (!nTimes$472 || repeatCount$476 < nTimes$472) {
            this.setFrame(fraction$477, repeatCount$476);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$472 % 1 || 1, repeatCount$476);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$461.prototype.fromClock = function (beatNr$478, beatDuration$479, beatFraction$480) {
    var speedup$481 = 1.5, lengthInBeats$482 = Math.max(1, Math.round(1 / speedup$481 * 10 * this.gif.length / beatDuration$479)), subBeat$483 = beatNr$478 % lengthInBeats$482, repeatCount$484 = beatNr$478 / lengthInBeats$482, subFraction$485 = beatFraction$480 / lengthInBeats$482 + subBeat$483 / lengthInBeats$482;
    this.setFrame(subFraction$485, repeatCount$484);
};
Playback$461.prototype.startHardBpm = function (bpm$486) {
    var beatLength$487 = 60 * 1000 / bpm$486;
    this.animationLoop = function () {
        var duration$489 = performance.now() - this.startTime, repeatCount$490 = duration$489 / beatLength$487, fraction$491 = repeatCount$490 % 1;
        this.setFrame(fraction$491, repeatCount$490);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$461.prototype.startBpm = function (bpm$492) {
    var beatLength$493 = 60 * 1000 / bpm$492;
    this.animationLoop = function () {
        var duration$495 = performance.now() - this.startTime, beatNr$496 = Math.floor(duration$495 / beatLength$493), beatFraction$497 = duration$495 % beatLength$493 / beatLength$493;
        this.fromClock(beatNr$496, beatLength$493, beatFraction$497);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$461;

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