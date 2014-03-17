(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var StreamReader = require('./stream_reader.js'),
  Gif = require('./gif.js');

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
      spinning = false;
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

},{"./gif.js":3,"./stream_reader.js":5}],2:[function(require,module,exports){
"use strict";

var Playback = require('./playback.js');

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
    } else if (this.clock != null) {
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

  this.onClock = function (beatNr, beatDuration, beatFraction) {
    this.playback.fromClock(beatNr, beatDuration, beatFraction);
  };

  this.relayout = function () {
    if (this.fill != null) this.playback.scaleToFill();
  }
}

Polymer('x-gif', new XGif());

},{"./playback.js":4}],3:[function(require,module,exports){
"use strict";

var defaultFrameDelay = 10;

var Gif = function (frames) {
  this.frames = frames;
  this.length = 0;
  this.offsets = []

  frames.forEach(function (frame) {
    this.offsets.push(this.length);
    this.length += (frame.delay || defaultFrameDelay);
  }, this);
}

Gif.prototype.frameAt = function (fraction) {
  var offset = fraction * this.length;
  for (var i = 1, l = this.offsets.length; i < l; i++) {
    if (this.offsets[i] > offset) break;
  }
  return i - 1;
}

module.exports = Gif;

},{}],4:[function(require,module,exports){
"use strict";

var Exploder = require('./exploder.js');

// Private functions for setup
function addClasses(element, frame) {
  element.classList.add('frame');
  if (frame.disposal == 2) element.classList.add('disposal-restore');
}
var createImage = function (frame) {
    var image = new Image();
    image.src = frame.url;
    addClasses(image, frame);
    return image;
  };

var Playback = function (xgif, element, file, opts) {
  // Set up out instance variables
  this.xgif = xgif;
  this.element = element;
  this.onReady = opts.onReady;
  this.pingPong = opts.pingPong;
  this.fill = opts.fill;
  this.stopped = opts.stopped;

  new Exploder(file, (function (gif) {
    // Once we have the GIF data, add things to the DOM
    console.warn("Callbacks will hurt you. I promise.")
    console.log("Received " + gif.frames.length + " frames of gif " + file)
    this.gif = gif;

    this.element.innerHTML = "";
    var createFrameElement = createImage;//(this.fill) ? createDiv : createImage;
    gif.frames.map(createFrameElement)
      .forEach(this.element.appendChild, this.element);

    if (this.fill) requestAnimationFrame(this.scaleToFill.bind(this));

    this.onReady();
  }).bind(this));
};

Playback.prototype.scaleToFill = function () {
  if (!(this.element.offsetWidth && this.element.offsetHeight)) {
    requestAnimationFrame(this.scaleToFill.bind(this));
  } else {
    var xScale = this.element.parentElement.offsetWidth / this.element.offsetWidth,
      yScale = this.element.parentElement.offsetHeight / this.element.offsetHeight;

    this.element.style.webkitTransform = "scale(" + 1.1 * Math.max(xScale, yScale) + ")";
  }
}

Playback.prototype.setFrame = function (fraction, repeatCount) {
  var frameNr = (this.pingPong && repeatCount % 2 >= 1) ? this.gif.frameAt(1 - fraction) : this.gif.frameAt(fraction);
  this.element.dataset['frame'] = frameNr;
}

Playback.prototype.start = function () {
  this.stopped = false;
  this.startTime = performance.now();
  if (this.animationLoop) this.animationLoop();
}

Playback.prototype.stop = function () {
  this.stopped = true;
}

Playback.prototype.startSpeed = function (speed, nTimes) {
  this.speed = speed;
  this.animationLoop = (function () {
    var gifLength = 10 * this.gif.length / this.speed,
      duration = performance.now() - this.startTime,
      repeatCount = duration / gifLength,
      fraction = repeatCount % 1;
    if (!nTimes || repeatCount < nTimes) {
      this.setFrame(fraction, repeatCount);

      if (!this.stopped) requestAnimationFrame(this.animationLoop);
    } else {
      this.setFrame(1.0, repeatCount);
      this.xgif.fire('x-gif-finished');
    }
  }).bind(this);

  if (!this.stopped) this.start();
}

Playback.prototype.fromClock = function (beatNr, beatDuration, beatFraction) {
  var speedup = 2,
    lengthInBeats = Math.max(1, Math.round((1 / speedup) * 10 * this.gif.length / beatDuration)),
    subBeat = beatNr % lengthInBeats,
    repeatCount = beatNr / lengthInBeats,
    subFraction = (beatFraction / lengthInBeats) + subBeat / lengthInBeats;
  this.setFrame(subFraction, repeatCount);
}

Playback.prototype.startHardBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm;
  this.animationLoop = (function () {
    var duration = performance.now() - this.startTime,
      repeatCount = duration / beatLength,
      fraction = repeatCount % 1;
    this.setFrame(fraction, repeatCount);

    if (!this.stopped) requestAnimationFrame(animationLoop);
  }).bind(this);

  if (!this.stopped) this.start();
}

Playback.prototype.startBpm = function (bpm) {
  var beatLength = 60 * 1000 / bpm;
  this.animationLoop = (function () {
    var duration = performance.now() - this.startTime,
      beatNr = Math.floor(duration / beatLength),
      beatFraction = (duration % beatLength) / beatLength;

    this.fromClock(beatNr, beatLength, beatFraction);

    if (!this.stopped) requestAnimationFrame(animationLoop);
  }).bind(this);

  if (!this.stopped) this.start();
}

module.exports = Playback;

},{"./exploder.js":1}],5:[function(require,module,exports){
"use strict";

var StreamReader = function (arrayBuffer) {
  this.data = new Uint8Array(arrayBuffer);
  this.index = 0;
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