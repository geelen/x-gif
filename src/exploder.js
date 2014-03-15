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
