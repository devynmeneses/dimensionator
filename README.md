# The Dimensionator 🌱

Takes a cut-out photo of a potted plant and produces:

| Output       | What it is                                                                  | File name                  |
| ------------ | --------------------------------------------------------------------------- | -------------------------- |
| **Silo JPG** | Plant at original resolution on a white 5:7 canvas, centered                | `Name_SILO.jpg`            |
| **Web JPG**  | Plant scaled to fill a 2200×2200 white square, centered                     | `Name_SILO-2200x2200.jpg`  |
| **DIM**      | Plant centered on a 2200×2200 square with height and width dimension lines  | `Name_DIM.jpg`             |

Every tab makes **DIM** by default. Silo and Web are under the collapsed **Legacy Options**
on each tab. Which outputs start checked is set by `checkedByDefault` in `src/settings.js`.

Four ways to use it:

- **Single Image:** one photo, with a live preview.
- **Multi Image:** add several photos and type each one's labels in a table. You can flip
  through previews, remove or add images, and download everything as one ZIP. No CSV needed.
  - Type `=1` in a label box to copy row 1's label from the same column. It updates if row 1
    changes, chains (`=2` → `=1` works), and is flagged in red if the row doesn't exist.
  - Removing a row keeps references pointing at the same images. A reference to the removed row
    is replaced by that row's label.
- **Multi-packs:** one photo, repeated in a 1, 2, 3, 4, 5, 6, 8 or 10-pack arrangement and
  saved as a 2200×2200 JPEG (`Name_4PACK.jpg`). Each pot is centered on its spot. The
  arrangements were measured from reference photos and live in `multipack.layouts` in
  `src/settings.js`. Add a line there for a new pack size.
- **CSV / Batch:** a whole folder. DIM labels come from a CSV with the columns
  `FILE NAME, PLANT HEIGHT, PLANT WIDTH`.

## Old version

The previous version (v0.3.1) is still live at `/legacy/` (linked as "old version" in the
footer). Its code is in [`legacy/`](legacy) and in git history under the `v0.3.1` tag.

## Running it

It's a static web page with no build step. Because it uses JavaScript modules, it must be
served from a web server rather than opened by double-clicking `index.html`:

- **GitHub Pages:** push this folder to a repo and turn on Pages (Settings → Pages → Deploy from branch).
- **Locally:** from this folder, run the command below and then open http://127.0.0.1:8000.

  ```bash
  python3 -m http.server 8000 --bind 127.0.0.1
  ```

## Changing how the images look

**Everything adjustable is in [`src/settings.js`](src/settings.js).** Each value has a comment
explaining what it does. This includes padding, canvas sizes, line thickness/color, font size,
label spacing, file suffixes, CSV column names, and how the plant is detected.
Edit, save, and refresh.

## Themes

Pick a color theme from the footer (bottom right). The choice is remembered in your browser.
Themes live in [`styles/themes.css`](styles/themes.css), one small block of colors each. To add
one, copy a block, change the colors, and add its name to the list in `src/ui/theme-picker.js`.

The stylesheet from before the themes were added is kept at `styles/archive/app-before-themes.css`.

## How the code is organized

```
index.html              page layout
styles/app.css          page styling (+ loads the DIN label font)
styles/themes.css       color themes
assets/                 font and icon
src/
  settings.js           ← all tweakable numbers
  main.js               starts the app
  outputs/              one file per output type
    index.js            the list of output types (UI is built from this)
    silo.js  web.js  dim.js
    multipack.js        multi-pack arrangements (Multi-packs tab)
  core/                 image logic, no UI
    analyze-plant.js    finds the plant's edges and the pot's center
    place-plant.js      decides how big to draw the plant and where
    dimension-line.js   draws a line with a label in the middle
    canvas.js  box.js   small helpers
  batch/
    run-batch.js        processes a folder into a ZIP
    csv.js              reads the CSV
  ui/                   connects buttons, previews and logs to the logic above
    single-mode.js  multi-mode.js  multipack-mode.js  batch-mode.js   one file per tab
    output-picker.js  label-fields.js  preview.js  shared pieces
  naming.js             output file-name rules
  references.js         "=N" row references in the Multi Image table
  render.js             image file → output file (shared by every tab)
  download.js           saving files / ZIPs
tests/                  open /tests/ in the browser to run them
legacy/                 the previous version (v0.3.1), served at /legacy/
```

### How an image is processed

1. **Analyze** (`analyze-plant.js`). Once per image, at full resolution:
   - Find which pixels are plant: anything not transparent. If the image has no transparency,
     it's anything that's neither near-white nor the background color read from the image's
     edges, so off-white or light grey borders are ignored too.
   - Throw away specks, dust and frame lines that aren't part of the plant.
   - Find the box around the remaining pixels. Empty borders of any size don't matter.
   - Make the background transparent, so no output ever shows a grey box or a stray speck.
   - Find the pot's center by scanning up from the bottom for wide, evenly colored rows. Small
     gaps (like notches between a pot's feet) are bridged, and the middle value across a band of
     rows is used, so one odd row can't skew it.
2. **Place** (`place-plant.js`). Each output gives a *frame* (the area the plant must stay
   inside) and an *anchor* (the point to center on). The plant is drawn as large as possible with:
   - **left-to-right:** the pot's center on the anchor, so lopsided leaves don't shift it.
     Setting an output's `centerOn` to `"plant"` centers the whole plant instead.
   - **top-to-bottom:** the whole plant centered on the anchor, with equal space above and below.

   Empty margins in the input image never matter, since only the plant's actual pixels count.
   If centering the pot would shrink a lopsided plant more than `layout.maxShrinkToCenterPot`,
   it's nudged off-center instead.
3. **Draw** (`outputs/*.js`). Each output draws the placed plant, plus dimension lines for DIM.

## Adding a new output type

1. Copy `src/outputs/web.js` to e.g. `src/outputs/thumbnail.js`, then change its `id`, `label`,
   `fileSuffix` and `render()`.
2. Add it to the list in `src/outputs/index.js`.

The checkbox, preview, file naming, ZIP and batch processing all pick it up automatically.
If it needs text inputs like DIM's labels, list them in `fields` (see `dim.js`). They'll
appear as text boxes in Single Image, as table columns in Multi Image, and be read from the
CSV in batch mode.

## Tests

With the server running, open http://127.0.0.1:8000/tests/. It checks naming, CSV parsing,
plant detection and placement, and renders every output for a few synthetic plants so you can
inspect them. Real photos that once caused problems live in `tests/fixtures/` as test cases;
add new ones there when you find an image that misbehaves.
