var ANSI = require('./ansi.js'),
	fs = require('fs');

var a = new ANSI();
a.fromFile("./gnome.ans");
fs.writeFileSync("gnome.txt", a.plainText, { 'encoding' : 'binary' });
fs.writeFileSync(
	"gnome.html",
	"<html><body>" + a.HTML + "</body></html>",
	{ 'encoding' : 'binary' }
);
fs.writeFileSync("gnome.bin", a.binary);
fs.writeFileSync("gnome.png", a.toPNG());
fs.writeFileSync("gnome.gif", a.toGIF({ 'loop' : true }));
a.toVideo(
	{ speed : .13 },
	function(video) {
		fs.writeFileSync("gnome.mp4", video);
	}
);