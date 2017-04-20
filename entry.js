import { renderComponent, createClass, DOM } from 'friar'
import { Editor, Document } from './editor'
import { parse, Selection, Region, apply, transformCursor } from 'ot-sexpr'

const base = require('./plugins/base');
const table = require('./plugins/table');

//Dummy Blockstore object
function DummyBlockStore(dummy_cost) {
	this.store = {};
	this.dummy_cost = dummy_cost || 200;  //simulate 200ms to save/load block
};
DummyBlockStore.prototype.get = function(key, callback) {
	var self = this;
	setTimeout(function() {
		callback(null, self.store[key]);
	}, this.dummy_cost);
};
DummyBlockStore.prototype.put = function(key, block, callback) {
	this.store[key] = block;
	setTimeout(function() {
		if (callback) callback(null, key);
	}, this.dummy_cost);
};


//B+Tree -- should be good for indexes but will probably
// cause a large amount of block churn. TODO: need to
// make it serialise to a block
//??? Merge and remove....???
//Might want to use something like a LSM tree
// or investigate something from the Purelly functional
// datastructures book.
function LeafNode(order) {
	this.order = order;

	this.parentNode = null;
	this.nextNode = null;
	this.prevNode = null;

	this.data = [];
}
LeafNode.prototype.isLeafNode = true;
LeafNode.prototype.isInternalNode = false;
LeafNode.prototype.split = function() {
	var temp = new LeafNode(this.order);
	var m = Math.ceil(this.data.length / 2);
	var k = this.data[m-1].key;

	temp.data = this.data.slice(0, m)
	this.data = this.data.slice(m)

	temp.parentNode = this.parentNode;
	temp.nextNode = this;
	temp.prevNode = this.prevNode;
	if (temp.prevNode) temp.prevNode.nextNode = temp;
	this.prevNode = temp;

	if (!this.parentNode) {
		var p = new InternalNode(this.order);
		this.parentNode = temp.parentNode = p;
	}

	return this.parentNode.insert(k,temp, this);

};
LeafNode.prototype.insert = function(key, value) {
	var pos = 0;
	for (; pos < this.data.length; pos++) {
		if (this.data[pos].key == key) {
			this.data[pos].value = value;
			return null;
		}
		if (this.data[pos].key > key) break;
	}

	if (this.data[pos])
		this.data.splice(pos, 0, {key: key, value: value});
	else
		this.data.push({key: key, value: value});

	// split if too big
	if (this.data.length > this.order)
		return this.split();
	return null;
};

function InternalNode(order) {
	this.order = order;
	this.parentNode = null;
	this.data = [];
}
InternalNode.prototype.isLeafNode = false;
InternalNode.prototype.isInternalNode = true;
InternalNode.prototype.split = function() {
	var m = (this.data.length-1)/2;
	if (this.order % 2) //TODO: this seems wrong... should this be this.data.length
		m =  m - 1;
	var temp = new InternalNode(this.order);
	temp.parentNode = this.parentNode;
	//TODO: this should just be temp.data = this.data.splice(0,m)
	//       var key = temp.data.pop();
	temp.data = this.data.slice(0,m);
	var key = this.data[m]
	this.data = this.date.slice(m + 1);

	for (var i=temp.data.length-1; i >= 0; i--)
		temp.data[i].parentNode = temp;

	if (!this.parentNode)
		this.parentNode = temp.parentNode = new InternalNode(this.order);

	return this.parentNode.insert(key, temp, this);
};
InternalNode.prototype.insert = function(key, node1, node2) {
	if (this.data.length > 0) {
		var pos = 1;
		for (; pos < this.data.length; pos += 2)
			if (this.data[pos] > key) break;

		if (this.data[pos]) {
			pos--;
			this.data.splice(pos, 0, key); //node1, key
			this.data.splice(pos, 0, node1);
		} else {
			this.data[pos-1] = node1;
			this.data.push(key);
			this.data.push(node2);
		}

		if (this.data.length > (this.order * 2 + 1))
			return this.split();
		return null;
	} else {
		//TODO: this seems suboptimal
		// [node1,key,node2,key2,node3,...]
		// we should probably have two
		// arrays
		// keys = [key,key2,...]
		// nodes = [node1, node2, node3,...]
		this.data[0] = node1;
		this.data[1] = key;
		this.data[2] = node2;
		return this;
	}
};

