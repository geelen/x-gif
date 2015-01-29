System.config({
  "paths": {
    "*": "*.js",
    "x-gif/*": "lib/*.js",
    "github:*": "jspm_packages/github/*.js",
    "npm:*": "jspm_packages/npm/*.js"
  }
});

System.config({
  "map": {
    "pixi": "npm:pixi@0.2.1"
  }
});

