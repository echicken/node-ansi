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
fs.writeFileSync("gnome.bin", a.binary.data);
console.log("Binary graphic width: %d", a.binary.width);
fs.writeFileSync("gnome.gif", a.toGIF({ 'loop' : true }));
fs.writeFileSync("gnome.png", a.toPNG());