function BTree(order, rooty) {
	this.order = order || 4;
	this.root = rooty || new LeafNode(this.order);
}
//???? TODO: what about insert (i.e. repeated keys)
BTree.prototype.set = function(key, value, callback) {
	this.getNode(key, function(err, node) {
		if (err != null) return callback(err);
		var ret = node.insert(key, value);
		if (ret) this.root = ret;
		callback(null);
	});
};
BTree.prototype.get = function(key, callback) {
	this.getNode(key, function(err, node) {
		if (err != null) return callback(err);
		for (var i=0; i<node.data.length; i++) if (node.data[i].key == key)
			return callback(null, node.data[i].value);
		callback(null, null); //not found
	});
};
//getNode used for range queries (in combination with nextNode)
BTree.prototype.getNode = function(key, callback) {
	var current = this.root;
	var found = false;

	while (current.isInternalNode) {
		found = false;
		var len = current.data.length;
		for (var i=1; i < len; i+=2) {
			if (key <= current.data[i]) {
				current = current.data[i-1];
				found = true;
				break;
			}
		}

		if (!found) current = current.data[len - 1];
	}

	callback(null, current);
};


// Async callback cursor
function Cursor(bucket) {
	this.bucket = bucket;
	this.stack = []; //{index,node}
}
Cursor.prototype.First = function(callback) {
	// body...
};
Cursor.prototype.Last = function(callback) {
	// body...
};
Cursor.prototype.Seek = function(key, callback) {
	// body... knows about pages and nodes and can get a value from a page
	// without first getting to the node.
};
Cursor.prototype.Prev = function(callback) {
	// Get Prev item ... must have called Last or Seek before this
};
Cursor.prototype.Next = function(callback) {
	// Get Next item ... must have called First or Seek before this
};
Cursor.prototype.node = function(callback) {
	// Return current leaf node so you can do put(key) on that node




};

//Duplicate keys --- include value in key prefix.
// can just have all key.. in index and forget about having the value
// at all. This would let you do some really cool stuff.
// You can use a signed int for the value to do something cool with that
//  like the valus actually part of the key... (are we okay with 4 bytes)

//IDEAS for text buffer
///   rope
///   gap buffer
///   piece table -- this is how word works -- basically you keep the original untouched
///        and you build up a list of chunks of the original and chuncks of new buffers.


/// LIVE queries are tags on an index that get notified when the index gets updated.


// keys shoud be Uint8Array
// values should be DataViews (until they are converted)

const BUCKET_TYPE = 0x01
const BUCKET_MAGIC = 0x0100BCE7
const LEAF_TYPE = 0x02
const LEAF_MAGIC = 0x02001EAF
const BRANCH_TYPE = 0x03
const BRANCH_MAGIC = 0x03B7A9C0

const MINIMUM_BRANCHING_FACTOR = 8; //Bolt has this set at 2.

const NODE_HEADER_SIZE = 8; //magic 4 plus count 4
const NODE_ELEMENT_SIZE = 12; // 4:pos, 4:ksize, 4:vsize

//binary search 
function search(length, f) {
	var i = 0|0;
	var j = length|0;
	var h;
	while (i < j) {
		h = i + (((j-i)/2)|0);
		if (!f(h)) {
			i = h + 1;
		} else {
			j = h;
		}
	}
	return i;
}

//a and b are both Uint8Arrays
function bytesEqual(a, b) {
	if (a.byteLength != b.byteLength) return false;
	for (var i = 0; i < a.length; i++)
		if (a[i] !== b[i]) return false;
	return true;
}


//FROM https://github.com/madmurphy/stringview.js/blob/master/stringview.js
function getUTF8CharLength(c) {
	return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : c < 0x200000 ? 4 : c < 0x4000000 ? 5 : 6;
}

function putUTF8CharCode(aTarget, nChar, nPutAt) {
	console.log(nChar)
	var nIdx = nPutAt;

	if (nChar < 0x80 /* 128 */) {
		/* one byte */
		aTarget[nIdx++] = nChar;
	} else if (nChar < 0x800 /* 2048 */) {
		/* two bytes */
		aTarget[nIdx++] = 0xc0 /* 192 */ + (nChar >>> 6);
		aTarget[nIdx++] = 0x80 /* 128 */ + (nChar & 0x3f /* 63 */);
	} else if (nChar < 0x10000 /* 65536 */) {
		/* three bytes */
		aTarget[nIdx++] = 0xe0 /* 224 */ + (nChar >>> 12);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 6) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + (nChar & 0x3f /* 63 */);
	} else if (nChar < 0x200000 /* 2097152 */) {
		/* four bytes */
		aTarget[nIdx++] = 0xf0 /* 240 */ + (nChar >>> 18);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 12) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 6) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + (nChar & 0x3f /* 63 */);
	} else if (nChar < 0x4000000 /* 67108864 */) {
		/* five bytes */
		aTarget[nIdx++] = 0xf8 /* 248 */ + (nChar >>> 24);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 18) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 12) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 6) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + (nChar & 0x3f /* 63 */);
	} else /* if (nChar <= 0x7fffffff) */ { /* 2147483647 */
		/* six bytes */
		aTarget[nIdx++] = 0xfc /* 252 */ + /* (nChar >>> 30) may be not safe in ECMAScript! So...: */ (nChar / 1073741824);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 24) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 18) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 12) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + ((nChar >>> 6) & 0x3f /* 63 */);
		aTarget[nIdx++] = 0x80 /* 128 */ + (nChar & 0x3f /* 63 */);
	}

	return nIdx;

};

