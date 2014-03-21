"use strict";

import macros from './macros.sjs';

var DirectDomUpdater = function (element) {
  this.element = element;
};

DirectDomUpdater.prototype.initNewGif = function (gif, fill) {
  this.element.innerHTML = "";

  gif.frames.map((frame) => {
    var image = new Image();
    image.src = frame.url;
    image.classList.add('frame');
    if (frame.disposal == 2) image.classList.add('disposal-restore');
    this.element.appendChild(image);
  });

  if (fill) requestAnimationFrame(this.scaleToFill.bind(this));
}

DirectDomUpdater.prototype.scaleToFill = function () {
  if (!(this.element.offsetWidth && this.element.offsetHeight)) {
    requestAnimationFrame(this.scaleToFill.bind(this));
  } else {
    var xScale = this.element.parentElement.offsetWidth / this.element.offsetWidth,
      yScale = this.element.parentElement.offsetHeight / this.element.offsetHeight;

    this.element.style.webkitTransform = "scale(" + 1.1 * Math.max(xScale, yScale) + ")";
  }
}

DirectDomUpdater.prototype.setFrame = function (frameNr) {
  this.element.dataset['frame'] = frameNr;
}

module.exports = DirectDomUpdater;
