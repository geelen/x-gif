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

// wtf browserify
var x = require('./react/x-gif.sjs');

},{"./react/x-gif.sjs":5}],3:[function(require,module,exports){
'use strict';
;
var defaultFrameDelay$18405 = 10;
var Gif$18406 = function (frames$18407) {
    this.frames = frames$18407;
    this.length = 0;
    this.offsets = [];
    frames$18407.forEach(function (frame$18410) {
        this.offsets.push(this.length);
        this.length += frame$18410.delay || defaultFrameDelay$18405;
    }.bind(this));
};
Gif$18406.prototype.frameAt = function (fraction$18411) {
    var offset$18412 = fraction$18411 * this.length;
    for (var i$18413 = 1, l$18414 = this.offsets.length; i$18413 < l$18414; i$18413++) {
        if (this.offsets[i$18413] > offset$18412)
            break;
    }
    return i$18413 - 1;
};
module.exports = Gif$18406;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$18226 = require('./exploder.js');
var Playback$18227 = function (xgif$18228, domUpdater$18229, file$18230, opts$18231) {
    // Set up out instance variables
    this.xgif = xgif$18228;
    this.domUpdater = domUpdater$18229;
    this.onReady = opts$18231.onReady;
    this.pingPong = opts$18231.pingPong;
    this.fill = opts$18231.fill;
    this.stopped = opts$18231.stopped;
    new Exploder$18226(file$18230, function (gif$18233) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$18233.frames.length + ' frames of gif ' + file$18230);
        this.gif = gif$18233;
        this.domUpdater.initNewGif(gif$18233);
        this.onReady();
    }.bind(this));
};
Playback$18227.prototype.setFrame = function (fraction$18234, repeatCount$18235) {
    var frameNr$18236 = this.pingPong && repeatCount$18235 % 2 >= 1 ? this.gif.frameAt(1 - fraction$18234) : this.gif.frameAt(fraction$18234);
    this.domUpdater.setFrame(frameNr$18236);
};
Playback$18227.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$18227.prototype.stop = function () {
    this.stopped = true;
};
Playback$18227.prototype.startSpeed = function (speed$18237, nTimes$18238) {
    this.speed = speed$18237;
    this.animationLoop = function () {
        var gifLength$18240 = 10 * this.gif.length / this.speed, duration$18241 = performance.now() - this.startTime, repeatCount$18242 = duration$18241 / gifLength$18240, fraction$18243 = repeatCount$18242 % 1;
        if (!nTimes$18238 || repeatCount$18242 < nTimes$18238) {
            this.setFrame(fraction$18243, repeatCount$18242);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$18238 % 1 || 1, repeatCount$18242);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$18227.prototype.fromClock = function (beatNr$18244, beatDuration$18245, beatFraction$18246) {
    var speedup$18247 = 1.5, lengthInBeats$18248 = Math.max(1, Math.round(1 / speedup$18247 * 10 * this.gif.length / beatDuration$18245)), subBeat$18249 = beatNr$18244 % lengthInBeats$18248, repeatCount$18250 = beatNr$18244 / lengthInBeats$18248, subFraction$18251 = beatFraction$18246 / lengthInBeats$18248 + subBeat$18249 / lengthInBeats$18248;
    this.setFrame(subFraction$18251, repeatCount$18250);
};
Playback$18227.prototype.startHardBpm = function (bpm$18252) {
    var beatLength$18253 = 60 * 1000 / bpm$18252;
    this.animationLoop = function () {
        var duration$18255 = performance.now() - this.startTime, repeatCount$18256 = duration$18255 / beatLength$18253, fraction$18257 = repeatCount$18256 % 1;
        this.setFrame(fraction$18257, repeatCount$18256);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$18227.prototype.startBpm = function (bpm$18258) {
    var beatLength$18259 = 60 * 1000 / bpm$18258;
    this.animationLoop = function () {
        var duration$18261 = performance.now() - this.startTime, beatNr$18262 = Math.floor(duration$18261 / beatLength$18259), beatFraction$18263 = duration$18261 % beatLength$18259 / beatLength$18259;
        this.fromClock(beatNr$18262, beatLength$18259, beatFraction$18263);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$18227;

},{"./exploder.js":1}],5:[function(require,module,exports){
'use strict';
;
var Playback$18037 = require('../playback.sjs');
// Meets the api for the DomUpdater that Playback expects
// but React works totally differently.
var GifState$18038 = function () {
    this.initNewGif = function (gif$18045) {
        this.gif = gif$18045;
    }.bind(this);
    this.setFrame = function (frameNr$18046) {
        this.frameNr = frameNr$18046;
    }.bind(this);
};
var XGif$18039 = React.createClass({
        displayName: 'XGif',
        fire: function () {
            console.log('TODO: translate to REACT event');
        },
        render: function () {
            if (!this.playback) {
                // Just do this once (surely there's a better callback?)
                this.gifState = new GifState$18038();
                this.playback = new Playback$18037(this, this.gifState, this.props.src, {
                    onReady: function () {
                        if (this.props.speed) {
                            this.playback.startSpeed(this.props.speed, this.props['n-times']);
                        }
                    }.bind(this),
                    pingPong: this.props.pingPong,
                    fill: false,
                    stopped: false
                });
            }
            if (!this.gifState.gif) {
                return React.DOM.h1(null, 'Loading...');
            } else {
                return React.DOM.div({ className: 'react-x-gif frames-wrapper' }, React.DOM.div({
                    id: 'frames',
                    'data-frame': this.gifState.frameNr
                }, this.gifState.gif.frames.map(function (frame$18054, i$18055) {
                    var frameClass$18056 = 'frame' + (frame$18054.disposal == 2 ? ' disposal-restore' : '');
                    return React.DOM.img({
                        key: i$18055,
                        className: frameClass$18056,
                        src: frame$18054.url
                    });
                }.bind(this))));
            }
        }
    });
var ExampleApplication$18040 = React.createClass({
        displayName: 'ExampleApplication',
        render: function () {
            return React.DOM.div({ id: 'content' }, XGif$18039({
                src: 'demos/gifs/pulse.gif',
                speed: 0.5
            }));
        }
    });
// Requires a React animation loop, which constantly checks if the frame
// has changed. There's another animation loop inside Playback, which
// ain't great.
var animate$18042 = function () {
        requestAnimationFrame(animate$18042);
        React.renderComponent(ExampleApplication$18040(null), document.querySelector('main'));
    }.bind(this);
animate$18042();

},{"../playback.sjs":4}],6:[function(require,module,exports){
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