//TODO: this is very similar to new TextEncoder().encode()
// could use that if we don't mind out string starting with
// a character that is also the string type indicator
function stoa(str, array, offset) {
	//convert a DOMstring to a Uint8Array
	//TODO: want to put our string type specifier
	//      at the start of this.
	offset = offset || 0;

	if (!array) {
		var outputLen = offset;
		for (var i = 0; i < str.length; i++)
			outputLen += getUTF8CharLength(str.codePointAt(i));
		array = new Uint8Array(outputLen);
	}

	for (var i = 0, o = offset; i < str.length; i++)
		o = putUTF8CharCode(array, str.codePointAt(i), o);

	return array;
}

function atos(array, offset) {
	//NOTE: Not IE
	return new TextDecoder().decode(array, offset);
}

window.stoa = stoa;

/*

NOTE: all values stored big-endian (i.e. network ordering)

page {
	magic uint32 //different for leaf and internal node (first byte should align with..)
	count uint32 
	elements[count] element
	//key0,value0,key1,value1,etc
}

element {
	pos uint32
	ksize uint32
	vsize uint32
}

*/

function Node(bucket, parent, key_in_parent, value) {
	//represents the in memory deserialised version of a page
	this.bucket = bucket;
	this.key = key_in_parent; // key in parent
	this.parent = parent || null; //parent node
	//this.children = []; //we append any children we materialise here
	this.inodes = []; //Not parallel arrays as they would be slower to insert and split
	this.isLeaf = true;
	this.byteLength = 65; //default byteLength in parent TODO: replace with keylength estimate
	//parallel arrays for inodes
	this.dirty = false;
	this.unbalanced = false;

	if (value) //is a buffer view
		this.read(value);
}
Node.prototype.isBlockAware = true;
Node.prototype.root = function() {
	var n = this;
	while (n.parent) n = n.parent;
	return n;
};
Node.prototype.rebalance = function(pageSize, fillPercentage) {
	if (!this.unbalanced) return this;
	var prev = null;
	var len = this.inodes.length;
	for (var i = 0; i < this.inodes.length; i++) {
		var inode = this.inodes[i];
		if (inode.value.isBlockAware) {
			inode.value.rebalance(pageSize, prev);
		} else {
			prev = null;
		}
	}
	this.unbalanced = false;

	var threshold = pageSize / 4;
	//if filled enough and have more than the minimum number of keys then
	//check is we need to split
	if (!this.sizeLessThan(threshold) && this.inodes.length >= this.minKeys())
		return this.split(pageSize);

	if (this.parent == null) {
		//root node needs special handling
		if (!this.isLeaf && this.inodes.length == 1 && this.inodes[0].value.isBlockAware) {
			//we have an instantiated single child node
			var child = this.inodes[0].value;
			child.parent = null;
			return child;
		}
		return this;
	}

	//TODO: this needs to have merging of small nodes in some way.
	// we may want to inline in the branch nodes any very small leaf nodes
	//  ... but they would have to be very small.
	return this;
};
Node.prototype.write = function(data, offset) {
	//TODO: this probably doesn't need an offset parameter (although it might save an alloc)
	offset = offset || 0;
	// data must be a Uint8Array of sufficient size
	if (!data) {
		//if we didn't get somewhere to write to then make a new buffer
		// of the required size.
		data = new Uint8Array(this.size() + offset);
	}
	var dv = new DataView(data.buffer, data.byteOffset + offset, data.byteLength);
	var count = this.inodes.length;
	var inodes = this.inodes;
	dv.setUint32(0, this.isLeaf ? LEAF_MAGIC : BRANCH_MAGIC);
	dv.setUint32(4, count);
	var j = NODE_HEADER_SIZE;
	var pos = offset + NODE_HEADER_SIZE + NODE_ELEMENT_SIZE * count; //pos after..
	for (var i = 0; i < count; i++) {
		var inode = inodes[i];
		//TODO: check to make sure that we have a Uint8Array in inode.value
		//  and if not it should support write
		dv.setUint32(j, pos);
		dv.setUint32(j+4, inode.key.byteLength);
		dv.setUint32(j+8, inode.value.byteLength);
		data.set(inode.key, pos);
		pos += inode.key.byteLength;
		data.set(inode.value, pos);
		pos += inode.value.byteLength;
		j += 12; //NODE_ELEMENT_SIZE
	}
	return data;
};
Node.prototype.read = function(value) {
	//value must be a Uint8Array
	var dv = new DataView(value.buffer, value.byteOffset, value.byteLength);
	var buffer = value.buffer;
	var byteOffset = value.byteOffset;
	var count, type;
	var inodes = [];
	var magic = dv.getUint32(0);
	count = dv.getUint32(4);
	this.isLeaf = (type === LEAF_MAGIC);
	var j = NODE_HEADER_SIZE;
	for (var i = 0; i < count; i++) {
		var pos = dv.getUint32(j) + byteOffset;
		var ksize = dv.getUint32(j+4);
		var vsize = dv.getUint32(j+8);
		inodes.push({
			key: new Uint8Array(buffer, pos, ksize),
			value: new Uint8Array(buffer, pos + ksize, vsize)
		});
		j += 12;
	}
	this.inodes = inodes;
};
Node.prototype.splitIndex = function(threshold) {
	var sz = NODE_HEADER_SIZE;
	var minKeysPerPage = this.minKeys();
	var l = this.inodes.length - minKeysPerPage;
	for (var i = 0; i < l; i++) {
		var inode = this.inodes[i];
		sz += NODE_ELEMENT_SIZE + inode.key.byteLength + inode.value.byteLength;
		if (i >= minKeysPerPage && sz > threshold)
			break;
	}
	return i;
};
Node.prototype.splitTwo = function(pageSize, fillPercentage) {
	//check if we are big enough to split
	if (this.inodes.length <= this.minSplitKeys() || this.sizeLessThan(pageSize)) {
		return null;
	}
	var threshold = pageSize * fillPercentage; //we may want to make this bigger 
	var splitIndex = this.splitIndex(threshold);

	//if we don't have a parent then create one
	if (this.parent == null) {
		this.parent = new Node(this.bucket);
		this.parent.isLeaf = false;
		//add ourselves to the parent
		this.key = this.inodes[0].key;
		this.parent.put(this.key, this.key, this);
	}

	var next = new Node(this.bucket, this.parent);
	next.isLeaf = this.isLeaf;
	next.inodes = this.inodes.splice(splitIndex); //TODO: is this off by 1?
	//TODO: this is a schlemiel the painter algorithm
	// and will be very slow if we add a large number of items to a node
	// and then split it.
	for (var i = next.inodes.length - 1; i >= 0; i--) {
		var inode = next.inodes[i];
		if (inode.value.isBlockAware)
			inode.value.parent = next;
	}
	return next;
};
Node.prototype.split = function(pageSize, fillPercentage) {
	fillPercentage = fillPercentage || 0.5;
	var wasRoot = !(this.parent); //do we need to split our parent?

	var node = this;
	while (true) {
		var b = node.splitTwo(pageSize, fillPercentage);
		if (b === null) break;
		node = b;
		var key = node.key;
		if (key === null) {
			key = node.inodes[0].key;
		}
		node.parent.put(key, node.inodes[0].key, node);
		node.key = node.inodes[0].key;
	}

	if (wasRoot && this.parent)
		return this.parent.split(pageSize);
	return this;

};
Node.prototype.spillChildren = function(callback) {
	var self = this;
	//spill all the block aware stuff.
	//eachA(this.children,function (child, next) {
		//TODO:
	//}, callback);
};
//spill = write out the store
Node.prototype.spill = function(callback) {
	if (!this.dirty) return callback(null, null);
	//TODO:
	//NOTE: we need to do all the splitting of
	//  children syncronously so that we can
	//  be sure to spill all the new nodes created
};
Node.prototype.minSplitKeys = function() {
	if (this.isLeaf) return 1;
	return MINIMUM_BRANCHING_FACTOR * 2;
};
Node.prototype.minKeys = function() {
	if (this.isLeaf) return 1;
	return MINIMUM_BRANCHING_FACTOR;
};
Node.prototype.put = function(oldkey, key, value) {
	// oldkey, (new)key, and value must all be Uint8Arrays(ish)
	// value can be a Node or another object that supports write()
	//    and byteLength (which needs to be reasonable.)
	// assert( oldkey == (new)key if leaf node )
	var inodes = this.inodes;
	//find insertion point
	var index = search(inodes.length, function(i) { return (oldkey >= inodes[i].key); });
	// TODO: append optimisation
	// if (index >= inodes.length) { inodes.push({key:key, value:value}) } else
	if (!(inodes.length > 0 &&
		index < inodes.length &&
		bytesEqual(inodes[index].key, oldkey))) {
		//insert a new inode.

		this.inodes.splice(index, 0, {key:key, value:value});
	} else {
		//update an existing inode.
		var inode = inodes[index];
		inode.key = key;
		inode.value = value;
	}
	var node = this;
	while (node && (!node.dirty || !node.unbalanced)) {
		node.dirty = true;
		node.unbalanced = true;
		node = node.parent;
	}
};
Node.prototype.delete = function(key) {
	var inodes = this.inodes;
	var index = search(inodes.length, function(i) { return (oldkey >= inodes[i].key); });
	if (index >= inodes.length || !bytesEqual(inodes[i].key, key))
		return; //could not find element
	this.inodes.splice(index,1);
	var node = this;
	while (node && (!node.dirty || !node.unbalanced)) {
		node.dirty = true;
		node.unbalanced = true;
		node = node.parent;
	}
};
Node.prototype.childAt = function(index, callback) {
	// Return child node at index
};
Node.prototype.size = function() {
	var size = NODE_HEADER_SIZE;
	for (var i = this.inodes.length - 1; i >= 0; i--) {
		var inode = this.inodes[i];
		size += NODE_ELEMENT_SIZE + inode.key.byteLength + inode.value.byteLength;
	}
	return size;
};
Node.prototype.sizeLessThan = function(v) {
	var size = NODE_HEADER_SIZE;
	for (var i = this.inodes.length - 1; i >= 0; i--) {
		var inode = this.inodes[i];
		size += NODE_ELEMENT_SIZE + inode.key.byteLength + inode.value.byteLength;
		if (size >= v)
			return false;
	}
	return true;
};


