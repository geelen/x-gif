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

    if (context.hasAttribute('exploded')) {
      this.playbackStrategy = 'noop'
    } else if (context.hasAttribute('sync')) {
      this.playbackStrategy = 'noop';
    } else if (context.getAttribute('hard-bpm')) {
      this.playbackStrategy = 'hardBpm';
    } else if (context.getAttribute('bpm')) {
      this.playbackStrategy = 'bpm';
    } else {
      this.speed = parseFloat(context.getAttribute('speed')) || 1.0;
      this.playbackStrategy = 'speed';
    }

    this.srcChanged = function (src) {
      if (!src) return;
      console.log("Loading " + src)
      var playbackStrategy = Strategies[this.playbackStrategy];

      this.playback = new Playback(this, this.shadow.querySelector('#frames'), src, {
        pingPong: context.hasAttribute('ping-pong'),
        fill: context.hasAttribute('fill'),
        stopped: context.hasAttribute('stopped')
      });
      this.playback.ready.then(playbackStrategy.bind(this));
    }
    this.srcChanged(context.getAttribute('src'))

    this.speedChanged = function (speedStr) {
      this.speed = parseFloat(speedStr) || this.speed;
      if (this.playback) this.playback.speed = this.speed;
    }

    this.stoppedChanged = function (newVal) {
      var nowStop = newVal != null;
      if (this.playback && nowStop && !this.playback.stopped) {
        this.playback.stop();
      } else if (this.playback && !nowStop && this.playback.stopped) {
        this.playback.start();
      }
    }

    var observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
//        console.log({
//          mutation: mutation,
//          el: mutation.target,
//          old: mutation.oldValue,
//          new: mutation.target.getAttribute(mutation.attributeName)
//        })
        if (mutation.attributeName == "src") this.srcChanged(mutation.target.getAttribute(mutation.attributeName))
        if (mutation.attributeName == "speed") this.speedChanged(mutation.target.getAttribute(mutation.attributeName))
        if (mutation.attributeName == "stopped") this.stoppedChanged(mutation.target.getAttribute(mutation.attributeName))
      })
    })
    observer.observe(context, {
      attributes: true,
      attributeOldValue: true,
      childList: false,
      characterData: false
    });
//    src speed bpm hard-bpm exploded n-times ping-pong sync fill stopped

    context.togglePingPong = () => {
      if (context.hasAttribute('ping-pong')) {
        context.removeAttribute('ping-pong')
      } else {
        context.setAttribute('ping-pong', '')
      }
      if (this.playback) this.playback.pingPong = context.hasAttribute('ping-pong');
    }

    context.clock = (beatNr, beatDuration, beatFraction) => {
      if (this.playback && this.playback.gif) this.playback.fromClock(beatNr, beatDuration, beatFraction);
    };

    context.relayout = () => {
      if (context.hasAttribute('fill')) this.playback.scaleToFill();
    }
  };

  // Register the element in the document
  var XGif = Object.create(HTMLElement.prototype);
  XGif.createdCallback = function(){
    this.controller = new XGifController(this);
  };
  XGif.attributeChangedCallback = function () {
    console.log(arguments)
  }

  // Register our todo-item tag with the document
  document.registerElement('x-gif', {prototype: XGif});

})(document, (document._currentScript || document.currentScript).ownerDocument)
