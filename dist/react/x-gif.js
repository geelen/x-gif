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
var defaultFrameDelay$10973 = 10;
var Gif$10974 = function (frames$10975) {
    this.frames = frames$10975;
    this.length = 0;
    this.offsets = [];
    frames$10975.forEach(function (frame$10978) {
        this.offsets.push(this.length);
        this.length += frame$10978.delay || defaultFrameDelay$10973;
    }.bind(this));
};
Gif$10974.prototype.frameAt = function (fraction$10979) {
    var offset$10980 = fraction$10979 * this.length;
    for (var i$10981 = 1, l$10982 = this.offsets.length; i$10981 < l$10982; i$10981++) {
        if (this.offsets[i$10981] > offset$10980)
            break;
    }
    return i$10981 - 1;
};
module.exports = Gif$10974;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$10872 = require('./exploder.js');
var Playback$10873 = function (xgif$10874, domUpdater$10875, file$10876, opts$10877) {
    // Set up out instance variables
    this.xgif = xgif$10874;
    this.domUpdater = domUpdater$10875;
    this.onReady = opts$10877.onReady;
    this.pingPong = opts$10877.pingPong;
    this.fill = opts$10877.fill;
    this.stopped = opts$10877.stopped;
    new Exploder$10872(file$10876, function (gif$10879) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$10879.frames.length + ' frames of gif ' + file$10876);
        this.gif = gif$10879;
        this.domUpdater.initNewGif(gif$10879);
        this.onReady();
    }.bind(this));
};
Playback$10873.prototype.setFrame = function (fraction$10880, repeatCount$10881) {
    var frameNr$10882 = this.pingPong && repeatCount$10881 % 2 >= 1 ? this.gif.frameAt(1 - fraction$10880) : this.gif.frameAt(fraction$10880);
    this.domUpdater.setFrame(frameNr$10882);
};
Playback$10873.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$10873.prototype.stop = function () {
    this.stopped = true;
};
Playback$10873.prototype.startSpeed = function (speed$10883, nTimes$10884) {
    this.speed = speed$10883;
    this.animationLoop = function () {
        var gifLength$10886 = 10 * this.gif.length / this.speed, duration$10887 = performance.now() - this.startTime, repeatCount$10888 = duration$10887 / gifLength$10886, fraction$10889 = repeatCount$10888 % 1;
        if (!nTimes$10884 || repeatCount$10888 < nTimes$10884) {
            this.setFrame(fraction$10889, repeatCount$10888);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$10884 % 1 || 1, repeatCount$10888);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$10873.prototype.fromClock = function (beatNr$10890, beatDuration$10891, beatFraction$10892) {
    var speedup$10893 = 1.5, lengthInBeats$10894 = Math.max(1, Math.round(1 / speedup$10893 * 10 * this.gif.length / beatDuration$10891)), subBeat$10895 = beatNr$10890 % lengthInBeats$10894, repeatCount$10896 = beatNr$10890 / lengthInBeats$10894, subFraction$10897 = beatFraction$10892 / lengthInBeats$10894 + subBeat$10895 / lengthInBeats$10894;
    this.setFrame(subFraction$10897, repeatCount$10896);
};
Playback$10873.prototype.startHardBpm = function (bpm$10898) {
    var beatLength$10899 = 60 * 1000 / bpm$10898;
    this.animationLoop = function () {
        var duration$10901 = performance.now() - this.startTime, repeatCount$10902 = duration$10901 / beatLength$10899, fraction$10903 = repeatCount$10902 % 1;
        this.setFrame(fraction$10903, repeatCount$10902);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$10873.prototype.startBpm = function (bpm$10904) {
    var beatLength$10905 = 60 * 1000 / bpm$10904;
    this.animationLoop = function () {
        var duration$10907 = performance.now() - this.startTime, beatNr$10908 = Math.floor(duration$10907 / beatLength$10905), beatFraction$10909 = duration$10907 % beatLength$10905 / beatLength$10905;
        this.fromClock(beatNr$10908, beatLength$10905, beatFraction$10909);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$10873;

},{"./exploder.js":1}],5:[function(require,module,exports){
'use strict';
;
var R$10769 = React.DOM, Playback$10770 = require('../playback.sjs'), frameNr$10771 = 0;
var XGif$10772 = React.createClass({
        displayName: 'XGif',
        count: 0,
        fire: function () {
            console.log('TODO: translate to REACT event');
        },
        initNewGif: function (gif$10776) {
            this.gif = gif$10776;
        },
        render: function () {
            if (!this.playback) {
                this.playback = new Playback$10770(this, this, this.props.src, {
                    onReady: function () {
                        console.log('OK NOW WHAT');
                    }.bind(this),
                    pingPong: false,
                    fill: false,
                    stopped: false
                });
            }
            if (!this.gif) {
                return R$10769.h1(null, 'Loading...');
            } else {
                return R$10769.div({ className: 'frames-wrapper' }, R$10769.div({
                    id: 'frames',
                    'data-frame-id': frameNr$10771
                }, this.gif.frames.map(function (frame$10780, i$10781) {
                    var frameClass$10782 = 'frame' + (frame$10780.disposal == 2) ? ' disposal-restore' : '';
                    return R$10769.img({
                        key: i$10781,
                        className: frameClass$10782,
                        src: frame$10780.url
                    });
                }.bind(this))));
            }
        }
    });
var ExampleApplication$10773 = React.createClass({
        displayName: 'ExampleApplication',
        render: function () {
            return R$10769.div({ id: 'content' }, R$10769.h1(null, 'Dropping JSX is a bit better?'), XGif$10772({ src: 'demos/gifs/pulse.gif' }));
        }
    });
var animate$10775 = function () {
        requestAnimationFrame(animate$10775);
        React.renderComponent(ExampleApplication$10773(null), document.querySelector('main'));
    }.bind(this);
animate$10775();

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