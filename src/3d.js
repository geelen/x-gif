import PIXI from 'pixi'
import Exploder from './x-gif/exploder'

// create an new instance of a pixi stage
let stage = new PIXI.Stage(0x66FF99),
  exploder = new Exploder("explosion.gif"),
  renderer = new PIXI.WebGLRenderer(1280, 720),
  dotScreenFilter = new PIXI.DotScreenFilter(),
  pixelateFilter = new PIXI.PixelateFilter(),
  rgbSplitterFilter = new PIXI.RGBSplitFilter(),
  colorStepFilter = new PIXI.ColorStepFilter()

stage.filters = [pixelateFilter]

// add the renderer view element to the DOM
document.body.appendChild(renderer.view);

exploder.load().then((gif) => {

// create a texture from an image path
  var textures = gif.frames.map(frame => PIXI.Texture.fromImage(frame.url)),
    bunnies = textures.map(texture => new PIXI.Sprite(texture)),
    currentBunny = 0

  bunnies.forEach(bunny => {
    bunny.anchor.x = 0.5
    bunny.anchor.y = 0.5
    bunny.position.x = 1280 / 2
    bunny.position.y = 720 / 2
    bunny.width = 1280
    bunny.height = 720
    bunny.alpha = 0

    stage.addChild(bunny)
  })

  requestAnimFrame(animate)

  function animate() {
    requestAnimFrame(animate)
    bunnies.forEach(bunny => bunny.alpha = 0)
    let bunny = bunnies[Math.floor(currentBunny++ / 2) % bunnies.length]
    bunny.alpha = 1

    renderer.render(stage)
  }

})

document.addEventListener('mousemove', (e) => {
  let [x,y] = [Math.round(64 * e.clientX / innerWidth), Math.round(64 * e.clientY / innerHeight)]
  dotScreenFilter.angle = y
  dotScreenFilter.scale = x
  pixelateFilter.size = {x,y}
})
