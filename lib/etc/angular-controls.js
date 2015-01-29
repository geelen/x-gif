angular.module('x-gif-demo', []).controller('DemoCtrl', function ($scope, $sce, $location, $http) {
  $scope.gifs = [
    "http://i.imgur.com/iKXH4E2.gif",
    "http://i.imgur.com/RY2vTBQ.gif",
    "http://i.imgur.com/YlxOOI7.gif",
    "http://i.imgur.com/5KSc0px.gif",
    "http://i.imgur.com/m25uYzq.gif",
    "http://i.imgur.com/ifR7csn.gif"
  ];
  $scope.gif = {
    url: $scope.gifs[0],
    speed: 2,
    bpm: 60,
    playbackRate: 1,
    nTimes: 1.0
  };
  var audio = document.querySelector('audio');
  $scope.changeSpeed = function (delta) {
    audio.playbackRate = Math.max(0.5, audio.playbackRate + delta);
    $scope.gif.playbackRate = audio.playbackRate;
  }
  var nTimesElem = document.querySelector('#nTimes');
  $scope.nTimesRestart = function () {
    nTimesElem.removeAttribute('stopped');
  }
  $scope.nTimesIsStopped = function () {
    return nTimesElem.hasAttribute('stopped') ? " stopped" : "";
  }
  nTimesElem.addEventListener('x-gif-finished', function () {
    $scope.$apply();
  })
  $http.get('vendor/encom_part_ii.json').then(function (response) {
    $scope.gif.metadata = response.data;
    setupAudioSynching(audio,
      document.querySelectorAll('.x-gif-synced-demo'),
      $scope.gif.metadata)
  })
  $scope.trustedUrl = function () {
    return $sce.trustAsResourceUrl($scope.gif.url);
  }
  $scope.loc = $location;
  $scope.$watch('loc.path()', function (e) {
    if (e) $scope.gif.url = e.slice(1);
  })
  $scope.$watch('gif.url', function (e) {
    if (e) $scope.loc.path(e);
  })
});
