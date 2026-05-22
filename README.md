# emdash-plugin-stl-viewer

[![npm version](https://img.shields.io/npm/v/emdash-plugin-stl-viewer.svg)](https://www.npmjs.com/package/emdash-plugin-stl-viewer)
[![npm downloads](https://img.shields.io/npm/dm/emdash-plugin-stl-viewer.svg)](https://www.npmjs.com/package/emdash-plugin-stl-viewer)
[![license](https://img.shields.io/npm/l/emdash-plugin-stl-viewer.svg)](./LICENSE)

An [EmDash CMS](https://emdashcms.com) plugin that embeds interactive 3D previews of **STL** and **3MF** files inside Portable Text content. Drop a 3D Model block into any post or page, pick a file (or paste a URL), and get a touch-friendly orbit viewer that loads `three.js` lazily on viewport entry.

![A rendered STL model embedded in an article](./screenshot.png)

## Features

- **STL and 3MF** — both formats supported. Format is auto-detected from the URL's file extension (`.stl` / `.3mf`); set an explicit override in the block form for opaque URLs.
- **Lazy three.js** — the library (~170 KB gzipped) downloads only when a viewer is scrolled near; pages with no model embeds pay nothing.
- **Lazy 3MF decoder** — the `3MFLoader` (plus the bundled fflate zip decoder) loads on-demand the first time a 3MF URL is encountered. Pages with STL-only content never pay the 3MF cost.
- **Shared module** — additional viewers on the same page reuse the cached module, only paying for their own scene.
- **Five materials** — matte plastic, glossy plastic, brushed metal, surface-normal rainbow, unlit clay. The configured material is applied uniformly to 3MF imports (the file's embedded materials are intentionally overridden so blocks render consistently with STL).
- **Three sizes** — compact / standard / tall, all responsive.
- **Auto-rotate on idle** — pauses on user input, resumes after a moment.
- **Touch support** — pinch-zoom, two-finger pan, one-finger orbit.
- **Progress UI** — bytes/total during model download, indeterminate while three.js loads.
- **Auto Z-up detection** — many printable STLs and 3MFs ship Z-up; the viewer rotates them so Y is up.
- **Auto-framing** — the model is recentered around the origin and the camera distance is derived from the bounding sphere and FOV.

## Installation

```bash
pnpm add emdash-plugin-stl-viewer three
# (peers: astro, emdash, three)
```

Register it in `astro.config.mjs`:

```js
import { stlViewerPlugin } from "emdash-plugin-stl-viewer";

export default defineConfig({
	integrations: [
		emdash({
			plugins: [stlViewerPlugin()],
			// ...
		}),
	],
});
```

That's it. The block type `stl-viewer` (labeled **"3D Model (STL or 3MF)"** in the slash menu) is now available in the Portable Text editor.

## Authoring

In the editor, type `/` and pick **3D Model (STL or 3MF)**. Fill in:

| Field | Description |
| --- | --- |
| **Model file** | Opens the EmDash media picker filtered to `model/*` MIME types. Pick an existing asset, upload a new `.stl`/`.3mf`, or paste a URL directly into the input. |
| **Format** | Auto-detect from URL (default) / STL / 3MF. Override when the URL has no extension. |
| **Title** | Optional header text. |
| **Caption** | Optional figcaption below the viewer. |
| **Material** | Matte plastic, glossy plastic, brushed metal, normal map, or unlit clay. |
| **Color** | Hex color for matte/glossy/metal materials. Ignored by `normal`. |
| **Viewer height** | Compact (320 px), Standard (440 px), Tall (560 px). |
| **Auto-rotate when idle** | Off if you'd rather have a static front view. |
| **Show ground plane** | Subtle grid beneath the model. |

### Uploading STL or 3MF files

The block's **Model file** field uses EmDash's `media_picker` with `mime_type_filter: "model/"`. In the popup you can:

- **Select** an existing asset (filtered to `model/*` MIME types).
- **Upload** a new `.stl` or `.3mf` — the file dialog's `accept` is scoped to `model/`, and EmDash's `/_emdash/api/media/upload-url` endpoint passes the MIME type through to R2 without a global allowlist.
- **Paste a URL** directly into the input — the field value is a plain string, so external URLs (`https://…`) work too.

Browsers may not recognise `.stl` / `.3mf` from extension alone (the `Content-Type` arrives as `application/octet-stream`). EmDash now retains the upload's original `Content-Type` header, but if you're hosting your own asset server, set `Content-Type: model/stl` or `model/3mf` explicitly. The viewer itself does not require a particular MIME type — it sniffs the URL's extension or the explicit `format` override.

## Architecture

The plugin is **native format** — that's required for Portable Text block types because they need Astro components for site-side rendering.

```
src/
├── index.ts              # PluginDescriptor + definePlugin() (Native format)
└── astro/
    ├── index.ts          # Exports `blockComponents` map
    ├── StlViewer.astro   # Server-rendered placeholder + scoped CSS
    └── viewer-client.ts  # Lazy three.js + 3MF init, OrbitControls, lifecycle
```

The Astro component renders a placeholder card with a CSS-animated phantom cube. When the wrapper enters the viewport (`IntersectionObserver`, 400 px root margin), the client script:

1. Dynamically imports `three`, `three/addons/controls/OrbitControls.js`, and `three/addons/loaders/STLLoader.js` (memoised — one fetch per page).
2. If the URL ends in `.3mf` (or `format === "3mf"`), additionally imports `three/addons/loaders/3MFLoader.js` lazily.
3. Streams the model via `fetch` with a progress callback so large files show byte counts.
4. STL: parses to a single `BufferGeometry`, recenters it, computes smooth-shaded normals.
   3MF: parses to a `Group` (potentially multi-mesh), replaces embedded materials with the configured material, repositions the group's centroid to the origin.
5. Mounts a `WebGLRenderer` canvas inside the stage, attaches `OrbitControls`.
6. Hooks up `ResizeObserver` so the renderer follows container resizes, and a second `IntersectionObserver` to pause the render loop when offscreen.

### A note on Astro scoped CSS

The canvas element is injected by `three.js` at runtime, so it doesn't carry the `data-astro-cid-*` attribute Astro adds to elements declared inside the component. Any selector targeting the canvas must use `:global(canvas)`, or Astro's scope rewrite will silently leave the runtime element unstyled. The viewer hits this in two places — both are wrapped accordingly in `StlViewer.astro`.

### Bundle layout

Built via Vite (Astro):

| Chunk | Approx size | When loaded |
| --- | ---: | --- |
| `StlViewer.astro_…js` | ~7 KB | Eagerly with the page that has a viewer |
| `three.module.js` | ~690 KB | First viewer hits viewport |
| `OrbitControls.js` | ~19 KB | First viewer hits viewport |
| `STLLoader.js` | ~3 KB | First viewer hits viewport |
| `3MFLoader.js` (+ fflate) | ~50 KB | Only on the first 3MF viewer on a page |

## Development

```bash
pnpm install
pnpm generate-fixtures   # writes cube.stl / icosahedron.stl / torus.stl / knurled.stl to public/stls/ of the host repo
pnpm typecheck
```

## Compatibility

- Astro `>= 6.0`
- EmDash `>= 0.12` (uses Block Kit's `media_picker` element with `mime_type_filter`).
- `three` `^0.171.0`

## Changelog

- **0.3.0** — Switch the Model URL field to a `media_picker` filtered to `model/*` MIME types. Authors get a unified pick/upload/paste-URL popup in the block form. Bumps the required EmDash version to `>= 0.12`. Existing content is unchanged — the field value is still a plain URL string.
- **0.2.0** — Add 3MF support alongside STL. `3MFLoader` (plus the bundled fflate zip decoder) lazy-loads only when a 3MF URL is encountered.
- **0.1.0** — Initial release. STL viewer block with five materials, three sizes, auto-rotate, touch support, and a lazy three.js bundle.

## License

MIT — see [LICENSE](./LICENSE).