/* Async */
function noop() {}

function each(obj, iterator, callback) {
	callback = callback || noop;
	var pending = 0;
	var completed = 0;

	for (var k in obj) {
		if (obj.hasOwnProperty(k)) {
			++pending;
			iterator(obj[k],done)
		}
	}

	function done(err) {
		if (err) {
			var dn = callback;
			callback = noop;
			dn(err);
		} else if (++completed===pending) {
			callback(null);
		}
	}
}
/* end Async */


nextTick = (function(window, prefixes, i, p, fnc) {
    while (!fnc && i < prefixes.length) {
        fnc = window[prefixes[i++] + 'equestAnimationFrame'];
    }
    return (fnc && fnc.bind(window)) || window.setImmediate || function(fnc) {window.setTimeout(fnc, 0);};
})(window, 'r webkitR mozR msR oR'.split(' '), 0);



function Bucket(store, value, parent, key) {
	this.store = store;
	this.sequence = 0
	this.rootNode;
	this.pageSize = 4096;
	this.fillPercentage = 0.5; //
	this.parent = parent; //our parent node.
	this.key = key; //our key in our parent node.
	this.byteLength = 

	if (value) {
		this.read(value);
	} else {
		this.rootNode = new Node(this)
	}
}
Bucket.prototype.isBlockAware = true;
Bucket.prototype.node = function(page_key, parent, callback) {
	//called from Cursor node

	var node = this.nodes[page_key]; // return from cache
	//otherwise make a node
	// and read in the page into the node.
	// and set this.nodes[page_key]

	//add this node to parent.children

	return node; //does this actually need to be a callback.
};
Bucket.prototype.NextSequence = function() {
	this.sequence += 1;
	return this.sequence;
};
Bucket.prototype.Sequence = function() {
	return this.sequence;
};
Bucket.prototype.SetSequence = function(value) {
	this.sequence = value;
};
Bucket.prototype.Put = function(key, value, callback) {
	// key: Uint8Array
	// value: Uint8Array -- byte array (or a blockAware object)
	var c = this.Cursor();
	c.Seek(key, function(k, v) {
		c.node(function(err, node) {
			if (err) return callback(err);
			node.put(key, key, value);
			callback(null);
		});
	});
};
Bucket.prototype.Get = function(key, callback) {
	var c = this.Cursor();
	c.Seek(key, function(err, k, v) {
		if (k != key) return callback(k, null);
		callback(key, v);
	});
};
Bucket.prototype.Delete = function(key, callback) {
	var c = this.Cursor();
	c.Seek(key, function(err, k, v) {
		if (err) return callback(err);
		if (k !== key) return callback("No such key");
		c.node(function(err, node) {
			if (err) return callback(err);
			node.delete(key);
			callback(null);
		});
	});
};
Bucket.prototype.Cursor = function() {
	return new Cursor(this);
};
Bucket.prototype.rebalance = function() {
	this.rootNode.rebalance(this.pageSize, this.fillPercentage);
	var size = BUCKET_HEADER_SIZE + this.rootNode.size();
	if (this.parent && size < (this.parent.bucket.pageSize / 4)) {
		//inlineable.
		this.byteLength = size;
	} else {
		this.byteLength = 65; //estimated key size
	}
};
Bucket.prototype.spill = function(max_inline, callback) {
	//TODO;
};

