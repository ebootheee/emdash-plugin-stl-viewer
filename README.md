# @bootheio/emdash-plugin-stl-viewer

An [EmDash CMS](https://emdashcms.com) plugin that embeds interactive 3D previews of STL files inside Portable Text content. Drop a `/stl` block into any post or page, paste a URL, and get a touch-friendly orbit viewer that loads `three.js` lazily on viewport entry.

![A rendered STL model embedded in an article](./screenshot.png)

## Features

- **Lazy three.js** — the library (~170 KB gzipped) downloads only when a viewer is scrolled near; pages with no STL embeds pay nothing.
- **Shared module** — additional viewers on the same page reuse the cached module, only paying for their own scene.
- **Five materials** — matte plastic, glossy plastic, brushed metal, surface-normal rainbow, unlit clay.
- **Three sizes** — compact / standard / tall, all responsive.
- **Auto-rotate on idle** — pauses on user input, resumes after a moment.
- **Touch support** — pinch-zoom, two-finger pan, one-finger orbit.
- **Progress UI** — bytes/total during model download, indeterminate while three.js loads.
- **Auto Z-up detection** — many printable STLs ship Z-up; the viewer rotates them so Y is up.
- **Auto-framing** — the model is recentered around the origin and the camera distance is derived from the bounding sphere and FOV.

## Installation

```bash
pnpm add @bootheio/emdash-plugin-stl-viewer three
# (peers: astro, emdash, three)
```

Register it in `astro.config.mjs`:

```js
import { stlViewerPlugin } from "@bootheio/emdash-plugin-stl-viewer";

export default defineConfig({
	integrations: [
		emdash({
			plugins: [stlViewerPlugin()],
			// ...
		}),
	],
});
```

That's it. The block type `stl-viewer` is now available in the Portable Text editor's slash menu.

## Authoring

In the editor, type `/` and pick **3D Model (STL)**. Fill in:

| Field | Description |
| --- | --- |
| **STL URL** | Direct URL to the file. Upload via the EmDash media library and paste the `/_emdash/api/media/file/…` URL, or use any CORS-permitting external host. |
| **Title** | Optional header text. |
| **Caption** | Optional figcaption below the viewer. |
| **Material** | Matte plastic, glossy plastic, brushed metal, normal map, or unlit clay. |
| **Color** | Hex color for matte/glossy/metal materials. Ignored by `normal`. |
| **Viewer height** | Compact (320 px), Standard (440 px), Tall (560 px). |
| **Auto-rotate when idle** | Off if you'd rather have a static front view. |
| **Show ground plane** | Subtle grid beneath the model. |

## Architecture

The plugin is **native format** — that's required for Portable Text block types because they need Astro components for site-side rendering.

```
src/
├── index.ts              # PluginDescriptor + definePlugin() (Native format)
└── astro/
    ├── index.ts          # Exports `blockComponents` map
    ├── StlViewer.astro   # Server-rendered placeholder + scoped CSS
    └── viewer-client.ts  # Lazy three.js init, OrbitControls, lifecycle
```

The Astro component renders a placeholder card with a CSS-animated phantom cube. When the wrapper enters the viewport (`IntersectionObserver`, 400 px root margin), the client script:

1. Dynamically imports `three`, `three/addons/controls/OrbitControls.js`, and `three/addons/loaders/STLLoader.js` (memoised — one fetch per page).
2. Streams the STL via `fetch` with a progress callback so large files show byte counts.
3. Recenters the geometry around the origin, computes smooth-shaded normals, sits the grid at the model's base.
4. Mounts a `WebGLRenderer` canvas inside the stage, attaches `OrbitControls`.
5. Hooks up `ResizeObserver` so the renderer follows container resizes, and a second `IntersectionObserver` to pause the render loop when offscreen.

### A note on Astro scoped CSS

The canvas element is injected by `three.js` at runtime, so it doesn't carry the `data-astro-cid-*` attribute Astro adds to elements declared inside the component. Any selector targeting the canvas must use `:global(canvas)`, or Astro's scope rewrite will silently leave the runtime element unstyled. The viewer hits this in two places — both are wrapped accordingly in `StlViewer.astro`.

### Bundle layout

Built via Vite (Astro):

| Chunk | Size | When loaded |
| --- | ---: | --- |
| `StlViewer.astro_…js` | ~7 KB | Eagerly with the page that has a viewer |
| `three.module.js` | ~690 KB | First viewer hits viewport |
| `OrbitControls.js` | ~19 KB | First viewer hits viewport |
| `STLLoader.js` | ~3 KB | First viewer hits viewport |

## Development

```bash
pnpm install
pnpm generate-fixtures   # writes cube.stl / icosahedron.stl / torus.stl / knurled.stl
pnpm typecheck
```

The `generate-fixtures` script writes binary STLs to `public/stls/` of the host repo (resolved relative to the package location); tweak the paths if you're using it standalone.

## License

MIT — see [LICENSE](./LICENSE).
