node-ansi
=========

ANSI graphics parser for node.js.  Output to plain text, HTML, binary, animated GIF, PNG, video, or whatever you want.

####Installation

```sh
npm install ansi-graphics
```

GIF output functionality uses [gifencoder](https://github.com/eugeneware/gifencoder) and [node-canvas](https://github.com/Automattic/node-canvas), which in turn rely on [Cairo](http://cairographics.org/).  Ensure that Cairo and its dependencies are installed before proceeding.  On Ubuntu I've also needed to install libjpeg-dev and libgif-dev in order to install these modules.

[ffmpeg](http://ffmpeg.org/) is not required for installation, however you'll need a recent build of ffmpeg in your PATH in order to use the output-to-video functionality.

####Usage

```js
var ANSI = require('ansi-graphics'),
	fs = require('fs');

// Create a new ANSI object
var a = new ANSI();

// Load an ANSI graphic from a file
a.fromFile("./gnome.ans");

// Write the plain-text version of the graphic to a file
fs.writeFileSync("gnome.txt", a.plainText, { 'encoding' : 'binary' });

// Write the HTML version of the graphic to a file
fs.writeFileSync(
	"gnome.html",
	"<html><body>" + a.HTML + "</body></html>",
	{ 'encoding' : 'binary' }
);

// Write the binary version of the graphic to a file
fs.writeFileSync("gnome.bin", a.binary);

// Save the looping, animated GIF version of the graphic to a file
fs.writeFileSync("gnome.gif", a.toGIF({ 'loop' : true }));

// Save the PNG version of the graphic to a file
fs.writeFileSync("gnome.png", a.toPNG());

// Save an MP4 video of the scrolling graphic to a file
a.toVideo(
	{ speed : .13 },
	function(video) {
		fs.writeFileSync("gnome.mp4", video);
	}
);
```

#### The ANSI object

#####Methods

- **fromFile("/path/to/file.ans")**
	- Loads and parses an ANSI graphic from a file
- **fromString(ansiString)**
	- Loads and parses an ANSI graphic from a string
- **toGIF(options)** (Buffer)
	- Converts the loaded ANSI graphic to an animated GIF
	- *options* is an optional object with the following properties:
		- *loop* (boolean) (default: false)
			- Whether or not the GIF should loop infinitely
		- *delay* (number) (default: 40)
			- Time between frames, in milliseconds
		- *charactersPerFrame* (number) (default: 20)
			- How many new characters appear in each frame of the GIF
				- If you set this to 1, the GIF will show the ANSI being drawn one character at a time, which is nice, however ...
				- If you set this to 1, it will take a long time to generate the GIF
				- Adjusting this number has a noticeable impact on filesize
				- You'll probably want to adjust *delay* along with this value
		- *quality* (number) (default: 20)
			- The image quality, on a scale of 1 to 20, where 1 is best and 20 is worst
				- I haven't noticed a visible difference between 1 and 20
				- GIFs generate a lot faster when the quality is set to the lowest (yet highest-numbered) value
	- Returns a Buffer object
- **toPNG()** (Buffer)
	- Converts the loaded ANSI graphic to a PNG
	- Returns a Buffer object
- **toVideo(options, callback)**
	- Converts the loaded ANSI graphic to a video
	- *options* is an optional object with the following properties:
		- *format* (string) (default: matroska)
			- See ffmpeg's documentation re: output formats for possibilities
		- *speed* (number) (default: 1)
			- Adjust the playback speed of the video
				- 0.25 would cause the video to play back four times faster
				- 2.5 would cause the video to play back two and a half times more slowly
		- *charactersPerFrame* (number) (default: 20)
			- As in toGIF() above, how many new characters appear in each frame of the video
			- Ultimately this is another way to adjust the "speed" of the video
			- Adjusting this value instead of 'speed' usually results in videos being generated more quickly
	- *callback* is a required function that will be called with one argument, a Buffer object containing the video

#####Properties

- **width** (Number)
	- The width of the graphic, in *characters*

- **height** (Number)
	- The height of the graphic, in *characters*

- **pixelWidth** (Number)
	- The width of the graphic, in *pixels*, when output as PNG/GIF/Video

- **pixelHeight** (Number)
	- The height of the graphic, in *pixels*, when output as PNG/GIF/Video

- **data** (Array)
	- An array of objects representing each explicitly drawn character in the graphic
	- Elements in this array appear in the sequence that they were parsed from the file
		- The parser handles cursor-positioning sequences
		- The parser handles clear-screen and clear-to-EOL sequences
		- Characters will not necessarily be in left-to-right, top-to-bottom sequence
			- This is useful for handling animated ANSIs
	- The elements in this array are objects of the following format:

```js
{	cursor : {
		x : *number*,			// X-coordinate of character
		y : *number*			// Y-coordinate of character
	},
	graphics : {
		bright : *boolean*,		// Bold/bright foreground colour
		blink : *boolean*,		// Blinking
		foreground : *number*,	// Foreground colour (30 - 47)
		background : *number*	// Background colour (40 - 47)
	},
	chr : *string*				// The character itself
}
```
- **matrix** (Object)
	- An object representing every character-cell in the graphic, from top to bottom, left to right
	- The object takes the following format:

```js
{	0 : { 		// Line 0 of the graphic
		0 : {	// Column 1 of line 0
			graphics : {
				bright : *boolean*,
				blink : *boolean*,
				foreground : *number*,
				background : *number*
			},
			chr : *string*
		}
		...
	}
	...
}
```

- **plainText** (String)
	- A string representation of the graphic with all colour/bright/blink attributes removed, with line-endings in place
		- (ie. the ANSI graphic converted to boring text.)

- **binary** (Buffer)
	- A buffer of [ chr, attr, chr, attr, ... ] uint8s

- **HTML** (String)
	- An HTML &lt;pre&gt; block containing the graphic, with colorized regions in styled &lt;span&gt; elements, and characters encoded as HTML entities as required
		- Opening and closing &lt;html&gt; &lt;head&gt; and &lt;body&gt; tags are not included in this string