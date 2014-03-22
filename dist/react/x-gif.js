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
var defaultFrameDelay$840 = 10;
var Gif$841 = function (frames$842) {
    this.frames = frames$842;
    this.length = 0;
    this.offsets = [];
    frames$842.forEach(function (frame$845) {
        this.offsets.push(this.length);
        this.length += frame$845.delay || defaultFrameDelay$840;
    }.bind(this));
};
Gif$841.prototype.frameAt = function (fraction$846) {
    var offset$847 = fraction$846 * this.length;
    for (var i$848 = 1, l$849 = this.offsets.length; i$848 < l$849; i$848++) {
        if (this.offsets[i$848] > offset$847)
            break;
    }
    return i$848 - 1;
};
module.exports = Gif$841;

},{}],4:[function(require,module,exports){
'use strict';
;
var Exploder$739 = require('./exploder.js');
var Playback$740 = function (xgif$741, domUpdater$742, file$743, opts$744) {
    // Set up out instance variables
    this.xgif = xgif$741;
    this.domUpdater = domUpdater$742;
    this.onReady = opts$744.onReady;
    this.pingPong = opts$744.pingPong;
    this.fill = opts$744.fill;
    this.stopped = opts$744.stopped;
    new Exploder$739(file$743, function (gif$746) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$746.frames.length + ' frames of gif ' + file$743);
        this.gif = gif$746;
        this.domUpdater.initNewGif(gif$746);
        this.onReady();
    }.bind(this));
};
Playback$740.prototype.setFrame = function (fraction$747, repeatCount$748) {
    var frameNr$749 = this.pingPong && repeatCount$748 % 2 >= 1 ? this.gif.frameAt(1 - fraction$747) : this.gif.frameAt(fraction$747);
    this.domUpdater.setFrame(frameNr$749);
};
Playback$740.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$740.prototype.stop = function () {
    this.stopped = true;
};
Playback$740.prototype.startSpeed = function (speed$750, nTimes$751) {
    this.speed = speed$750;
    this.animationLoop = function () {
        var gifLength$753 = 10 * this.gif.length / this.speed, duration$754 = performance.now() - this.startTime, repeatCount$755 = duration$754 / gifLength$753, fraction$756 = repeatCount$755 % 1;
        if (!nTimes$751 || repeatCount$755 < nTimes$751) {
            this.setFrame(fraction$756, repeatCount$755);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$751 % 1 || 1, repeatCount$755);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$740.prototype.fromClock = function (beatNr$757, beatDuration$758, beatFraction$759) {
    var speedup$760 = 1.5, lengthInBeats$761 = Math.max(1, Math.round(1 / speedup$760 * 10 * this.gif.length / beatDuration$758)), subBeat$762 = beatNr$757 % lengthInBeats$761, repeatCount$763 = beatNr$757 / lengthInBeats$761, subFraction$764 = beatFraction$759 / lengthInBeats$761 + subBeat$762 / lengthInBeats$761;
    this.setFrame(subFraction$764, repeatCount$763);
};
Playback$740.prototype.startHardBpm = function (bpm$765) {
    var beatLength$766 = 60 * 1000 / bpm$765;
    this.animationLoop = function () {
        var duration$768 = performance.now() - this.startTime, repeatCount$769 = duration$768 / beatLength$766, fraction$770 = repeatCount$769 % 1;
        this.setFrame(fraction$770, repeatCount$769);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$740.prototype.startBpm = function (bpm$771) {
    var beatLength$772 = 60 * 1000 / bpm$771;
    this.animationLoop = function () {
        var duration$774 = performance.now() - this.startTime, beatNr$775 = Math.floor(duration$774 / beatLength$772), beatFraction$776 = duration$774 % beatLength$772 / beatLength$772;
        this.fromClock(beatNr$775, beatLength$772, beatFraction$776);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$740;

},{"./exploder.js":1}],5:[function(require,module,exports){
'use strict';
;
var R$636 = React.DOM, Playback$637 = require('../playback.sjs'), frameNr$638 = 0;
var XGif$639 = React.createClass({
        displayName: 'XGif',
        count: 0,
        fire: function () {
            console.log('TODO: translate to REACT event');
        },
        initNewGif: function (gif$643) {
            this.gif = gif$643;
        },
        render: function () {
            if (!this.playback) {
                this.playback = new Playback$637(this, this, this.props.src, {
                    onReady: function () {
                        console.log('OK NOW WHAT');
                    }.bind(this),
                    pingPong: false,
                    fill: false,
                    stopped: false
                });
            }
            if (!this.gif) {
                return R$636.h1(null, 'Loading...');
            } else {
                return R$636.div({ className: 'frames-wrapper' }, R$636.div({
                    id: 'frames',
                    'data-frame-id': frameNr$638
                }, this.gif.frames.map(function (frame$647, i$648) {
                    var frameClass$649 = 'frame' + (frame$647.disposal == 2) ? ' disposal-restore' : '';
                    return R$636.img({
                        key: i$648,
                        className: frameClass$649,
                        src: frame$647.url
                    });
                }.bind(this))));
            }
        }
    });
var ExampleApplication$640 = React.createClass({
        displayName: 'ExampleApplication',
        render: function () {
            return R$636.div({ id: 'content' }, R$636.h1(null, 'Dropping JSX is a bit better?'), XGif$639({ src: 'demos/gifs/pulse.gif' }));
        }
    });
var animate$642 = function () {
        requestAnimationFrame(animate$642);
        React.renderComponent(ExampleApplication$640(null), document.querySelector('main'));
    }.bind(this);
animate$642();

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