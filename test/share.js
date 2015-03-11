var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var slate0 = require('slate0');
var sharejs = require('share').client;
sharejs.registerType(slate0.type);

var ottypes = {};
ottypes[slate0.type.name] = ottypes[slate0.type.uri] = slate0.type;

describe('ShareJS Integration', function() {
});