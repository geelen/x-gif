(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var StreamReader = require('./stream_reader.js');

var Exploder = function (file, cb) {
  this.file = file;
  this.doneCallback = cb;
  this.loadAndExplode();
};

Exploder.prototype.loadAndExplode = function () {
  var loader = new XMLHttpRequest(),
    exploder = this.explode;
  loader.open('GET', this.file, true);
  loader.responseType = 'arraybuffer';
  loader.onload = function () {
    exploder(new StreamReader(this.response));
  };
  loader.send();
}

Exploder.prototype.explode = function (streamReader) {
  console.log(streamReader);
}

module.exports = Exploder;

},{"./stream_reader.js":4}],2:[function(require,module,exports){
"use strict";

var Playback = require('./playback.js')

Polymer('x-gif', {
  file: "../gifs/nope.gif",
  ready: function () {
    console.log("READY")
  },
  fileChanged: function (oldVal, newVal) {
    var playback = new Playback(this.$.frames, newVal, function () {
      console.warn("UGH.");
      playback.startLoop(1.0);
    });
  }
})

},{"./playback.js":3}],3:[function(require,module,exports){
"use strict";

var Exploder = require('./exploder.js');

var Playback = function (el, file, cb) {
  this.exploder = new Exploder(file, function () {
    console.warn("Callbacks will hurt you. I promise.")

    cb();
  });
};

Playback.prototype.startLoop = function (speed) {
  console.log("OK")
}

module.exports = Playback;

},{"./exploder.js":1}],4:[function(require,module,exports){
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
  console.log(this.index + ": " + str);
};
StreamReader.prototype.error = function (str) {
  console.error(this.index + ": " + str);
}

module.exports = StreamReader;

},{}]},{},[2])