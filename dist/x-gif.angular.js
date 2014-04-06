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
      }
    }
  });

},{"./playback.sjs":4,"./strategies.js":5}],3:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$14674 = 10;
var Gif$14675 = function (frames$14676) {
    this.frames = frames$14676;
    this.length = 0;
    this.offsets = [];
    frames$14676.forEach(function (frame$14679) {
        this.offsets.push(this.length);
        this.length += frame$14679.delay || defaultFrameDelay$14674;
    }.bind(this));
};
Gif$14675.prototype.frameAt = function (fraction$14680) {
    var offset$14681 = fraction$14680 * this.length;
    for (var i$14682 = 1, l$14683 = this.offsets.length; i$14682 < l$14683; i$14682++) {
        if (this.offsets[i$14682] > offset$14681)
            break;
    }
    return i$14682 - 1;
};
module.exports = Gif$14675;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$14564 = require('./exploder.js');
// Private functions for setup
function addClasses$14565(element$14568, frame$14569) {
    element$14568.classList.add('frame');
    if (frame$14569.disposal == 2)
        element$14568.classList.add('disposal-restore');
}
var createImage$14566 = function (frame$14570) {
    var image$14571 = new Image();
    image$14571.src = frame$14570.url;
    addClasses$14565(image$14571, frame$14570);
    return image$14571;
};
var Playback$14567 = function (xgif$14572, element$14573, file$14574, opts$14575) {
    // Set up out instance variables
    this.xgif = xgif$14572;
    this.element = element$14573;
    this.onReady = opts$14575.onReady;
    this.pingPong = opts$14575.pingPong;
    this.fill = opts$14575.fill;
    this.stopped = opts$14575.stopped;
    new Exploder$14564(file$14574, function (gif$14577) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$14577.frames.length + ' frames of gif ' + file$14574);
        this.gif = gif$14577;
        this.element.innerHTML = '';
        var createFrameElement$14578 = createImage$14566;
        //(this.fill) ? createDiv : createImage;
        gif$14577.frames.map(createFrameElement$14578).forEach(this.element.appendChild, this.element);
        if (this.fill)
            requestAnimationFrame(this.scaleToFill.bind(this));
        this.onReady();
    }.bind(this));
};
Playback$14567.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$14579 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$14580 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$14579, yScale$14580) + ')';
    }
};
Playback$14567.prototype.setFrame = function (fraction$14581, repeatCount$14582) {
    var frameNr$14583 = this.pingPong && repeatCount$14582 % 2 >= 1 ? this.gif.frameAt(1 - fraction$14581) : this.gif.frameAt(fraction$14581);
    this.element.dataset['frame'] = frameNr$14583;
};
Playback$14567.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$14567.prototype.stop = function () {
    this.stopped = true;
};
Playback$14567.prototype.startSpeed = function (speed$14584, nTimes$14585) {
    this.speed = speed$14584;
    this.animationLoop = function () {
        var gifLength$14587 = 10 * this.gif.length / this.speed, duration$14588 = performance.now() - this.startTime, repeatCount$14589 = duration$14588 / gifLength$14587, fraction$14590 = repeatCount$14589 % 1;
        if (!nTimes$14585 || repeatCount$14589 < nTimes$14585) {
            this.setFrame(fraction$14590, repeatCount$14589);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$14585 % 1 || 1, repeatCount$14589);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$14567.prototype.fromClock = function (beatNr$14591, beatDuration$14592, beatFraction$14593) {
    var speedup$14594 = 1.5, lengthInBeats$14595 = Math.max(1, Math.round(1 / speedup$14594 * 10 * this.gif.length / beatDuration$14592)), subBeat$14596 = beatNr$14591 % lengthInBeats$14595, repeatCount$14597 = beatNr$14591 / lengthInBeats$14595, subFraction$14598 = beatFraction$14593 / lengthInBeats$14595 + subBeat$14596 / lengthInBeats$14595;
    this.setFrame(subFraction$14598, repeatCount$14597);
};
Playback$14567.prototype.startHardBpm = function (bpm$14599) {
    var beatLength$14600 = 60 * 1000 / bpm$14599;
    this.animationLoop = function () {
        var duration$14602 = performance.now() - this.startTime, repeatCount$14603 = duration$14602 / beatLength$14600, fraction$14604 = repeatCount$14603 % 1;
        this.setFrame(fraction$14604, repeatCount$14603);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$14567.prototype.startBpm = function (bpm$14605) {
    var beatLength$14606 = 60 * 1000 / bpm$14605;
    this.animationLoop = function () {
        var duration$14608 = performance.now() - this.startTime, beatNr$14609 = Math.floor(duration$14608 / beatLength$14606), beatFraction$14610 = duration$14608 % beatLength$14606 / beatLength$14606;
        this.fromClock(beatNr$14609, beatLength$14606, beatFraction$14610);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$14567;

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