"use strict";

import Playback from './playback.js';
import Strategies from './strategies.js';

(function(document, owner){

  var XGifController = function(context){
    // save the context to the custom element
    this.context = context;

    // Create a shadow root
    this.shadow = this.context.createShadowRoot();

    // stamp out our template in the shadow dom
    var template = owner.querySelector("#template").content.cloneNode(true);
    this.shadow.appendChild(template);

//    var observer = new MutationObserver(function (mutations) {
//      mutations.forEach(mutation => {
//        console.log({
//          mutation: mutation,
//          el: mutation.target
//        })
//      })
//    })
//    observer.observe(context, {attributes: true, childList: false, characterData: false});
//    src speed bpm hard-bpm exploded n-times ping-pong sync fill stopped

    this.speed = this.speed || 1.0;
    this.playbackStrategy = 'speed';
    var playbackStrategy = Strategies[this.playbackStrategy];
    console.log(context.getAttribute('src'))
    console.log(this.shadow.querySelector('#frames'))

    this.playback = new Playback(this, this.shadow.querySelector('#frames'), context.getAttribute('src'), {
      pingPong: this['ping-pong'] != null,
      fill: this.fill != null,
      stopped: this.stopped != null
    });
    this.playback.ready.then(playbackStrategy.bind(this));
  };

  // Register the element in the document
  var XGif = Object.create(HTMLElement.prototype);
  XGif.createdCallback = function(){
    this.controller = new XGifController(this);
  };

  // Register our todo-item tag with the document
  document.registerElement('x-gif', {prototype: XGif});

})(document, (document._currentScript || document.currentScript).ownerDocument)
