var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var Operations = require('../lib/operations');
var m = require('../lib/model');

describe('Operations', function() {
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
		.retain(doc.length - 20);

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