# TAGGER

Tags from two directions. **EDITOR** is you typing; **ONLINE** is a metadata
source filling things in. They are sub-tabs of the same mode because they are
usually used together: pull a release, then fix the three fields it got wrong.

## EDITOR — editing by hand

The field editor shows the tags of the current selection, grouped into **Core**,
**Standard** and **Advanced** so the fields you reach for constantly are not
buried among the ones you touch once a year.

Two rules govern it:

- **Only fields you change are written.** Leaving a field alone leaves the tag
  alone. There is no "write everything" pass that quietly normalizes fields you
  never looked at.
- **A field that differs across the selection shows `<multiple values>`** and is
  left alone unless you type in it. Select an album and set the Genre once, and
  every file gets it; leave the Title showing `<multiple values>` and each file
  keeps its own.

**Stage field changes** turns what you typed into a change plan. As everywhere
else, nothing is written until you Apply it — see
[Change plans, Apply and Undo](change-plans.md).

### Adding a field

**+ Add field** expands into one compact row: a field name and a value. The name
box suggests fields already present in the loaded library, so you don't invent
`ALBUMARTIST` when the rest of the collection says `AlbumArtist`.

### Clear tags

**Clear tags** wipes every text tag from the selected files for a fresh start.
Cover art and DJ cue points are kept, and it stages a preview like everything
else, so it is both gated and undoable. The same action is on the table toolbar
(the eraser) and on ⇧⌘X, Ctrl+Shift+X on Windows and Linux: select the files,
press it, then ⌘↩ to apply. Clearing first and then importing a release leaves
nothing behind from whoever tagged the files before.

### Detect BPM

The metronome on the table toolbar, or ⇧⌘B (Ctrl+Shift+B on Windows and Linux),
measures the tempo of the selected files from the audio and stages it in the
BPM field. A beat tracker finds the beats and the tempo is fitted through them,
then written as a whole number. It takes a few
seconds a track and runs in the background: the status bar counts the files
beside a Stop square, and while it runs the toolbar button is a Stop too.
Either ends the run at the current file and stages what was measured before
it; the count freezes and the bar goes grey until it has. Esc stops it the
same way, unless a menu is open or a text field has the cursor; a second Esc
discards the preview.

The preview shows the BPM column, adding it to the table if it was hidden, so
each new value can be checked against the old one before Apply. A file that
already holds the measured number is left out of the plan. A track with no
steady beat (a beatless intro, spoken word) gets no value. A report at the
foot of the window says what was staged, with a line under it for each thing
worth knowing: where a stopped run stopped, how many long files were skipped,
and, in red, how many files had no steady beat or could not be decoded. The
report sits on the bar with Apply and Discard and goes away with the preview.
One with a red line stays until its × is clicked or Esc is pressed: the first
Esc closes the report, the next one discards the preview.

A file longer than 20 minutes, a DJ mix in practice, is skipped and counted in
the report: it has no single tempo to measure. The limit, and a switch that
turns the whole feature off, are under **Settings › Tags and covers › BPM
detection**.

Some libraries write fast tracks at half tempo, 87 for a 174 BPM drum & bass
track. **Detected BPM range**, in the same place, folds the measured
tempo into the range you choose, so the detected value matches the rest of the
collection.

## Cover art

The cover well shows the artwork of the current selection and adapts to what it
finds:

- **One shared cover** — a thumbnail, and **Replace… / Remove / Export**.
- **Different covers across the selection** — a small fan of thumbnails, a count
  of how many files have one, and **Set one… / Remove all / Export**. It never
  implies a shared image that isn't there.
- **No cover** — a drop target, and an offer to embed a `cover.jpg` or
  `folder.jpg` already sitting next to the tracks if there is one.

You can also **drag an image onto the window** from your file manager: a single
dropped image can only mean one thing, so it is embedded as the cover of the
selection.

