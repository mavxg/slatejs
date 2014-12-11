var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var Operations = require('../lib/operations');
var m = require('../lib/model');
var UndoManager = require('../lib/undo');

describe('Compose', function() {
	var doc = new m.Document(1,[new m.P(2,["This is some text."])]);
	var opA = new Operations().retain(4).insert(" really").end(doc.length);
	var opB = new Operations().retain(4+7).insert(" actually").end(doc.length+7);

	it('Can compose inverse', function() {
		var a = m.apply(doc, opA);
		var inv = opA.invert();
		var comp = opA.compose(inv);
		var b = m.apply(a, inv);		
		var c = m.apply(doc, comp);
		assert.equal(JSON.stringify(c),JSON.stringify(doc));
		assert.equal(JSON.stringify(b),JSON.stringify(doc));
	});

	it('Can compose inserts', function() {
		var a = m.apply(doc, opA);
		var comp = opA.compose(opB);
		var b = m.apply(a, opB);
		var c = m.apply(doc, comp);
		assert.equal(JSON.stringify(c),JSON.stringify(b));
	});

	it('Compose of inverse is inverse of compose', function() {
		var comp = opA.compose(opB);
		var ia = opA.invert();
		var ib = opB.invert();
		var icomp = comp.invert();
		var compi = ib.compose(ia);
		var dp = m.apply(doc, comp);
		var a = m.apply(dp, icomp);
		var b = m.apply(dp, compi);
		assert.equal(JSON.stringify(a),JSON.stringify(doc));
		assert.equal(JSON.stringify(b),JSON.stringify(doc));
	});
});

describe('Apply', function() {
	var doc = new m.Document(1,[new m.Section(2,[new m.P(4,["This is some text."])]), new m.Section(3,[])]);
	var opsB = new Operations()
		.retain(20)
		.insert('This is some text')
		.insert({_type:'P'})
		.insert({_type:'Section'})
		.insert('this is more text')
		.insert({_type:'H3'})
		.end(doc.length);

	it('Can insert text into string', function() {
		var ops = new Operations()
			.retain(10)
			.insert('mething aweso')
			.retain(12);
		var x = m.apply(doc, ops);
		assert.equal(JSON.stringify(x), 
			'{"type":"Document","id":1,"children":[{"type":"Section","id":2,"children":[{"type":"P","id":4,"children":["This is something awesome text."]}]},{"type":"Section","id":3,"children":[]}]}');
	});

	it('Can insert paragraph into empty section', function() {
		var y = m.apply(doc, opsB);
		assert.equal(JSON.stringify(y),
			'{"type":"Document","id":1,"children":[{"type":"Section","id":2,"children":[{"type":"P","id":4,"children":["This is some text."]}]},{"type":"Section","id":6,"children":[{"type":"P","id":5,"children":["This is some text"]}]},{"type":"Section","id":3,"children":[{"type":"H3","id":7,"children":["this is more text"]}]}]}');
	});

	it('Roundtrip apply and apply invert', function() {
		var y = m.apply(m.apply(doc, opsB), opsB.invert());
		assert.equal(JSON.stringify(y),JSON.stringify(doc));
	});
});

describe('Undo manager', function() {
	var doc = new m.Document(1,[new m.Section(2,[new m.P(4,["This is some text."])]), new m.Section(3,[])]);
	var opsB = new Operations()
		.retain(20)
		.insert('This is some text')
		.insert({_type:'P'})
		.insert({_type:'Section'})
		.insert('this is more text')
		.insert({_type:'H3'})
		.end(doc.length);

	var other = new Operations()
		.retain(17)
		.insert(" that I want here.")
		.end(doc.length);

	var otherL = new Operations()
		.retain(20)
		.insert("This comes before. ")
		.end(doc.length);

	it('Can undo', function() {
		var um = new UndoManager();
		um.add(opsB);
		var x = m.apply(doc, opsB);
		var y;
		um.performUndo(function(err, op) {
			y = m.apply(x, op);
			um.add(op);
		})
		assert.equal(JSON.stringify(y),JSON.stringify(doc));
	});
	it('Can redo', function() {
		var um = new UndoManager();
		um.add(opsB);
		var x = m.apply(doc, opsB);
		var y, z;
		um.performUndo(function(err, op) {
			y = m.apply(x, op);
			um.add(op);
		});
		um.performRedo(function(err, op) {
			z = m.apply(y, op);
			um.add(op);
		});
		assert.equal(JSON.stringify(y),JSON.stringify(doc));
		assert.equal(JSON.stringify(z),JSON.stringify(x));
	});
	it('Can undo after other op', function() {
		var um = new UndoManager();
		var justOther = m.apply(doc, other);
		var otherP = other.transform(opsB);
		//our apply
		var x = m.apply(doc, opsB);
		um.add(opsB);
		//their apply
		var both = m.apply(x, otherP);
		um.transform(otherP);
		var y;
		um.performUndo(function(err, op) {
			y = m.apply(both, op);
			um.add(op);
		});
		assert.equal(JSON.stringify(justOther),JSON.stringify(y));
	});
	it('Can undo after other op with left', function() {
		var um = new UndoManager();
		var justOther = m.apply(doc, otherL);
		var otherP = otherL.transform(opsB, true);
		//our apply
		var x = m.apply(doc, opsB);
		um.add(opsB);
		//their apply
		var both = m.apply(x, otherP);
		um.transform(otherP);
		var y;
		um.performUndo(function(err, op) {
			y = m.apply(both, op);
			um.add(op);
		});
		assert.equal(JSON.stringify(justOther),JSON.stringify(y));
	});
	it('Can undo compose', function() {
		var um = new UndoManager();
		var otherP = other.transform(opsB);
		var x = m.apply(doc, opsB);
		um.add(opsB, true);
		var both = m.apply(x, otherP);
		um.add(otherP, true);
		var y;
		um.performUndo(function(err, op) {
			y = m.apply(both, op);
			um.add(op);
		});
		assert.equal(JSON.stringify(y),JSON.stringify(doc));
	});
})