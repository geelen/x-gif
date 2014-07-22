"use strict";

import Playback from './playback.js';
import Strategies from './strategies.js';

angular.module('x-gif', [])
  // Angular strips the 'x' off <x-gif> cause reasons
  .directive('gif', function () {
    return {
      restrict: 'E',
      template: '<div class="frames-wrapper"><div class="x-gif__frames"></div></div>',
      link: function (scope, element, attrs) {
        var xGif = Object.create(attrs, {
          fire: {
            value: function (event) {
              console.log(event);
            }
          }
        });

        if (xGif.exploded != null) {
          xGif.playbackStrategy = 'noop'
        } else if (xGif.sync != null) {
          xGif.playbackStrategy = 'noop';
        } else if (xGif.hardBpm) {
          xGif.playbackStrategy = 'hardBpm';
        } else if (xGif.bpm) {
          xGif.playbackStrategy = 'bpm';
        } else {
          xGif.speed = xGif.speed || 1.0;
          xGif.playbackStrategy = 'speed';
        }

        attrs.$observe('src', function (src) {
          if (!src) return;
          var playbackStrategy = Strategies[xGif.playbackStrategy];
          xGif.playback = new Playback(xGif, element[0].querySelector('.x-gif__frames'), xGif.src, {
            pingPong: xGif.pingPong != null,
            fill: xGif.fill != null,
            stopped: xGif.stopped != null
          });
          xGif.playback.ready.then(playbackStrategy.bind(xGif));
        })

        attrs.$observe('speed', function (speed) {
          if (!speed) return;
          if (xGif.playback) xGif.playback.speed = speed;
        });

        element[0].clock = function (beatNr, beatDuration, beatFraction) {
          if (xGif.playback && xGif.playback.gif) xGif.playback.fromClock(beatNr, beatDuration, beatFraction);
        }

        element[0].relayout = function () {
          if (xGif.playback && xGif.fill != null) xGif.playback.scaleToFill();
        }
      }
    }
  });
