#Usage
```
<script>
  if ('registerElement' in document
    && 'createShadowRoot' in HTMLElement.prototype
    && 'import' in document.createElement('link')
    && 'content' in document.createElement('template')) {
    // We're using a browser with native WC support!
  } else {
    	document.write('<script src="https:\/\/cdn.rawgit.com/webcomponents/webcomponentsjs/master/webcomponents.js"><\/script>');
  }
</script>
<link rel="import" href="x-gif.html">
```

#Options
[x-gif.html](https://cdn.rawgit.com/jeno5980515/x-gif/gh-pages/dist/x-gif.html)
  `reverse`
  
#jQuery Mobile
replace
```
this.window = $( this.document[0].defaultView || this.document[0].parentWindow );
```
with
```
this.window = $(window);
```
