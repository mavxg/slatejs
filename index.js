var ottype = require('ot-sexpr');
var sharejs = require('share/lib/client');
sharejs.registerType(ottype);

var ottypes = {};
ottypes[ottype.name] = ottypes[ottype.uri] = ottype;

module.exports = {
	editor: require('./lib/editor'),
	type: ottype,
	sharejs: sharejs,
	ottypes: ottypes,
	Dummy: require('dummy-sharejs-connection'),
	Store: require('./lib/store'),
	Selection: ottype.Selection,
	Region: ottype.Region,
	parse: ottype.parse,
	plugins: require('./lib/plugins'),
};