Bucket.prototype.Commit = function(callback) {
	this.rebalance(); //can be done syncronously
	this.spill(callback);
};

// ^^^ values and keys are both byte arrays at this point. ???
// What about an unpersisted block... how do we know where they
// are going to be.


/*

DB 
  Begin() -> Tx
  Update(func(Tx) {})
  View(func(Tx read only) {}) --- read transactions are always on a view of a bucket
  // so  this doesn't make sense as an API here.

Tx

//Our Bucket instance is a transaction


Commit
   root.rebalance() --- we can do all this on the Bucket itself
     root is a Bucket
     nodes rebalance() -- only nodes we have opened
     buckets rebalance() -- only buckets we have opened
   root.spill()
   tx.write()
     write any dirty pages to disk (tx.pages)
   tx.writeMeta()
   tx.close()
OnCommit


// Do we need a meta ... or is the root just a simple
// bucket.
//    ... what about stats and things like that?
// what if we want to know things like how big the database is?

/*
OUR on disk structure

??? Where are we going to store the sequence for a bucket or the page size ???

page {
	magic uint32 //different for leaf and internal node (first byte should align with..)
	count uint32 
	elements[count] element
	//key0,value0,key1,value1,etc
}

element {
	pos uint32
	ksize uint32
	vsize uint32
}


/// b+tree bucket header

{
	magic uint32; //this is 1 byte for a b+tree type and  then the rest is for pageSize
	//pageSize = (1 << (magic && 0x00FFFFFF))
	sequence uint64 //NOTE that max safe int is 2**53 - 1
	//so this is actually stored as two uint32 numbers in a row
}

//bucket inline

{ bucket header }{ bucket root page (leaf or internal) }

//bucket not inline

{ bucket header }{ address for root node }

//write inline bucket
// n = b.rootNode
// value = make(bucketHeaderSize + n.size)

// In memory bucket structure
Bucket {
	*bucket
	buckets -- sub buckets cache
	rootNode -- materialize vnode for root page
	nodes map[...]*node //node cache
}

// Different magic for 64bit or varint version of this structure.


// URL.createObjectURL(blob ish) lets you do some nice stuff with returned buffer

/*

XMLHttpRequest.response -> ArrayBuffer, Blob, Document (XML or HTML), JSON, or DOMString

*/

