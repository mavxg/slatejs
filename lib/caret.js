//caret.js

function last(a) { return a[a.length - 1]; }

function Caret(node, offset, outside) {
	this.node = node;
	this.offset = offset;
	this.outside = outside;
}

Caret.prototype.getClientRect = function() {
	var node = this.node;
	var rect;
	var range = node.ownerDocument.createRange();
	range.setStart(node, 0);
	range.setEnd(node, this.offset);
	rect = last(range.getClientRects());
	return {left: rect.right, right: rect.right,
			top: rect.top, bottom: rect.bottom, 
			height: rect.bottom - rect.top,
			width: 0};
};

function last(a) { return a[a.length - 1]; }

function modifiedDist(rect, x, y) {
	var ud = y < rect.bottom ? Math.max(0, rect.top - y) : 
							   (y - rect.bottom);
	var rl = (x >= rect.right) ? x - rect.right : 
			 ((x <= rect.left) ? rect.left - x : 0);
	return rl + ud * 5;// 100; //make up down offset much worse than left right
}

function offsetFromPoint(textnode, x, y) {
	var doc = textnode.ownerDocument;
	var range = doc.createRange();
	var len = textnode.length;
	var rect;
	var rects;
	range.selectNode(textnode);
	rects = range.getClientRects();
	rect = range.getBoundingClientRect();
	var totalWidth = rect.right * 2;
	var innerY = Math.min(rect.bottom - 1, Math.max(rect.top + 1, y));
	//binary search
	var to = len;
	while (textnode.textContent[to - 1] === '\n') to -= 1;
	var from = 0;
	var fromX = rects[0].left;
	var toX = last(rects).right;
	var dist = to - from;
	var toWrong = false;
	for (;;) {
		if (to - from <= 1) {
			if (toWrong) return from;
			return (x < fromX || x - fromX <= toX - x) ? from : to;
		}
		var step = Math.ceil(dist / 2);
		var middle = from + step;
		range.setEnd(textnode, middle);
		rects = range.getClientRects();
		rect = last(rects);

		var rx = rect.right;
		if (rect.top > innerY) rx += totalWidth;
		else if (rect.bottom < innerY) rx -= totalWidth;

		if (x <= rx) { 
			to = middle; 
			dist = step; 
			toX = rect.right; 
			toWrong = rx !== rect.right 
		} else { from = middle; dist -= step; fromX = rect.right; }
	}
}


//TODO: this doesn't work for superscripts in lines.
//  probably also doesn't work for subscript
function coordsCaret(root, x, y) {
	var best = null;
	var bestRect = null;
	var range = root.ownerDocument.createRange();
	var len = root.childNodes.length;
	var offset = 0;
	var bestRectDist = null;

	function processRects(rects) {
		var rect
		for (var i = 0; i < rects.length; i++) {
			var rect = rects[i];
			var rectDist = modifiedDist(rect, x, y);
			if (bestRectDist === null || rectDist < bestRectDist) {
				best = node;
				bestRect = rect;
				bestRectDist = rectDist;
				if (bestRectDist <= 0) break;
			}
		};
	}

	for (var i = 0; i < len; i++) {
		var node = root.childNodes[i];
		var rect = null;

		if (node.nodeType === 3) {
			range.selectNodeContents(node);
			processRects(range.getClientRects());
		} else if (node.getClientRects) {
			processRects(node.getClientRects());
		}

		if (bestRectDist !== null && bestRectDist <= 0) break;
	}

	if (best === null) {
		best = root;
	} else if (best.childNodes.length > 0) {
		return coordsCaret(best, x, y);
	}

	if (best.nodeType === 3) {
		offset = offsetFromPoint(best, x, y);
		range.setStart(best, 0);
		range.setEnd(best, offset);
		bestRect = last(range.getClientRects());
	} else {
		offset = nodeIndex(best) + 1;
		best = best.parentNode;
	}

	return new Caret(best, offset, bestRect.bottom < y || bestRect.top > y)

}

module.exports = {
	coordsCaret: coordsCaret,
};