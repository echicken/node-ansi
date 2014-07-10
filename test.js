var ANSI = require('./ansi.js'),
	fs = require('fs');

var a = new ANSI.ANSI();
a.fromFile("./gnome.ans");
fs.writeFileSync("gnome.txt", a.plainText, { 'encoding' : 'binary' });
fs.writeFileSync(
	"gnome.html",
	"<html><body>" + a.HTML + "</body></html>",
	{ 'encoding' : 'binary' }
);
fs.writeFileSync("gnome.bin", a.binary.data);
console.log(a.binary.width);