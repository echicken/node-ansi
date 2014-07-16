var util = require('util'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	events = require('events'),
	Canvas = require('canvas'),
	Image = Canvas.Image,
	GIFEncoder = require('gifencoder'),
	defs = require('./defs.js');

var copyObject = function(obj) {
	var ret = {};
	for(var property in obj)
		if(Array.isArray(obj[property]))
			ret[property] = obj[property];
		else if(typeof obj[property] == "object")
			ret[property] = copyObject(obj[property]);
		else if(typeof obj[property] != "undefined")
			ret[property] = obj[property];
	return ret;
}

// Very shallow comparison
var compareObjects = function(obj1, obj2) {
	var ret = true;
	for(var property in obj1) {
		if(obj1[property] === obj2[property])
			continue;
		ret = false;
		break;
	}
	return ret;
}

var ANSI = function() {

	var self = this;
	events.EventEmitter.call(this);

	this.data = [];
	var width = 0;
	var height = 0;

	this.__defineGetter__(
		"width",
		function() {
			return width + 1;
		}
	);

	this.__defineGetter__(
		"height",
		function() {
			return height + 1;
		}
	);

	this.__defineGetter__(
		"pixelWidth",
		function() {
			return (9 * (width + 1));
		}
	);

	this.__defineGetter__(
		"pixelHeight",
		function() {
			return (16 * (height + 1));
		}
	);

	this.fromString = function(ansiString) {

		var plain = "";

		var cursor = {
			'x' : 0,
			'y' : 0
		};

		var cursorStore = {
			'x'	: 0,
			'y' : 0
		};

		var graphics = {
			'bright'		: false,
			'blink'			: false,
			'foreground'	: 37,
			'background'	: 40
		};

		while(ansiString.length > 0) {
			var regex = /^\u001b\[(\d*;?)*[a-zA-Z]/;
			var result = regex.exec(ansiString);
			if(result === null) {
				var chr = {
					'cursor' : copyObject(cursor),
					'graphics' : copyObject(graphics),
					'chr' : ansiString.substr(0, 1)
				};
				switch(chr.chr.charCodeAt(0)) {
					case 13:
						cursor.x = 0;
						break;
					case 10:
						cursor.y++;
						break;
					default:
						cursor.x++;
						if(cursor.x == 80) {
							cursor.x = 0;
							cursor.y++;
						}
						this.data.push(chr);
						break;
				}
				ansiString = ansiString.substr(1);
			} else {
				var ansiSequence = ansiString.substr(0, result[0].length).replace(/^\u001b\[/, "");
				var cmd = ansiSequence.substr(ansiSequence.length - 1);
				var opts = ansiSequence.substr(0, ansiSequence.length - 1).split(";");
				opts.forEach(
					function(e, i, a) {
						a[i] = parseInt(e);
					}
				);
				ansiString = ansiString.substr(result[0].length);
				switch(cmd) {
					case 'A':
						if(isNaN(opts[0]))
							opts[0] = 1;
						cursor.y = Math.max(cursor.y - opts[0], 0);
						break;
					case 'B':
						if(isNaN(opts[0]))
							opts[0] = 1;
						cursor.y = cursor.y + opts[0];
						break;
					case 'C':
						if(isNaN(opts[0]))
							opts[0] = 1;
						cursor.x = Math.min(cursor.x + opts[0], 79);
						break;
					case 'D':
						if(isNaN(opts[0]))
							opts[0] = 1;
						cursor.x = Math.max(cursor.x - opts[0], 0);
						break;
					case 'f':
						cursor.y = (isNaN(opts[0])) ? 1 : opts[0];
						cursor.x = (opts.length < 2) ? 1 : opts[1];
						break;
					case 'H':
						cursor.y = (isNaN(opts[0])) ? 1 : opts[0];
						cursor.x = (opts.length < 2) ? 1 : opts[1];
						break;
					case 'm':
						for(var o in opts) {
							var i = parseInt(opts[o]);
							if(opts[o] == 0) {
								graphics.foreground = 37;
								graphics.background = 40;
								graphics.bright = false;
								graphics.blink = false;
							} else if(opts[o] == 1) {
								graphics.bright = true;
							} else if(opts[o] == 5) {
								graphics.blink = true;
							} else if(opts[o] >= 30 && opts[o] <= 37) {
								graphics.foreground = opts[o];
							} else if(opts[o] >= 40 && opts[o] <= 47) {
								graphics.background = opts[o];
							}
						}
						break;
					case 's':
						cursorStore = copyObject(cursor);
						break;
					case 'u':
						cursor = copyObject(cursorStore);
						break;
					case 'J':
						if(opts.length == 1 && opts[0] == 2) {
						/*	for(var d in this.data) {
								var o = copyObject(this.data[d]);
								o.chr = " ";
								this.data.push(o);
								cursor.y = 0;
								cursor.x = 0;
							} */
							for(var y = 0; y < 24; y++) {
								for(var x = 0; x < 80; x++) {
									this.data.push(
										{	'cursor' : {
												'x' : x,
												'y' : y
											},
											'graphics' : {
												'bright' : false,
												'blink' : false,
												'foreground' : 37,
												'background' : 40
											},
											'chr' : " "
										}
									);
								}
							}
						}
						break;
					case 'K':
						for(var d in this.data) {
							if(this.data.cursor.y != cursor.y || this.data.cursor.x < cursor.x)
								continue;
							var o = copyObject(this.data[d]);
							o.chr = " ";
							this.data.push(o);
						}
						break;
					default:
						// Unknown or unimplemented command
						break;
				}
			}
			width = Math.max(cursor.x, width);
			height = Math.max(cursor.y, height);
		}

	}

	this.fromFile = function(fileName) {
		var contents = fs.readFileSync(fileName, { 'encoding' : 'binary' });
		this.fromString(contents);
	}

	this.__defineGetter__(
		"matrix",
		function() {
			var ret = {};
			for(var d = 0; d < self.data.length; d++) {
				if(typeof ret[self.data[d].cursor.y] == "undefined")
					ret[self.data[d].cursor.y] = {};
				ret[self.data[d].cursor.y][self.data[d].cursor.x] = {
					'graphics' : copyObject(self.data[d].graphics),
					'chr' : self.data[d].chr
				};
			}
			for(var y = 0; y <= height; y++) {
				if(typeof ret[y] == "undefined")
					ret[y] = {};
				for(var x = 0; x <= width; x++) {
					if(typeof ret[y][x] != "undefined")
						continue;
					ret[y][x] = {
						'graphics' : {
							'bright'		: false,
							'blink'			: false,
							'foreground'	: 37,
							'background'	: 40
						},
						'chr' : " "
					}
				}
			}
			return ret;
		}
	);

	this.__defineGetter__(
		"plainText",
		function() {
			var lines = [];
			var matrix = self.matrix;
			for(var y in matrix) {
				var line = "";
				for(var x in matrix[y])
					line += matrix[y][x].chr;
				lines.push(line);
			}
			return lines.join("\r\n") + "\r\n";
		}
	);

	this.__defineGetter__(
		"HTML",
		function() {

			var graphics = {
				'bright' : false,
				'blink' : false,
				'foreground' : 37,
				'background' : 40
			};

			var graphicsToSpan = function(graphics) {
				var span = util.format(
					'<span style="background-color: %s; color: %s;">',
					defs.Attributes[graphics.background].htmlLow,
					(graphics.bright)
						?
						defs.Attributes[graphics.foreground].htmlHigh
						:
						defs.Attributes[graphics.foreground].htmlLow
				);
				return span;
			}

			var lines = [
				'<pre style="font-family: Courier New, Courier, monospace; font-style: normal; font-weight: normal; letter-spacing: -1px; line-height: 1;">',
				graphicsToSpan(graphics)
			];

			var matrix = self.matrix;
			for(var y in matrix) {
				var line = "";
				for(var x in matrix[y]) {
					if(!compareObjects(matrix[y][x].graphics, graphics)) {
						line += "</span>" + graphicsToSpan(matrix[y][x].graphics);
						graphics = copyObject(matrix[y][x].graphics);
					}
					line +=
						(typeof defs.ASCIItoHTML[matrix[y][x].chr.charCodeAt(0)] == "undefined")
						?
						((matrix[y][x].chr == " ") ? "&nbsp;" : matrix[y][x].chr)
						:
						"&#" + defs.ASCIItoHTML[matrix[y][x].chr.charCodeAt(0)].entityNumber + ";";
				}
				lines.push(line);
			}
			
			lines.push("</span>");
			lines.push("</pre>\n");
			return lines.join("\n");

		}
	);

	this.__defineGetter__(
		"binary",
		function() {
			var matrix = self.matrix;
			var bin = [];
			var width = 0;
			for(var y in matrix) {
				for(var x in matrix[y]) {
					width = Math.max(x, width);
					bin.push(matrix[y][x].chr.charCodeAt(0));
					bin.push(
						defs.Attributes[matrix[y][x].graphics.foreground].attribute|defs.Attributes[matrix[y][x].graphics.background].attribute|((matrix[y][x].graphics.bright)?defs.Attributes[1].attribute:0)|((matrix[y][x].graphics.blink)?defs.Attributes[5].attribute:0)
					);
				}
			}
			return new Buffer(bin);
		}
	);

	this.toGIF = function(options) {
		var options = (typeof options == "undefined") ? {} : options;
		var encoder = new GIFEncoder(this.pixelWidth, this.pixelHeight);
		var rs = encoder.createReadStream();

		encoder.start();
		encoder.setRepeat(
			(typeof options.loop != "boolean" || !options.loop) ? -1 : 0
		);
		encoder.setDelay(
			(typeof options.delay != "number")
				? 40 : Math.round(options.delay)
		);
		encoder.setQuality(
			(typeof options.quality != "number")
				? 20 : Math.min(20, options.quality)
		);
		var frames =
			(typeof options.charactersPerFrame != "number")
				? 20 : Math.round(options.charactersPerFrame);

		var canvas = new ansiCanvas(this.pixelWidth, this.pixelHeight);

		for(var d = 0; d < self.data.length; d++) {
			canvas.putCharacter(
				self.data[d].cursor.x,
				self.data[d].cursor.y,
				self.data[d].chr.charCodeAt(0),
				defs.Attributes[self.data[d].graphics.foreground].attribute|((self.data[d].graphics.bright)?defs.Attributes[1].attribute:0),
				(defs.Attributes[self.data[d].graphics.background].attribute>>4)
			);
			if(d % frames == 0)
				encoder.addFrame(canvas.context);
		}
		encoder.setDelay(10000); // Dwell on the last frame for a while.  Make configurable?
		encoder.addFrame(canvas.context);
		encoder.finish();
		return rs.read();
	}

	this.toPNG = function() {
		var matrix = self.matrix;
		var canvas = new ansiCanvas(this.pixelWidth, this.pixelHeight);
		for(var y in matrix) {
			for(var x in matrix[y]) {
				canvas.putCharacter(
					x,
					y,
					matrix[y][x].chr.charCodeAt(0),
					defs.Attributes[matrix[y][x].graphics.foreground].attribute|((matrix[y][x].graphics.bright)?defs.Attributes[1].attribute:0),
					(defs.Attributes[matrix[y][x].graphics.background].attribute>>4)
				);
			}
		}
		return canvas.canvas.toBuffer();
	}

	this.toVideo = function(options, callback) {

		if(arguments.length == 1 && typeof options != "function")
			this.emit("error", "ANSI.toMovie: Invalid callback");
		else if(arguments.length == 1)
			var callback = options;

		if(arguments.length > 1 && (typeof options != "object" || typeof callback != "function"))
			this.emit("error", "ANSI.toMovie: Invalid arguments");

		var movie = new Buffer(0);
		var canvas = new ansiCanvas(this.pixelWidth, this.pixelHeight);

		var child = spawn(
			'ffmpeg',
			[	'-y',
				'-loglevel', 'quiet',
				'-f', 'image2pipe',
				'-c:v', 'png',
				'-r', (typeof options.frameRate != "number") ? 30 : options.frameRate,
				'-i', 'pipe:0',
				'-f', (typeof options.format == "undefined") ? "webm" : options.format,
				'-filter:v', 'setpts=' + ((typeof options.speed != "number") ? 1 : options.speed) + '*PTS',
				'pipe:1'
			]
		);
		child.on(
			"close",
			function() {
				callback(movie);
			}
		);
		child.stderr.on(
			"data",
			function(data) {
				console.log(data.toString());
			}
		);
		child.stdout.on(
			"data",
			function(data) {
				movie = Buffer.concat([movie, data]);
			}
		);

		for(var d = 0; d < self.data.length; d++) {
			canvas.putCharacter(
				self.data[d].cursor.x,
				self.data[d].cursor.y,
				self.data[d].chr.charCodeAt(0),
				defs.Attributes[self.data[d].graphics.foreground].attribute|((self.data[d].graphics.bright)?defs.Attributes[1].attribute:0),
				(defs.Attributes[self.data[d].graphics.background].attribute>>4)
			);
			if(d % ((typeof options.charactersPerFrame != "number") ? 20 : options.charactersPerFrame) == 0)
				child.stdin.write(canvas.canvas.toBuffer());
		}
		child.stdin.write(canvas.canvas.toBuffer());
		child.stdin.end();
	}

}
util.inherits(ANSI, events.EventEmitter);

// Lazily ported and modified from my old HTML5 ANSI editor
// Could be simplified and folded into ANSI.toGIF() at some point
var ansiCanvas = function(width, height) {

	var foregroundCanvas,
		foregroundContext,
		backgroundCanvas,
		backgroundContext,
		mergeCanvas,
		mergeContext;

	this.__defineGetter__(
		"canvas",
		function() {
			mergeContext.drawImage(backgroundCanvas, 0, 0);
			mergeContext.drawImage(foregroundCanvas, 0, 0);
			return mergeCanvas;
		}
	);

	this.__defineGetter__(
		"context",
		function() {
			mergeContext.drawImage(backgroundCanvas, 0, 0);
			mergeContext.drawImage(foregroundCanvas, 0, 0);
			return mergeContext;
		}
	);

	var properties = {
		'characters' : [],
		'spriteSheet' : new Image(),
		'spriteWidth' : 9,
		'spriteHeight' : 16,
		'colors' : [
			"#000000",
			"#0000A8",
			"#00A800",
			"#00A8A8",
			"#A80000",
			"#A800A8",
			"#A85400",
			"#A8A8A8",
			"#545454",
			"#5454FC",
			"#54FC54",
			"#54FCFC",
			"#FC5454",
			"#FC54FC",
			"#FCFC54",
			"#FFFFFF"
		]
	};

	var initSpriteSheet = function() {
		properties.spriteSheet.src = "data:image/png;base64,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";
		for(	var y = 0;
				y <= properties.spriteSheet.height;
				y = y + properties.spriteHeight
		) {
			for(	var x = 0;
					x < properties.spriteSheet.width;
					x = x + properties.spriteWidth
			) {
				properties.characters.push( { 'x' : x, 'y' : y } );
			}
		}
	}

	var initCanvas = function() {

		backgroundCanvas = new Canvas(width, height);
		backgroundContext = backgroundCanvas.getContext('2d');
		backgroundContext.fillStyle = properties.colors[0];
		backgroundContext.fillRect(0, 0, width, height);

		foregroundCanvas = new Canvas(width, height);
		foregroundContext = foregroundCanvas.getContext('2d');

		mergeCanvas = new Canvas(width, height);
		mergeContext = mergeCanvas.getContext('2d');

	}

	this.putCharacter = function(x, y, character, foregroundColor, backgroundColor) {

		x = Math.floor(
			(x * properties.spriteWidth) / properties.spriteWidth
		) * properties.spriteWidth;

		y = Math.floor(
			(y * properties.spriteHeight) / properties.spriteHeight
		) * properties.spriteHeight;

		foregroundContext.clearRect(
			x,
			y,
			properties.spriteWidth,
			properties.spriteHeight
		);

		foregroundContext.drawImage(
			properties.spriteSheet,
			properties.characters[character].x,
			properties.characters[character].y,
			properties.spriteWidth,
			properties.spriteHeight,
			x,
			y,
			properties.spriteWidth,
			properties.spriteHeight
		);

		foregroundContext.globalCompositeOperation = 'source-atop';
		foregroundContext.fillStyle = properties.colors[foregroundColor];

		foregroundContext.fillRect(
			x,
			y,
			properties.spriteWidth,
			properties.spriteHeight
		);

		foregroundContext.globalCompositeOperation = 'source-over';
		backgroundContext.fillStyle = properties.colors[backgroundColor];

		backgroundContext.fillRect(
			x,
			y,
			properties.spriteWidth,
			properties.spriteHeight
		);

	}

	initSpriteSheet();
	initCanvas();
	
}

module.exports = ANSI;