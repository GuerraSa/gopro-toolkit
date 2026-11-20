# GoPro Cloud Toolkit

A [Tampermonkey](https://www.tampermonkey.net/) userscript for bulk-organizing your media on the GoPro cloud (gopro.com). It adds a panel to the GoPro media library where you can filter your whole library, then act on everything that matches: add it to an album, find clips by HiLight tags, export the metadata, or download it. It never deletes your photos or videos from the GoPro cloud.

> **Unofficial.** This script uses the same private web API that gopro.com uses when you're signed in. GoPro can change that API at any time, and automated use may go against GoPro's terms. Use it at your own risk.

## Features

- **Filters** that update the match count right away, because all filtering happens in your browser:
  - Media type (Video, Photo, Burst, TimeLapse, …)
  - Camera model
  - Date range, by date captured or date uploaded, to include or exclude
  - Filename (regular expression, to include or exclude)
  - File size, resolution and duration
  - **HiLight tags**: has HiLights, no HiLights, or **at least N tags**
  - Duplicates only, hide edits (MultiClipEdit), sort by size
- **Add to Album**: adds every match to one of your existing GoPro albums. Clips already in the album are skipped.
- **HiLights**: lists the HiLight times of every matching clip, and includes a HiLight Editor where you can preview a clip and add or remove its tags.
- **Stats**: totals by type, camera and year.
- **Export**: metadata as CSV or JSON, or temporary download links in a format the aria2 downloader can read.
- **Download**: downloads the original files in bulk and remembers which ones you already have.
- **Duplicate finder**: finds copies with the same filename, size and capture time, and keeps the oldest upload out of the results.
- **Dry run**: tick it to see what any action *would* do without changing anything.

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser (Chrome, Edge, Firefox or Safari).
2. **Chrome / Edge only:** turn on *Developer mode* on the extensions page (`chrome://extensions` or `edge://extensions`), or turn on *Allow User Scripts* in Tampermonkey's extension details. Otherwise userscripts won't run.
3. Open the [latest release](https://github.com/GuerraSa/gopro-toolkit/releases/latest) and click **`gopro-toolkit.user.js`**. Tampermonkey opens an install page. Click **Install**.

Tampermonkey checks this repo's latest release for updates on its own.

## Usage

1. Sign in at [gopro.com](https://gopro.com) and open your media library.
2. Click the round camera button in the bottom-right corner, or choose **Open GoPro Cloud Toolkit** from the Tampermonkey menu.
3. **Step 1, Load library:** reads the details of every item in your library. Nothing is downloaded or changed. Large libraries take a moment.
4. **Step 2, Filters:** set any filters you want. The number of matches updates as you go.
5. **Step 3, Choose Action:** click an action. It runs on everything that currently matches.

### Add filtered media to an album

1. Load your library and set your filters.
2. Under the action buttons, click **Refresh albums** and pick an album from the list.
3. Click **Add to Album** and confirm.

To create a new album, make it on gopro.com first, then click **Refresh albums**.

### Find clips by HiLight tags

Open the **HiLight Tags** filter:

- **Has HiLights** / **No HiLights**: clips with or without any tags.
- **At least**: clips with at least this many tags, for example `3`.

Then click **List HiLights** to see where each clip's tags are, or click **HiLight Editor** to watch the clips and add or remove tags.

## Settings

Open **Advanced Settings** to change how many files download at once, the delay between downloads, and whether files you already downloaded are skipped.

## Troubleshooting

- **No camera button:** make sure the script is turned on in Tampermonkey and you're on a `gopro.com` page. On Chrome/Edge, check step 2 of Install.
- **Errors after loading or saving:** you may have been signed out. Reload gopro.com, sign in, and try again.
- **Something stopped working:** GoPro may have changed its site. [Open an issue](https://github.com/GuerraSa/gopro-toolkit/issues) and paste the lines from the toolkit's log. Don't post download links: anyone who has one can download that clip.

## Development

Run the tests with `node test.js`.

## License

[MIT](LICENSE)