/*
meta {
	magic uint32
	version uint32
	pageSize uint32
	flags uint32
	root bucket { root pgid, sequence uint64 }
	freelist pgid
	pgid
	txid
	checksum uint64
}
*/

//What should the Tx do... We can have a long running transaction


//TODO: Cursor
//        First()
//        Last()
//        Seek(key)
//        Prev()
//        Next()
//        node() --current leaf node so you can do c.node().put(key, ...)

//B+Tree = Bucket
//   NextSequence()
//   Put(key, value)
//   Get(key)
//   Delete(key)
//   Cursor()
//   ForEach(fn(key, value))
//   CreateBucket(key) -- root: &node{isLeaf: true}, bucket: &bucket
///// we don't need to have a special bucket type ... bucket is tree


function hex(buffer) {
  var hexCodes = [];
  var view = new DataView(buffer);
  for (var i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    var value = view.getUint32(i)
    // toString(16) will give the hex representation of the number without padding
    var stringValue = value.toString(16)
    // We use concatenation and slice for padding
    var padding = '00000000'
    var paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue);
  }

  // Join all the hex strings into one
  return hexCodes.join("");
}

function SimpleMarshaller(passphrase) {
	this.passphrase = passphrase;
}
SimpleMarshaller.prototype.deserialise = function(bytes, context, callback) {
	try {
		var str = new TextDecoder().decode(bytes); //TODO: decrypt the bytes
		var obj = JSON.parse(str);
		callback(null, obj)
	} catch (err) {
		callback(err);
	}
};
SimpleMarshaller.prototype.serialise = function(obj, context, callback) {
	try {
		var str = JSON.stringify(obj);
		var bytes = new TextEncoder().encode(str); //TODO: encrypt the bytes
		crypto.subtle.digest({
			name: "SHA-256",
		}, bytes).then(function(hash) {
			callback(null, bytes, "sha256:" + hex(hash));
		}).catch(callback)
	} catch (err) {
		callback(err);
	}
};


// MarshalStore sits between a CacheStore and a
// backend store. Its job is to handle things like
// encryption and decryption
function MarshalStore(blockstore, marshaller) {
	this.blockstore = blockstore;
	this.marshaller = marshaller;
}
MarshalStore.prototype.get = function(key, callback, context) {
	var marshaller = this.marshaller;
	this.blockstore.get(key, function(err, value) {
		if (err != null) return callback(err);
		marshaller.deserialise(value, context, callback);
	}, context);
};
MarshalStore.prototype.put = function(key, obj, callback, context) {
	var self = this;
	this.marshaller.serialise(obj, context, function(err, block, newkey) {
		if (err != null) return callback(err);
		var _key = newkey || key;
		self.blockstore.put(_key, block, callback);
	});
};

// CacheStore caches objects it gets back from the ...
function CacheStore(blockstore) {
	this.cache = {};
	this.blockstore = blockstore;
}
//TODO: simple cacheStore -- don't


//!!!! IMPORTANT --- StructStore should not be responsible for unsaved changes.
// The Transaction is what has the unsaved changes as part of the deserialised
// nodes it gets from the Store. It is a transactions responsiblity to know when
// it can clean out nodes. etc.

// Other stuff may be in the cache (but should be in the encrypted state)


