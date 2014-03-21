(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
;
var DirectDomUpdater$10620 = function (element$10621) {
    this.element = element$10621;
};
DirectDomUpdater$10620.prototype.initNewGif = function (gif$10622, fill$10623) {
    this.element.innerHTML = '';
    gif$10622.frames.map(function (frame$10626) {
        var image$10627 = new Image();
        image$10627.src = frame$10626.url;
        image$10627.classList.add('frame');
        if (frame$10626.disposal == 2)
            image$10627.classList.add('disposal-restore');
        this.element.appendChild(image$10627);
    }.bind(this));
    if (fill$10623)
        requestAnimationFrame(this.scaleToFill.bind(this));
};
DirectDomUpdater$10620.prototype.scaleToFill = function () {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
        requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
        var xScale$10628 = this.element.parentElement.offsetWidth / this.element.offsetWidth, yScale$10629 = this.element.parentElement.offsetHeight / this.element.offsetHeight;
        this.element.style.webkitTransform = 'scale(' + 1.1 * Math.max(xScale$10628, yScale$10629) + ')';
    }
};
DirectDomUpdater$10620.prototype.setFrame = function (frameNr$10630) {
    this.element.dataset['frame'] = frameNr$10630;
};
module.exports = DirectDomUpdater$10620;

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
var defaultFrameDelay$10694 = 10;
var Gif$10695 = function (frames$10696) {
    this.frames = frames$10696;
    this.length = 0;
    this.offsets = [];
    frames$10696.forEach(function (frame$10699) {
        this.offsets.push(this.length);
        this.length += frame$10699.delay || defaultFrameDelay$10694;
    }.bind(this));
};
Gif$10695.prototype.frameAt = function (fraction$10700) {
    var offset$10701 = fraction$10700 * this.length;
    for (var i$10702 = 1, l$10703 = this.offsets.length; i$10702 < l$10703; i$10702++) {
        if (this.offsets[i$10702] > offset$10701)
            break;
    }
    return i$10702 - 1;
};
module.exports = Gif$10695;

},{}],5:[function(require,module,exports){
'use strict';
;
var Exploder$10534 = require('./exploder.js');
var Playback$10535 = function (xgif$10536, domUpdater$10537, file$10538, opts$10539) {
    // Set up out instance variables
    this.xgif = xgif$10536;
    this.domUpdater = domUpdater$10537;
    this.onReady = opts$10539.onReady;
    this.pingPong = opts$10539.pingPong;
    this.fill = opts$10539.fill;
    this.stopped = opts$10539.stopped;
    new Exploder$10534(file$10538, function (gif$10541) {
        // Once we have the GIF data, add things to the DOM
        console.warn('Callbacks will hurt you. I promise.');
        console.log('Received ' + gif$10541.frames.length + ' frames of gif ' + file$10538);
        this.gif = gif$10541;
        this.domUpdater.initNewGif(gif$10541);
        this.onReady();
    }.bind(this));
};
Playback$10535.prototype.setFrame = function (fraction$10542, repeatCount$10543) {
    var frameNr$10544 = this.pingPong && repeatCount$10543 % 2 >= 1 ? this.gif.frameAt(1 - fraction$10542) : this.gif.frameAt(fraction$10542);
    this.domUpdater.setFrame(frameNr$10544);
};
Playback$10535.prototype.start = function () {
    this.stopped = false;
    this.startTime = performance.now();
    if (this.animationLoop)
        this.animationLoop();
};
Playback$10535.prototype.stop = function () {
    this.stopped = true;
};
Playback$10535.prototype.startSpeed = function (speed$10545, nTimes$10546) {
    this.speed = speed$10545;
    this.animationLoop = function () {
        var gifLength$10548 = 10 * this.gif.length / this.speed, duration$10549 = performance.now() - this.startTime, repeatCount$10550 = duration$10549 / gifLength$10548, fraction$10551 = repeatCount$10550 % 1;
        if (!nTimes$10546 || repeatCount$10550 < nTimes$10546) {
            this.setFrame(fraction$10551, repeatCount$10550);
            if (!this.stopped)
                requestAnimationFrame(this.animationLoop);
        } else {
            this.setFrame(nTimes$10546 % 1 || 1, repeatCount$10550);
            this.xgif.fire('x-gif-finished');
        }
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$10535.prototype.fromClock = function (beatNr$10552, beatDuration$10553, beatFraction$10554) {
    var speedup$10555 = 1.5, lengthInBeats$10556 = Math.max(1, Math.round(1 / speedup$10555 * 10 * this.gif.length / beatDuration$10553)), subBeat$10557 = beatNr$10552 % lengthInBeats$10556, repeatCount$10558 = beatNr$10552 / lengthInBeats$10556, subFraction$10559 = beatFraction$10554 / lengthInBeats$10556 + subBeat$10557 / lengthInBeats$10556;
    this.setFrame(subFraction$10559, repeatCount$10558);
};
Playback$10535.prototype.startHardBpm = function (bpm$10560) {
    var beatLength$10561 = 60 * 1000 / bpm$10560;
    this.animationLoop = function () {
        var duration$10563 = performance.now() - this.startTime, repeatCount$10564 = duration$10563 / beatLength$10561, fraction$10565 = repeatCount$10564 % 1;
        this.setFrame(fraction$10565, repeatCount$10564);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
Playback$10535.prototype.startBpm = function (bpm$10566) {
    var beatLength$10567 = 60 * 1000 / bpm$10566;
    this.animationLoop = function () {
        var duration$10569 = performance.now() - this.startTime, beatNr$10570 = Math.floor(duration$10569 / beatLength$10567), beatFraction$10571 = duration$10569 % beatLength$10567 / beatLength$10567;
        this.fromClock(beatNr$10570, beatLength$10567, beatFraction$10571);
        if (!this.stopped)
            requestAnimationFrame(this.animationLoop);
    }.bind(this);
    if (!this.stopped)
        this.start();
};
module.exports = Playback$10535;

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