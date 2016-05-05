var ids    = require('./ids');
var editor = require('./editor');
var ottype = require('ot-sexpr');

var ottypes = {};
ottypes[ottype.name] = ottypes[ottype.uri] = ottype;

module.exports = {
	Editor: editor.Editor,
	Document: editor.Document,
	type: ottype,
	ottypes: ottypes,
	render: require('./render'),
	plugins: {
		base: require('./plugins/base'),
		file: require('./plugins/file'),
		table: require('./plugins/table'),
	},
	keyToId: ids.keyToId,
	idToKey: ids.idToKey
};