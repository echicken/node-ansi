var util = require('util'),
	fs = require('fs'),
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
	this.data = [];

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
								for(var x = 0; x < 79; x++) {
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

}

module.exports.ANSI = ANSI;
module.exports.defs = defs;