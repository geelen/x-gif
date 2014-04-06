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

        element[0].relayout = function () {
          if (xGif.playback && xGif.fill != null) xGif.playback.scaleToFill();
        }
      }
    }
  });

},{"./playback.sjs":4,"./strategies.js":5}],3:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$1158 = 10;
var Gif$1159 = function (frames$1160) {
    this.frames = frames$1160;
    this.length = 0;
    this.offsets = [];
    frames$1160.forEach(function (frame$1163) {
        this.offsets.push(this.length);
        this.length += frame$1163.delay || defaultFrameDelay$1158;
    }.bind(this));
};
Gif$1159.prototype.frameAt = function (fraction$1164) {
    var offset$1165 = fraction$1164 * this.length;
    for (var i$1166 = 1, l$1167 = this.offsets.length; i$1166 < l$1167; i$1166++) {
        if (this.offsets[i$1166] > offset$1165)
            break;
    }
    return i$1166 - 1;
};
module.exports = Gif$1159;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$1048 = require('./exploder.js');
// Private functions for setup
function addClasses$1049(element$1052, frame$1053) {
    element$1052.classList.add('frame');
    if (frame$1053.disposal == 2)
        element$1052.classList.add('disposal-restore');
}
var createImage$1050 = function (frame$1054) {
    var image$1055 = new Image();
    image$1055.src = frame$1054.url;
    addClasses$1049(image$1055, frame$1054);
    return image$1055;
};
var Playback$1051 = function (xgif$1056, element$1057, file$1058, opts$1059) {
    // Set up out instance variables
    this.xgif = xgif$1056;
    this.element = element$1057;
    this.onReady = opts$1059.onReady;
    this.pingPong = opts$1059.pingPong;
    this.fill = opts$1059.fill;
    this.stopped = opts$1059.stopped;
    new Exploder$1048(file$1058, function (gif$1061) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$1061.frames.length + ' frames of gif ' + file$1058);
        this.gif = gif$1061;
        this.element.innerHTML = '';
        var createFrameElement$1062 = createImage$1050;
        //(this.fill) ? createDiv : createImage;
        gif$1061.frames.map(createFrameElement$1062).forEach(this.element.appendChild, this.element);
        if (this.fill)
            requestAnimationFrame(this.scaleToFill.bind(this));
        this.onReady();
    }.bind(this));
};
Playback$1051.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$1063 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$1064 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$1063, yScale$1064) + ')';
    }
};
Playback$1051.prototype.setFrame = function (fraction$1065, repeatCount$1066) {
    var frameNr$1067 = this.pingPong && repeatCount$1066 % 2 >= 1 ? this.gif.frameAt(1 - fraction$1065) : this.gif.frameAt(fraction$1065);
    this.element.dataset['frame'] = frameNr$1067;
};
Playback$1051.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$1051.prototype.stop = function () {
    this.stopped = true;
};
Playback$1051.prototype.startSpeed = function (speed$1068, nTimes$1069) {
    this.speed = speed$1068;
    this.animationLoop = function () {
        var gifLength$1071 = 10 * this.gif.length / this.speed, duration$1072 = performance.now() - this.startTime, repeatCount$1073 = duration$1072 / gifLength$1071, fraction$1074 = repeatCount$1073 % 1;
        if (!nTimes$1069 || repeatCount$1073 < nTimes$1069) {
            this.setFrame(fraction$1074, repeatCount$1073);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$1069 % 1 || 1, repeatCount$1073);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$1051.prototype.fromClock = function (beatNr$1075, beatDuration$1076, beatFraction$1077) {
    var speedup$1078 = 1.5, lengthInBeats$1079 = Math.max(1, Math.round(1 / speedup$1078 * 10 * this.gif.length / beatDuration$1076)), subBeat$1080 = beatNr$1075 % lengthInBeats$1079, repeatCount$1081 = beatNr$1075 / lengthInBeats$1079, subFraction$1082 = beatFraction$1077 / lengthInBeats$1079 + subBeat$1080 / lengthInBeats$1079;
    this.setFrame(subFraction$1082, repeatCount$1081);
};
Playback$1051.prototype.startHardBpm = function (bpm$1083) {
    var beatLength$1084 = 60 * 1000 / bpm$1083;
    this.animationLoop = function () {
        var duration$1086 = performance.now() - this.startTime, repeatCount$1087 = duration$1086 / beatLength$1084, fraction$1088 = repeatCount$1087 % 1;
        this.setFrame(fraction$1088, repeatCount$1087);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$1051.prototype.startBpm = function (bpm$1089) {
    var beatLength$1090 = 60 * 1000 / bpm$1089;
    this.animationLoop = function () {
        var duration$1092 = performance.now() - this.startTime, beatNr$1093 = Math.floor(duration$1092 / beatLength$1090), beatFraction$1094 = duration$1092 % beatLength$1090 / beatLength$1090;
        this.fromClock(beatNr$1093, beatLength$1090, beatFraction$1094);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$1051;

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