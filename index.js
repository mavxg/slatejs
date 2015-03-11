var slate0 = require('slate0');
var sharejs = require('share/lib/client');
sharejs.registerType(slate0.type);

var ottypes = {};
ottypes[slate0.type.name] = ottypes[slate0.type.uri] = slate0.type;

module.exports = {
	editor: require('./lib/editor'),
	slate0: slate0,
	sharejs: sharejs,
	ottypes: ottypes,
	Dummy: require('dummy-sharejs-connection'),
	model:  slate0.model,
	Store: require('./lib/store'),
	Operations: slate0.Operations,
	Selection: slate0.Cursor,
};