//Called StructStore and not ObjStore to emphasise
// that this is to store raw structs that a single
// serialise method can get to a bit sequence to write
// to disk somewhere
//
// serialise(obj, context, callback(err,byte[], [key]))
// deserialise(byte[], context, callback(err, obj))
//
//TODO: should this do some form of storage to localhost?
//  alternative is that we have some form of localhost
//  blockstore alternative that we then move those blocks
//  to another off system blockstore when we want to commit
//  (that requires us to have some form of tree of what we
//   want to send offsystem.)
function StructStore(blockstore, marshaller) {
	this.cache = {}; //blocks parsed //Should be LRU store
	this.marshaller = marshaller || new SimpleMarshaller("password :)");
	this.blockstore = blockstore;
	this._dirty = {}; //keys that are dirty
	this.fetching = {}; //keys we are already fetching
	this.sending = {}; //keys we are sending
	this.unsaved = {};
	this._IdSequence = 0;
	//fetching...??? debounce deduplicate calls
}
// Args
//  key : string -- path in blockstore
//  callback : func(err, obj)
//  context : any passed to deserialise to get the object back
StructStore.prototype.get = function(key, callback, context) {
	var obj = this.cache[key];
	if (obj) return callback(null, obj);
	//TODO: check fetching here. Store callback in fetching list.
	// note: not thread safe.
	var self = this;
	this.blockstore.get(key, function(err, block) {
		if (err != null) return callback(err); //failed to fetch.
		self.marshaller.deserialise(block, context, function(err, obj) {
			if (err != null) return callback(err); //failed to deserialise.
			self.cache[key] = obj;
			callback(null, obj); //everything went fine.
			//TODO: check here is we need to clear some memory from
			// the LRU cache
			// simple cache and prev_cache?
		});
	});
};
// put is to send a dirty object back to the underlying store
// and should be called by the system on a commit of some form.
//  callback func(err, newkey) --
StructStore.prototype.put = function(key, obj, callback, context) {
	// what should we do if it is not dirty
	var self = this;
	this.marshaller.serialise(obj, context, function(err, block, newkey) {
		if (err != null) return callback(err);
		var _key = newkey || key;
		if (_key != key) {
			delete self.cache[key];
			delete self._dirty[key];
		}
		self.cache[_key] = obj;
		self.sending[_key] = true;
		delete self._dirty[_key];
		self.blockstore.put(_key, block, function(err, __key) {
			if (err != null) {
				console.log("ERROR: couldn't save ...");
				self.unsaved[__key];
			}
			delete self.sending[__key];
		});
		//callback happens before we know if it actually hit disk
		callback(null, _key);
	});
};
//  obj : any -- new minted object
//  callback : func(err, key)
//NOTE: this doesn't need to be async in this case
// but other implementation that actually put
// the new object somewhere might need to be
// so for consistency we are going FULL ASYNC
StructStore.prototype.allocate = function(obj, callback) {
	this._IdSequence += 1
	var id = "#" + this._IdSequence;
	this.cache[id] = obj;
	this._dirty[id] = true;
	callback(null, id);
};
//calls to forget should be rare(ish). This is for
// objects you have asked the Store to manage (for persistence)
// that you are now happy to see deleted.
StructStore.prototype.forget = function(key) {
	delete this.cache[key];
	delete this._dirty[key];
};
StructStore.prototype.dirty = function(key) {
	this._dirty[key] = true;
};
StructStore.prototype.isDirty = function(key) {
	return !!(this._dirty[key]);
};

//make available in console.
window.DummyBlockStore = DummyBlockStore;
window.BTree = BTree;
window.StructStore = StructStore;
window.SimpleMarshaller = SimpleMarshaller;
window.Node = Node;
window.Cursor = Cursor;
window.Bucket = Bucket;


//What should be responsible for getting blocks here?
// fetch or something else --- i.e. where are we implementing b+tree;
// or hash tree?

//Dummy Table/Tree object.
function Table(objstore, root_block) {
	this.changes = {};
	this.subscriptions = {};
	this.all_subscription = [];
	this.objstore = objstore;
	this.root_block = root_block;
	this._pending = {}; //blocks being fetched.
};
Table.prototype.fetch = function(key, callback) {
	//Trigger fetch of a key not in cache
	// not needed for the dummy store.
	// override for block backed stuff...
};
Table.prototype.get = function(key, callback) {
	var value = this.changes[key];
	if (value != undefined) callback(key, value);
	else this.fetch(key, callback);
};
Table.prototype.notify = function(key, value, old) {
	var subs = this.subscriptions[key];
	if (subs) for (var i = subs.length - 1; i >= 0; i--) {
		try {
			var f = subs[i];
			f(key, value, old)
		} catch (e) {
			subs.splice(i,1) //remove subscriber on throw
		}
	}
	subs = this.all_subscription;
	for (var i = subs.length - 1; i >= 0; i--) {
		try {
			var f = subs[i];
			f(key, value, old)
		} catch (e) {
			subs.splice(i,1) //remove subscriber on throw
		}
	}
};
Table.prototype.set = function(key, value) {
	var old = this.cache[key];
	//Notify subscribers
	this.notify(key, value, old);
};
Table.prototype.subscribe = function(key, callback) {
	var subs = this.subscriptions[key];
	if (!(subs)) {
		subs = this.subscriptions[key] = [];
	}
	subs.push(callback);
	//NOTE: subscribe doesn't do a get
	// and fetch doesn't notify subscribers.
};
Table.prototype.unsubscribe = function(key, callback) {
	var subs = this.subscriptions[key];
	if (!subs) return;
	var i = subs.indexOf(callback);
	if (i > -1) subs.splice(i, 1); //remove item
};
Table.prototype.subscribeAll = function(callback) {
	this.all_subscription.push(callback);
};
Table.prototype.unsubscribeAll = function(callback) {
	var subs = this.all_subscription;
	var i = subs.indexOf(callback);
	if (i > -1) subs.splice(i, 1); //remove item
};

