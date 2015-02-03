// Private functions for setup
function addClasses(element, frame) {
  element.classList.add('frame');
  if (frame.disposal == 2) element.classList.add('disposal-restore');
}
var createImage = function (frame) {
  var image = new Image();
  image.src = frame.url;
  addClasses(image, frame);
  return image;
};

export default class Renderer {
  constructor(gif, element, fill) {
    this.element = element;

    this.element.innerHTML = "";
    gif.frames.map(createImage)
      .forEach(this.element.appendChild, this.element);

    if (fill) requestAnimationFrame(this.scaleToFill.bind(this));
  }

  scaleToFill() {
    if (!(this.element.offsetWidth && this.element.offsetHeight)) {
      requestAnimationFrame(this.scaleToFill.bind(this));
    } else {
      var xScale = this.element.parentElement.offsetWidth / this.element.offsetWidth,
        yScale = this.element.parentElement.offsetHeight / this.element.offsetHeight;

      this.element.style.webkitTransform = "scale(" + 1.1 * Math.max(xScale, yScale) + ")";
    }
  }

  setFrame(frameNr) {
    this.element.dataset['frame'] = frameNr;
  }

  emit(event) {
    this.element.dispatchEvent(new CustomEvent(event), true);
  }
}

