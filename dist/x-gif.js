(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var StreamReader = require('./stream_reader.js'),
  Gif = require('./gif.sjs');

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
    deferred.reject();
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
    frame.url = URL.createObjectURL(frame.blob);
  }

  this.doneCallback(new Gif(frames));
}

module.exports = Exploder;

},{"./gif.sjs":3,"./stream_reader.js":5}],2:[function(require,module,exports){
"use strict";

var Playback = require('./playback.sjs');

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

  this.clock = function (beatNr, beatDuration, beatFraction) {
    if (this.playback && this.playback.gif) this.playback.fromClock(beatNr, beatDuration, beatFraction);
  };

  this.relayout = function () {
    if (this.fill != null) this.playback.scaleToFill();
  }
}

Polymer('x-gif', new XGif());

},{"./playback.sjs":4}],3:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$1584 = 10;
var Gif$1585 = function (frames$1586) {
    this.frames = frames$1586;
    this.length = 0;
    this.offsets = [];
    frames$1586.forEach(function (frame$1589) {
        this.offsets.push(this.length);
        this.length += frame$1589.delay || defaultFrameDelay$1584;
    }.bind(this));
};
Gif$1585.prototype.frameAt = function (fraction$1590) {
    var offset$1591 = fraction$1590 * this.length;
    for (var i$1592 = 1, l$1593 = this.offsets.length; i$1592 < l$1593; i$1592++) {
        if (this.offsets[i$1592] > offset$1591)
            break;
    }
    return i$1592 - 1;
};
module.exports = Gif$1585;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$1474 = require('./exploder.js');
// Private functions for setup
function addClasses$1475(element$1478, frame$1479) {
    element$1478.classList.add('frame');
    if (frame$1479.disposal == 2)
        element$1478.classList.add('disposal-restore');
}
var createImage$1476 = function (frame$1480) {
    var image$1481 = new Image();
    image$1481.src = frame$1480.url;
    addClasses$1475(image$1481, frame$1480);
    return image$1481;
};
var Playback$1477 = function (xgif$1482, element$1483, file$1484, opts$1485) {
    // Set up out instance variables
    this.xgif = xgif$1482;
    this.element = element$1483;
    this.onReady = opts$1485.onReady;
    this.pingPong = opts$1485.pingPong;
    this.fill = opts$1485.fill;
    this.stopped = opts$1485.stopped;
    new Exploder$1474(file$1484, function (gif$1487) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$1487.frames.length + ' frames of gif ' + file$1484);
        this.gif = gif$1487;
        this.element.innerHTML = '';
        var createFrameElement$1488 = createImage$1476;
        //(this.fill) ? createDiv : createImage;
        gif$1487.frames.map(createFrameElement$1488).forEach(this.element.appendChild, this.element);
        if (this.fill)
            requestAnimationFrame(this.scaleToFill.bind(this));
        this.onReady();
    }.bind(this));
};
Playback$1477.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$1489 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$1490 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$1489, yScale$1490) + ')';
    }
};
Playback$1477.prototype.setFrame = function (fraction$1491, repeatCount$1492) {
    var frameNr$1493 = this.pingPong && repeatCount$1492 % 2 >= 1 ? this.gif.frameAt(1 - fraction$1491) : this.gif.frameAt(fraction$1491);
    this.element.dataset['frame'] = frameNr$1493;
};
Playback$1477.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$1477.prototype.stop = function () {
    this.stopped = true;
};
Playback$1477.prototype.startSpeed = function (speed$1494, nTimes$1495) {
    this.speed = speed$1494;
    this.animationLoop = function () {
        var gifLength$1497 = 10 * this.gif.length / this.speed, duration$1498 = performance.now() - this.startTime, repeatCount$1499 = duration$1498 / gifLength$1497, fraction$1500 = repeatCount$1499 % 1;
        if (!nTimes$1495 || repeatCount$1499 < nTimes$1495) {
            this.setFrame(fraction$1500, repeatCount$1499);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(1, repeatCount$1499);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$1477.prototype.fromClock = function (beatNr$1501, beatDuration$1502, beatFraction$1503) {
    var speedup$1504 = 1.5, lengthInBeats$1505 = Math.max(1, Math.round(1 / speedup$1504 * 10 * this.gif.length / beatDuration$1502)), subBeat$1506 = beatNr$1501 % lengthInBeats$1505, repeatCount$1507 = beatNr$1501 / lengthInBeats$1505, subFraction$1508 = beatFraction$1503 / lengthInBeats$1505 + subBeat$1506 / lengthInBeats$1505;
    this.setFrame(subFraction$1508, repeatCount$1507);
};
Playback$1477.prototype.startHardBpm = function (bpm$1509) {
    var beatLength$1510 = 60 * 1000 / bpm$1509;
    this.animationLoop = function () {
        var duration$1512 = performance.now() - this.startTime, repeatCount$1513 = duration$1512 / beatLength$1510, fraction$1514 = repeatCount$1513 % 1;
        this.setFrame(fraction$1514, repeatCount$1513);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$1477.prototype.startBpm = function (bpm$1515) {
    var beatLength$1516 = 60 * 1000 / bpm$1515;
    this.animationLoop = function () {
        var duration$1518 = performance.now() - this.startTime, beatNr$1519 = Math.floor(duration$1518 / beatLength$1516), beatFraction$1520 = duration$1518 % beatLength$1516 / beatLength$1516;
        this.fromClock(beatNr$1519, beatLength$1516, beatFraction$1520);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$1477;

},{"./exploder.js":1}],5:[function(require,module,exports){
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