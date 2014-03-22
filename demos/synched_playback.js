var setupAudioSynching = function (audio, xGif, metadata) {
  var synchOffset = -0.1;

  audio.addEventListener('playing', function () {
    var beats = metadata.response.track.analysis.beats,
      beatIndex = 0;
    while (beats[0].start > 0) {
      beats.unshift({
        start: beats[0].start - beats[0].duration,
        duration: beats[0].duration,
        confidence: 0
      })
    }

    var animationLoop = function () {
      requestAnimationFrame(animationLoop);

      if (beats.length > beatIndex) {
        var currentTime = audio.currentTime + synchOffset;
        while (beatIndex < beats.length && currentTime > beats[beatIndex].start) {
          beatIndex++;
        }
        var beat = beats[beatIndex - 1];

        var sinceLastBeat = currentTime - beat.start,
          beatFraction = sinceLastBeat / beat.duration;
        xGif.clock(beatIndex, beat.duration * 1000 / audio.playbackRate, beatFraction);
      }
    }
    animationLoop();
  });
}
