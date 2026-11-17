# Phase 1 notes: how "The Ascent" proof of concept works

One short note per step. Read them in order; each builds on the last.

## Step 1: Project setup
We made the folders from CLAUDE.md and turned the project into a Git repository so every step is saved.
`index.html` has three layers: the `<canvas>` where 3D is drawn, an `#overlay` for real HTML text, and a tall
`#scroll-track` that gives the page something to scroll through. The **import map** is a small JSON list that tells the
browser "when code asks for `three`, fetch it from this exact CDN address and version". Pinning versions means the site
never breaks because a library changed. `css/style.css` resets browser spacing, fixes the canvas behind everything, and
sets the dark night background.

## Step 2: The four basics
Every three.js page needs four things: a **scene** (the box that holds objects), a **camera** (our eye), a **renderer**
(turns the scene into pixels) and a **light** (so solid shapes are visible). The renderer draws at your screen's pixel
ratio, capped at 2, which is why the picture stays sharp on high-resolution screens without wasting GPU power.
`outputColorSpace = SRGB` makes colours on screen match the colours we type. A resize handler updates the camera and
canvas size whenever the window changes, and the FPS counter (add `?fps` to the address or press F) counts how many frames
are drawn each second. The `tick` function is the loop: it runs before every screen refresh and redraws the world.

