

var KEY_PREFIX = 'clay:';

function keyToId(key) {
	return KEY_PREFIX + key.toString(36);
}

function idToKey(id) {
	return parseInt(id.slice(KEY_PREFIX.length), 36);
}

module.exports = {
	KEY_PREFIX: KEY_PREFIX,
	keyToId: keyToId,
	idToKey: idToKey,
};