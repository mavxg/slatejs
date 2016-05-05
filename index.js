var ids    = require('./ids');
var editor = require('./editor');

module.exports = {
	Editor: editor.Editor,
	Document: editor.Document,
	type: require('ot-sexpr'),
	render: require('./render'),
	plugins: {
		base: require('./plugins/base'),
		file: require('./plugins/file'),
		table: require('./plugins/table'),
	},
	keyToId: ids.keyToId,
	idToKey: ids.idToKey
};