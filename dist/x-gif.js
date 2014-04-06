(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"./gif.sjs":3,"./stream_reader.js":6}],2:[function(require,module,exports){
"use strict";

var Playback = require('./playback.sjs'),
  Strategies = require('./strategies.js');

var XGif = function () {
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
    console.log(this.fill != null)
    this.playback = new Playback(this, this.$.frames, this.src, {
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

},{"./playback.sjs":4,"./strategies.js":5}],3:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$14456 = 10;
var Gif$14457 = function (frames$14458) {
    this.frames = frames$14458;
    this.length = 0;
    this.offsets = [];
    frames$14458.forEach(function (frame$14461) {
        this.offsets.push(this.length);
        this.length += frame$14461.delay || defaultFrameDelay$14456;
    }.bind(this));
};
Gif$14457.prototype.frameAt = function (fraction$14462) {
    var offset$14463 = fraction$14462 * this.length;
    for (var i$14464 = 1, l$14465 = this.offsets.length; i$14464 < l$14465; i$14464++) {
        if (this.offsets[i$14464] > offset$14463)
            break;
    }
    return i$14464 - 1;
};
module.exports = Gif$14457;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$14346 = require('./exploder.js');
// Private functions for setup
function addClasses$14347(element$14350, frame$14351) {
    element$14350.classList.add('frame');
    if (frame$14351.disposal == 2)
        element$14350.classList.add('disposal-restore');
}
var createImage$14348 = function (frame$14352) {
    var image$14353 = new Image();
    image$14353.src = frame$14352.url;
    addClasses$14347(image$14353, frame$14352);
    return image$14353;
};
var Playback$14349 = function (xgif$14354, element$14355, file$14356, opts$14357) {
    // Set up out instance variables
    this.xgif = xgif$14354;
    this.element = element$14355;
    this.onReady = opts$14357.onReady;
    this.pingPong = opts$14357.pingPong;
    this.fill = opts$14357.fill;
    this.stopped = opts$14357.stopped;
    new Exploder$14346(file$14356, function (gif$14359) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$14359.frames.length + ' frames of gif ' + file$14356);
        this.gif = gif$14359;
        this.element.innerHTML = '';
        var createFrameElement$14360 = createImage$14348;
        //(this.fill) ? createDiv : createImage;
        gif$14359.frames.map(createFrameElement$14360).forEach(this.element.appendChild, this.element);
        if (this.fill)
            requestAnimationFrame(this.scaleToFill.bind(this));
        this.onReady();
    }.bind(this));
};
Playback$14349.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$14361 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$14362 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$14361, yScale$14362) + ')';
    }
};
Playback$14349.prototype.setFrame = function (fraction$14363, repeatCount$14364) {
    var frameNr$14365 = this.pingPong && repeatCount$14364 % 2 >= 1 ? this.gif.frameAt(1 - fraction$14363) : this.gif.frameAt(fraction$14363);
    this.element.dataset['frame'] = frameNr$14365;
};
Playback$14349.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$14349.prototype.stop = function () {
    this.stopped = true;
};
Playback$14349.prototype.startSpeed = function (speed$14366, nTimes$14367) {
    this.speed = speed$14366;
    this.animationLoop = function () {
        var gifLength$14369 = 10 * this.gif.length / this.speed, duration$14370 = performance.now() - this.startTime, repeatCount$14371 = duration$14370 / gifLength$14369, fraction$14372 = repeatCount$14371 % 1;
        if (!nTimes$14367 || repeatCount$14371 < nTimes$14367) {
            this.setFrame(fraction$14372, repeatCount$14371);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$14367 % 1 || 1, repeatCount$14371);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$14349.prototype.fromClock = function (beatNr$14373, beatDuration$14374, beatFraction$14375) {
    var speedup$14376 = 1.5, lengthInBeats$14377 = Math.max(1, Math.round(1 / speedup$14376 * 10 * this.gif.length / beatDuration$14374)), subBeat$14378 = beatNr$14373 % lengthInBeats$14377, repeatCount$14379 = beatNr$14373 / lengthInBeats$14377, subFraction$14380 = beatFraction$14375 / lengthInBeats$14377 + subBeat$14378 / lengthInBeats$14377;
    this.setFrame(subFraction$14380, repeatCount$14379);
};
Playback$14349.prototype.startHardBpm = function (bpm$14381) {
    var beatLength$14382 = 60 * 1000 / bpm$14381;
    this.animationLoop = function () {
        var duration$14384 = performance.now() - this.startTime, repeatCount$14385 = duration$14384 / beatLength$14382, fraction$14386 = repeatCount$14385 % 1;
        this.setFrame(fraction$14386, repeatCount$14385);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$14349.prototype.startBpm = function (bpm$14387) {
    var beatLength$14388 = 60 * 1000 / bpm$14387;
    this.animationLoop = function () {
        var duration$14390 = performance.now() - this.startTime, beatNr$14391 = Math.floor(duration$14390 / beatLength$14388), beatFraction$14392 = duration$14390 % beatLength$14388 / beatLength$14388;
        this.fromClock(beatNr$14391, beatLength$14388, beatFraction$14392);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$14349;

},{"./exploder.js":1}],5:[function(require,module,exports){
"use strict";

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
};

module.exports = Strategies;

},{}],6:[function(require,module,exports){
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

},{}]},{},[2])