## Step 3: Night sky
The sky is a giant sphere around the camera, painted from the inside by a **shader** (a tiny program that runs on the
graphics card and decides each pixel's colour). It blends three colours by height: a lighter blue at the horizon, deep
indigo in the middle and near-black navy overhead, then adds faint cloud streaks, a hint of the Milky Way and a soft moon.
Stars are 2,200 **points**; each one is drawn as a soft round glow instead of a hard white pixel, and its brightness
slowly rises and falls on its own rhythm (the twinkle). `sky.js` also owns the moonlight, the soft fill light and the fog,
because all of these must change colour together when night turns towards dawn (`setDawn(0 → 1)`). `glsl.js` holds the
"noise" helpers: smooth random patterns that make shapes feel hand-painted rather than perfect.

## Step 4: Distant mountains
The mountains are four giant curved "paper cut-outs" (ribbons) standing in rings around the world, like stage scenery.
For each one, JavaScript walks around the circle and decides the outline height using three sizes of **noise**: big
massifs, sharp ridged crests and small jagged bits (plus tiny tree tips on the near, forested ranges). The shader then
paints each layer: farther layers lean more towards the sky's horizon colour (that is the "distance haze"), the lower
slopes melt into mist, and the farthest range gets snow with a moonlit side and a shadow side. The haze colour is
*shared* with the sky, so when the sky changes at dawn the mountains change with it automatically. Scene **fog**
(set in `sky.js`) uses the same horizon colour, so the ground and trees we add next also fade into the sky.

## Step 5: The ground and the trail
The ground is one big flat grid (about 170,000 points) that we bend into hills: for every point we ask `getHeight(x, z)`,
which adds a gentle climb to the ridge, a drop into the valley beyond, slopes on both sides and soft noise bumps.
The trail is a smooth curve drawn on the map; near it the ground is flattened sideways so the path sits on a natural shelf.
The visible path is a separate thin strip with see-through edges, so it looks painted on. **Lighting lesson:** in three.js,
light colour is *multiplied* by surface colour, so a blue light on a dark-blue surface goes black. We give surfaces
mid-tone colours and let the cool moonlight make them blue, which also means the lantern can warm them later.
`groundHeight()` reads the height of the triangles actually drawn, so the path (and later tents and feet) sit exactly on
the visible surface instead of flickering in and out of it.

## Step 6: The forest
Each tree type is built **once** from simple shapes: a pine is five stacked cones on a short trunk, an oak is a cluster
of soft round blobs. Then an `InstancedMesh` draws thousands of copies in a single call to the graphics card, each copy
with its own position, size, rotation and colour tint. That is why ~6,000 trees cost only 2 draw calls.
Where trees grow is decided by rules: noise makes natural groves and clearings, trees avoid the trail and the two camps,
and they thin out as the land climbs to the open ridge. Each tree has a colour gradient painted on (dark under each layer
of branches, lighter on top), a tiny shader tweak makes the tree tops sway gently, and the new **exponential fog** makes
every row of trees a little paler than the one in front, the layered look of a painting.

## Step 7: Base camp
The tent is the top half of a sphere, stretched into a dome. Its material glows (`emissive`), and a small shader
addition (`onBeforeCompile`) decides *how much* each spot glows: brighter low down, a rounded door that glows pale
gold, darker lines where the poles cross. Two warm **point lights** (one inside the tent, one in the lantern) light up
the ground and nearby trees; because the ground near camp is coloured like trodden earth, that light reads as a warm
orange pool against the cool blue night. The soft glow around each light is a **sprite** (a flat picture that always
faces the camera) with a radial gradient, added on top of the scene; it's a cheap stand-in for a "bloom" effect.
The lantern flickers very slightly using a few overlapping sine waves, so it feels alive but calm.

## Step 8: Mist
All mist uses one small shader. It mixes two noise patterns that slide sideways at different speeds, so the mist slowly
changes shape as it drifts. A fairly tight threshold (`smoothstep`) turns the noise into soft-edged shapes that look like
brush strokes rather than smoke. Every sheet fades out at its edges and also when the camera comes close, so you never
see a hard line or "bump into" a flat plane. There are three layers: low strips that hug the ground between the trees
(their bottom edge follows `groundHeight`), a flat sheet filling the valley beyond the ridge, and a curved band resting
between the far mountain ranges. The mist colour is the sky's horizon colour lifted slightly, so it shifts at dawn too,
and the feet of the mountain layers now fade into that same pale mist instead of into darkness.

## Step 9: My trekker
`GLTFLoader` reads the `.vrm` file (VRM is glTF with extra avatar info) and the `VRMLoaderPlugin` turns it into a VRM
object with **normalized bones**: every VRM gets the same named bones (`hips`, `leftUpperArm`, …) that start in a
T-pose. A pose is just "rotate these bones by these angles", so the stand-in pose lowers the arms, bends the elbows a
little and adds slow breathing; a simple procedural walk (legs and arms swinging on a sine wave, knees bending, a
small hip bob) is ready for step 10. VRoid's toon material (MToon) reacts to light more strongly than our painted world,
so `setLightLevel()` dims and cools the character's own colours at night (and can brighten them towards dawn), and a
faint blue rim light keeps the silhouette readable. The Mixamo code follows the official three-vrm method: it maps
each Mixamo bone to its VRM bone and corrects the rotation using both skeletons' rest poses. If the FBX files aren't
there, it prints one calm message and the stand-in is used. (The browser still lists those missing files as grey
"404" network lines; that is harmless.)

## Step 10: The camera rail
**Lenis** smooths the mouse wheel so scrolling glides, and **ScrollTrigger** turns "how far down the page are we" into
one number, `progress`, from 0 to 1. That number drives the whole film: `trekkerU(progress)` says where on the trail
the trekker is (with ease-in/ease-out so they start and stop gently), and the camera rides a `CatmullRomCurve3` (a
smooth curve through points) that was built from the trail itself: about 6.5 m behind, 2.2 m up and a little to the
side, then smoothed so every bend becomes a soft, wide curve. A second smoothed curve says where the camera looks.
At the start and end the camera blends into hand-placed "opening" and "arrival" shots, and every frame it only moves a
small fraction of the way towards its target (`lerp` / `slerp`). That easing is what makes the motion slow and calm.
The trekker's walk animation speed comes from how fast they actually moved, so feet keep pace and they settle back
into idle when you stop scrolling. Trees are kept 5.5 m away from the camera's route so nothing ever crosses the lens.

## Step 11: Light and the first project camp
One number, `dawn` (0 = night, 1 = pre-dawn), is worked out from the scroll progress each frame and handed to
`sky.setDawn()`. Because the fog, lights, mist and mountain haze all *share* the sky's colour objects, they all change
together, and the trekker's colours brighten a touch too. (Phase 1 stops at 80% of the way, so the shift stays slight.)
The DERMAÉ camp is a cabin-style tent whose front wall holds a plane sized exactly like the video (1888×908), so nothing
is stretched. The `<video>` element is only created when you're about a third of the way up, and it only plays while the
camp is near, to save bandwidth and power; a `VideoTexture` copies each video frame onto the screen. The floating label is
real HTML: each frame we take a 3D point above the tent, `project()` it into screen coordinates and move the label there.
At the very end the trekker turns towards the screen, and the arrival shot frames them on the left with the screen on
the right and the peaks behind.
