var util = require('util'),
	fs = require('fs'),
	Canvas = require('canvas'),
	Image = Canvas.Image,
	GIFEncoder = require('gifencoder'),
	defs = require('./defs.js');
;

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
	this.data = [];

	var width = 0;
	var height = 0;

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
			var regex = /^\u001b\[(\d*;?)(\d*;?)\d*[a-zA-Z]/;
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
						break;
				}
				ansiString = ansiString.substr(1);
				this.data.push(chr);
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
						cursor.y = Math.max(cursor.y - opts[0], 0);
						break;
					case 'B':
						cursor.y = cursor.y + opts[0];
						break;
					case 'C':
						cursor.x = Math.min(cursor.x + opts[0], 79);
						break;
					case 'D':
						cursor.x = Math.max(cursor.x - opts[0], 0);
						break;
					case 'f':
						cursor.y = opts[0];
						cursor.x = opts[1];
						break;
					case 'H':
						cursor.y = opts[0];
						cursor.x = opts[1];
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
			var lastColumn = 0;
			var lastLine = 0;
			for(var d = 0; d < self.data.length; d++) {
				lastLine = Math.max(self.data[d].cursor.y, lastLine);
				lastColumn = Math.max(self.data[d].cursor.x, lastColumn);
				if(typeof ret[self.data[d].cursor.y] == "undefined")
					ret[self.data[d].cursor.y] = {};
				ret[self.data[d].cursor.y][self.data[d].cursor.x] = {
					'graphics' : copyObject(self.data[d].graphics),
					'chr' : self.data[d].chr
				};
			}
			for(var y = lastLine; y >= 0; y--) {
				if(typeof ret[y] == "undefined")
					ret[y] = {};
				for(var x = 0; x <= lastColumn; x++) {
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
			width = lastColumn;
			height = lastLine;
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
				for(var x in matrix[y]) {
					if(matrix[y][x].chr == "\r" || matrix[y][x].chr == "\n")
						continue;
					line += matrix[y][x].chr;
				}
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
				'<pre style="font-family: Courier New, Courier, monospace; font-style: normal; font-weight: normal;">',
				graphicsToSpan(graphics)
			];

			var matrix = self.matrix;
			for(var y in matrix) {
				var line = "";
				for(var x in matrix[y]) {
					if(matrix[y][x].chr == "\r" || matrix[y][x].chr == "\n")
						continue;
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
					if(matrix[y][x].chr.match(/\r|\n/) !== null)
						continue;
					width = Math.max(x, width);
					bin.push(matrix[y][x].chr.charCodeAt(0));
					bin.push(
						defs.Attributes[matrix[y][x].graphics.foreground].attribute|defs.Attributes[matrix[y][x].graphics.background].attribute|((matrix[y][x].graphics.bright)?defs.Attributes[1].attribute:0)|((matrix[y][x].graphics.blink)?defs.Attributes[5].attribute:0)
					);
				}
			}
			return {
				'width' : width - 1, // Magic? Needed for PabloDraw, must test with other files.
				'data' : new Buffer(bin)
			};
		}
	);

	var toGraphic = function(options) {
		var matrix = self.matrix;

		if(options.GIF) {
//			var encoder = new GIFEncoder(720, 384);
			var encoder = new GIFEncoder((9 * width), (16 * height));
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
					? 10 : Math.round(options.charactersPerFrame);
		}

		var canvas = new ansiCanvas((9 * width), (16 * height));

		for(var d = 0; d < self.data.length; d++) {
			if(self.data[d].chr.match(/\r|\n/) !== null)
				continue;
			canvas.putCharacter(
				self.data[d].cursor.x,
				self.data[d].cursor.y,
				self.data[d].chr.charCodeAt(0),
				defs.Attributes[self.data[d].graphics.foreground].attribute|((self.data[d].graphics.bright)?defs.Attributes[1].attribute:0),
				(defs.Attributes[self.data[d].graphics.background].attribute>>4)
			);
			if(options.GIF && d % frames == 0)
				encoder.addFrame(canvas.context);
		}
		if(options.GIF) {
			encoder.setDelay(10000); // Dwell on the last frame for a while.  Make configurable?
			encoder.addFrame(canvas.context);
			encoder.finish();
			return rs.read();
		}
		if(options.PNG)
			return canvas.canvas.toBuffer();
	}

	this.toGIF = function(options) {
		if(typeof options != "object")
			options = {};
		options.GIF = true;
		options.PNG = false;
		return toGraphic(options);
	}

	this.toPNG = function(filename) {
		return toGraphic({ 'GIF' : false, 'PNG' : true });
	}

}

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
			properties.spriteWidth - 1,
			properties.spriteHeight - 1
		);

		foregroundContext.drawImage(
			properties.spriteSheet,
			properties.characters[character].x,
			properties.characters[character].y,
			properties.spriteWidth - 1,
			properties.spriteHeight - 1,
			x,
			y,
			properties.spriteWidth - 1,
			properties.spriteHeight - 1
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