//Note: Displayed table object should actually be pivot powered from the start.
// all of the columns should be based upon id .. entries in cells are
// all of the form {#ida:id, #idb:id, content: ... }
// we then index that when we actually go to render the table.
// any table size and in out can be afforded.
// don't build the calculation tables we have elsewhere.
// IO tables are just underspecified.

// List items should be dummied up with paragraph items rather than trying to wrap them
// Code items should not merge together unless they are in the same code block


// FaaS - functions defined in blocks that you can then call upon... 
// output of object should be storable (or cacheable).

const doc = `(doc (section
(p "")
{"headerRows":1}(table
(row (cell "Cat[]=") (cell "Qube[]") (cell "Other[]") (cell "Extra"))
(row (cell "First") (cell "99") (cell "100") (cell))
(row (cell "Second") (cell "199") (cell "200") (cell))
(row (cell "Third") (cell "299") (cell "300") (cell))
)
(h1 "Welcome to SlateJS")
(p "Welcome to your editor.")
(p [[76,{}],[2,{"sub":true}],[24,{}],[2,{"sup":true}],[76,{}],[16,{"href":"http://google.co.uk"}],[177,{}]]"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, aliquid ex necessitatibus repellatTM a illo fuga dolore aperiam totam tempore nisi neque delectus labore, nihil quae dignissimos dolores mollitia? Vel sunt neque voluptatibus excepturi laboriosam possimus adipisci quidem dolores, omnis nemo dolore eligendi blanditiis, voluptatem in doloribus hic aperiam.")
{"alignments":["left","right"]}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(p "")
{"alignments":["left","right"]}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(p "")
) (section
(h1 "Another Section")
(p "Another paragraph in a another section")
(code "Another = Qube * Other + 5")
(code "Extra[Cat=First] = 77")
(code "Extra = 88")
(code "Test[Cat=First] = 123456")
(code "Another[Cat=First]")
(code "Qube[Cat=First]")
(ulli "First list item")
{"indent":2}(ulli "First sub list item")
{"indent":3}(ulli "First sub sub list item")
(ulli "Second list item")
{"indent":2}(ulli "First sub list item")
{"indent":2}(ulli "Second sub list item")
(olli "First list item")
{"indent":2}(olli "First sub list item")
{"indent":2}(olli "Second sub list item")
(olli "Second list item")
(blockquote "This is a really important quote.")
(pullquote "This is another really important quote.")
{"alignments":["left","right"], "headerRows":1}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(result (p "paragraph in a result"))
(p "")
))`

const sel = new Selection([new Region(12,9)]);

//Example of how to make a document undo manager plugin
var undoer = (editor) => {
	function undo() {
		console.log('Would love to undo right now.');
	}
	undo.description = () => "Undo previous action.";

	function redo() {
		console.log('Would love to redo right now.')
	}
	redo.description = () => "Redo previous action.";

	return {
		commands: {
			undo,
			redo,
		},
		keymap: [
			{keys:["ctrl+z"], command:"undo"},
			{keys:["cmd+z"], command:"undo"},
			{keys:["ctrl+shift+z"], command:"redo"},
			{keys:["cmd+y"], command:"redo"},
		]
	}
}

var App = createClass({
	getInitialState: function() {
		var state = {
			document: parse(this.props.doc)[0],
			selection: sel
		};
		return state;
	},
	apply: function(ops, selection, compose) {
		var doc = apply(this.state.document, ops);
		var sel = selection ? selection :
			transformCursor(this.state.selection, ops, true)
		this.setState({
			document: doc, 
			selection: sel
		});
		//TODO: this.undoManager.add(ops, compose);
	},
	select: function(selection) {
		if (this.state.selection !== selection)
			this.setState({selection: selection});
	},
	render: function() {
		var s = this.state;
		return Editor({
			document: s.document,
			apply: this.apply,
			select: this.select,
			selection: s.selection,
			plugins:[undoer, base, table]
		});
	}
});

//Why do the plugins need to have access to the editor?
//They need to provide commands and a set of keymaps

renderComponent(App({doc}),document.getElementById('app'));