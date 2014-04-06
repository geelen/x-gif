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

angular.module('x-gif', [])
  // Angular strips the 'x' off <x-gif> cause reasons
  .directive('gif', function () {
    return {
      restrict: 'E',
      template: '<div class="frames-wrapper"><div class="x-gif__frames"></div></div>',
      link: function (scope, element, attrs) {
        var xGif = Object.create(attrs, {
          fire: {
            value: function (event) {
              console.log(event);
            }
          }
        });

        if (xGif.exploded != null) {
          xGif.playbackStrategy = 'noop'
        } else if (xGif.sync != null) {
          xGif.playbackStrategy = 'noop';
        } else if (xGif.hardBpm) {
          xGif.playbackStrategy = 'hardBpm';
        } else if (xGif.bpm) {
          xGif.playbackStrategy = 'bpm';
        } else {
          xGif.speed = xGif.speed || 1.0;
          xGif.playbackStrategy = 'speed';
        }

        attrs.$observe('src', function (src) {
          console.log(src)
          if (!src) return;
          var playbackStrategy = Strategies[xGif.playbackStrategy].bind(xGif);
          console.log("GO TIME");
          console.log(xGif.fill != null);
          xGif.playback = new Playback(xGif, element[0].querySelector('.x-gif__frames'), xGif.src, {
            onReady: playbackStrategy,
            pingPong: xGif.pingPong != null,
            fill: xGif.fill != null,
            stopped: xGif.stopped != null
          });
        })

        attrs.$observe('speed', function (speed) {
          if (!speed) return;
          console.log("SPEED CHANGED")
          if (xGif.playback) xGif.playback.speed = speed;
        });

        element[0].clock = function (beatNr, beatDuration, beatFraction) {
          if (xGif.playback && xGif.playback.gif) xGif.playback.fromClock(beatNr, beatDuration, beatFraction);
        }
      }
    }
  });

},{"./playback.sjs":4,"./strategies.js":5}],3:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$18162 = 10;
var Gif$18163 = function (frames$18164) {
    this.frames = frames$18164;
    this.length = 0;
    this.offsets = [];
    frames$18164.forEach(function (frame$18167) {
        this.offsets.push(this.length);
        this.length += frame$18167.delay || defaultFrameDelay$18162;
    }.bind(this));
};
Gif$18163.prototype.frameAt = function (fraction$18168) {
    var offset$18169 = fraction$18168 * this.length;
    for (var i$18170 = 1, l$18171 = this.offsets.length; i$18170 < l$18171; i$18170++) {
        if (this.offsets[i$18170] > offset$18169)
            break;
    }
    return i$18170 - 1;
};
module.exports = Gif$18163;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$18052 = require('./exploder.js');
// Private functions for setup
function addClasses$18053(element$18056, frame$18057) {
    element$18056.classList.add('frame');
    if (frame$18057.disposal == 2)
        element$18056.classList.add('disposal-restore');
}
var createImage$18054 = function (frame$18058) {
    var image$18059 = new Image();
    image$18059.src = frame$18058.url;
    addClasses$18053(image$18059, frame$18058);
    return image$18059;
};
var Playback$18055 = function (xgif$18060, element$18061, file$18062, opts$18063) {
    // Set up out instance variables
    this.xgif = xgif$18060;
    this.element = element$18061;
    this.onReady = opts$18063.onReady;
    this.pingPong = opts$18063.pingPong;
    this.fill = opts$18063.fill;
    this.stopped = opts$18063.stopped;
    new Exploder$18052(file$18062, function (gif$18065) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$18065.frames.length + ' frames of gif ' + file$18062);
        this.gif = gif$18065;
        this.element.innerHTML = '';
        var createFrameElement$18066 = createImage$18054;
        //(this.fill) ? createDiv : createImage;
        gif$18065.frames.map(createFrameElement$18066).forEach(this.element.appendChild, this.element);
        if (this.fill)
            requestAnimationFrame(this.scaleToFill.bind(this));
        this.onReady();
    }.bind(this));
};
Playback$18055.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$18067 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$18068 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$18067, yScale$18068) + ')';
    }
};
Playback$18055.prototype.setFrame = function (fraction$18069, repeatCount$18070) {
    var frameNr$18071 = this.pingPong && repeatCount$18070 % 2 >= 1 ? this.gif.frameAt(1 - fraction$18069) : this.gif.frameAt(fraction$18069);
    this.element.dataset['frame'] = frameNr$18071;
};
Playback$18055.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$18055.prototype.stop = function () {
    this.stopped = true;
};
Playback$18055.prototype.startSpeed = function (speed$18072, nTimes$18073) {
    this.speed = speed$18072;
    this.animationLoop = function () {
        var gifLength$18075 = 10 * this.gif.length / this.speed, duration$18076 = performance.now() - this.startTime, repeatCount$18077 = duration$18076 / gifLength$18075, fraction$18078 = repeatCount$18077 % 1;
        if (!nTimes$18073 || repeatCount$18077 < nTimes$18073) {
            this.setFrame(fraction$18078, repeatCount$18077);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$18073 % 1 || 1, repeatCount$18077);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$18055.prototype.fromClock = function (beatNr$18079, beatDuration$18080, beatFraction$18081) {
    var speedup$18082 = 1.5, lengthInBeats$18083 = Math.max(1, Math.round(1 / speedup$18082 * 10 * this.gif.length / beatDuration$18080)), subBeat$18084 = beatNr$18079 % lengthInBeats$18083, repeatCount$18085 = beatNr$18079 / lengthInBeats$18083, subFraction$18086 = beatFraction$18081 / lengthInBeats$18083 + subBeat$18084 / lengthInBeats$18083;
    this.setFrame(subFraction$18086, repeatCount$18085);
};
Playback$18055.prototype.startHardBpm = function (bpm$18087) {
    var beatLength$18088 = 60 * 1000 / bpm$18087;
    this.animationLoop = function () {
        var duration$18090 = performance.now() - this.startTime, repeatCount$18091 = duration$18090 / beatLength$18088, fraction$18092 = repeatCount$18091 % 1;
        this.setFrame(fraction$18092, repeatCount$18091);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$18055.prototype.startBpm = function (bpm$18093) {
    var beatLength$18094 = 60 * 1000 / bpm$18093;
    this.animationLoop = function () {
        var duration$18096 = performance.now() - this.startTime, beatNr$18097 = Math.floor(duration$18096 / beatLength$18094), beatFraction$18098 = duration$18096 % beatLength$18094 / beatLength$18094;
        this.fromClock(beatNr$18097, beatLength$18094, beatFraction$18098);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$18055;

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