**Export** writes the embedded cover next to each file as an image. It is
read-only for your audio, so it writes immediately rather than staging a plan.

Embedding goes through the preview like any other change, and respects the size
and quality limits in [Settings › Cover art](settings.md#cover-art).

## ONLINE — pulling tags from a source

Pick a **Source** — Discogs, MusicBrainz, Beatport, Bandcamp or Soundeo — and
search. Discogs needs a personal token; see
[Settings › Discogs](settings.md#discogs). The rest need none.

> This application uses Discogs' API but is not affiliated with, sponsored or
> endorsed by Discogs. "Discogs" is a trademark of Zink Media, LLC.

### Building the query

The dropdown next to the search box builds the query for you from what is
already on disk:

| Preset | Query |
| --- | --- |
| Manual | Whatever you type |
| Folder name | The selected files' folder |
| File name | The selected file's name |
| Album | The Album tag |
| Artist + Title | The Artist and Title tags |

**Folder name** is the workhorse for a collection ripped into
`Artist - Album (Year)` folders.

The two path-derived presets replace underscores with spaces, since downloaded
music is routinely filed with them and no provider will match
`la_bush_-_music_from_the_temple_of_house`. Dots are left alone — they mean
something in `Ltd.` and `Vol. 2`. The tag-derived presets are not touched at all:
an underscore in a tag was put there deliberately, and tidying tag values is
[GENERATOR](generator.md)'s job.

You can also narrow results by media type — CD, Vinyl, LP, File — and choose how
many results per page (5, 10, 15). **Load more** fetches the next page. A search
in progress can be stopped: the magnifier turns into a stop square, and Escape
also interrupts a sweep, which is what you want the moment the release you were
after is already on screen.

Results show as a **list** or a **grid**; the grid is worth switching to when you
are recognising a release by its sleeve.

### The release card

Click a card's head to expand its tracklist. The labelled **Import** action
at the bottom-right of its compact header stages the selected files in displayed order, paired
with checked source tracks from top to bottom. Unchecked source tracks consume
no file slot. Folder positions remain fixed when sorting tracks within folders.
The title leads, the artist sits below it, and one muted line identifies the
year, country and medium. Track counts appear with the expanded tracklist.

Click the artwork to browse the release images. Its badge shows the image count.
Right-click it to **Embed in selected tracks**, save the cover as `folder.jpg`,
or save every release image. This works while the card is collapsed and leaves it
collapsed. Embedding alone also stages a preview.

### Import fields

The sliders icon inside the left edge of the search field opens a compact
checklist. **Artwork** comes first, followed by common tags; **More fields**
reveals the rest. **Select all** and **Clear all** include artwork. Choices stay
saved across searches, source changes and application restarts.

A checked Artwork choice replaces the main cover with the selected release image,
preserving other embedded pictures. Uncheck it for tags-only imports. Unchecked
tag fields keep their existing values. Preferences apply to subsequent imports;
they do not rewrite an already staged preview.

Staged lists only files and tag columns with actual changes, in their normal column
order. Reverting the last change in a column hides it; reverting every change in a
file removes its row. File and Artwork remain available to identify rows. Headings
use readable Title Case, retaining abbreviations such as ID, CD and URL. Files keeps
its own column choices. Artwork-only rows remain visible,
with an accent marker on the image icon and a tooltip identifying an addition,
replacement or removal. Importing identical saved tags and artwork stages nothing.
Apply remains the write boundary, and tags plus artwork share one Undo batch.

### Label · cat#

A release can list several label and catalogue-number pairs — reissues,
co-releases, sometimes several from one label. Only one pair can be written, so
when there is more than one the header footer shows a compact selector beside
Import. A single label and catalogue number appear as quiet text in the same
place; import takes that pair. The choice survives opening or closing the tracklist.

### Vinyl side → disc

The checkbox on the results toolbar controls how a vinyl position is imported. On,
`A1` becomes disc 1 / track 1 and `B2` becomes disc 2 / track 2. Off, the track
number is the position's number (`A1` gives 1, a bare side such as `B` its row in
the list) and the disc is left to the release. Either way the position itself is
kept in the `POSITION` field; see the `%position%` and `%side%` placeholders in
the [mask reference](masks.md).

The tag standards define the track number as a number, so that is what an import
writes by default. If your library keeps vinyl positions as the track number
itself, switch **Settings › Online import › Track number** to **Vinyl position**
and `A1` is written as `A1` (not on an MP4 file, which can only hold a number).
With this checkbox on the tracks are numbered per side whichever you choose. A
position can also be typed into the track or disc number by hand, in the editor
or through a FROM NAME or FROM TEXT mask.

## Import, then fix

Import stages a plan; it does not write. This is the moment to read what the
source is about to give you — providers disagree about artist naming, about
whether "feat." belongs in the title, about genre vocabulary. Untick the rows you
don't want, apply the rest, then clean up the difference with
[GENERATOR](generator.md).

An import fills the disc number when the release says what it is: a disc-numbered
track position (`1-05`), a MusicBrainz medium, or — on a release that states it
holds a single disc — plain 1, so an ordinary album reads 1/1 rather than blank.
A release stating two or more discs leaves a track whose position names no disc
alone, because there 1 would be a guess.

The same tag permissions remain available under **Settings › Online import**.
The inline import checklist uses those saved settings, so there is one choice per
field. Its Artwork checkbox corresponds to **Never** or **Always**; older enabled
“If missing” profiles migrate to the explicit main-cover replacement choice.

## FROM TEXT — a tracklist that exists only as text

Sometimes the tracklist is all there is: a forum post, a CD insert, a release
page no source carries. **FROM TEXT** reads it with a mask, the way FROM NAME
reads a file name. Paste the list into the box, or **Open text file…** for one
saved as text (UTF-8 or UTF-16).

Pairing is by position. The lines the mask fits are the tracks, and the first
track goes to the first selected file in table order, the second to the second,
and so on. A line the mask doesn't fit — the release heading, "Side A", a blank
line — is not a track and is skipped, so a heading never pushes every title onto
the next file. The line above the box says how it pairs up before anything is
staged: how many tracks, how many files are selected, and how many lines were
skipped. Extra tracks or extra files are left out; a skipped line you expected to
be a track is the sign of a typo in it.

The button at the end of the mask field opens the **mask builder** over the
whole list: every line, the file its track lands on, and a column for each tag
the mask names, recomputed as you type. A heading reads "not a track ·
skipped", a track left without a file says so in the File column, and the line
above the list counts the tracks, the skipped lines and whatever does not pair
up. Values are marked as in FROM NAME's builder (see [Masks](masks.md)), and
invisible characters such as tabs are drawn as in the probe.

A table copied from a web page usually separates its columns with tabs, and Tab
can't be typed into the mask box, so write it as `\t`. A release page's
tracklist — number, artist followed by a dash, title, length — reads with:

```
%track%\t%artist%–\t%title%\t%skip%
```

Copy any dash from the list itself: a page's `–` is not the `-` on the keyboard.
The read-out under the box makes these visible in the line it is matching — a
tab as ⇥, a dash or space that only looks like `-` or a space tinted, with its
name on hover.

**Suggest mask** writes one for you from the list's own layout: a table's
columns (a position, an artist with its dash, a title, a length) or a plain
line's number, dash and length, spelled with the characters the list uses. It
fills the mask box only when pressed, and suggests nothing when no reading fits
a line — the read-out then shows what the suggestion actually reads, and you can
adjust it from there.
The values come out as the line spells them, and the presets ticked behind the
wand run over them in the same press — *Discogs cleanup* drops an artist's
`(2)` and the `*` a release page puts after a name variation. The result is an ordinary plan: preview, Apply, undo.
