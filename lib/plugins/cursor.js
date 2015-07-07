//cursor movement commands
var EXTEND = "extend";

function commands(editor) {
	//closure over editor
	//movement commands

	function move(args) {
		var mode = args.mode; //characters, words, 
						// wordends, wordboundaries, 
						// lines, wholelines, pages
		var amount = args.amount; //number
		var extend = args.extend === EXTEND; //should extend selection

		//TODO
		console.log("Move: " + JSON.stringify(args));
	}

	var numberWords = {
		1:"one",
		2:"two",
	};

	var moveDescriptions = {
		characters: "character",
		words: "word",
		wordends: "word end",
		wordboundaries: "word boundarie",
		lines: "line",
		wholelines: "whole line",
		pages: "page",
	};

	move.description = function(args) {
		var amount = args.amount; 
		var abs_amount = Math.abs(amount);
		var direction = amount > 0 ? "forward" : "backward"
		var mode = (moveDescriptions[args.mode] || "character") +
					(abs_amount > 1 ? "s" : "");
		var amountWord = numberWords[abs_amount] || abs_amount;

		var extend = args.extend === EXTEND ? "Extend" : "Move";

		return extend " selection " +
			direction + " " +
			amountWord + " " +
			mode + ".";
	};

	function moveTo(args) {
		var position = args.position; //eol, bol, hardeol, hardbol
		var extend = args.extend === EXTEND; //should extend selection

		//TODO
		console.log("MoveTo: " + JSON.stringify(args));
	};

	var moveToDescriptions = {
		eol: "end of line",
		bol: "beginning of line",
		eolhard: "hard end of line",
		bolhard: "hard beginning of line",
	};
	moveTo.description = function(args) {
		var position = moveToDescriptions[args.position] || "unknown position";
		var extend = args.extend === EXTEND ? "Extend" : "Move";
		return extend + " selection to " + position + ".";
	};

	return {
		move: move,
		moveTo: moveTo,
	};
}

var keymap = [
	//move
	{keys:["right"], command:"move", args:{mode:"characters", amount:1}},
	{keys:["left"], command:"move", args:{mode:"characters", amount:-1}},
	{keys:["down"], command:"move", args:{mode:"lines", amount:1}},
	{keys:["up"], command:"move", args:{mode:"lines", amount:-1}},
	//extend move
	{keys:["shift-right"], command:"move", args:{mode:"characters", amount:1, extend:"extend"}},
	{keys:["shift-left"], command:"move", args:{mode:"characters", amount:-1, extend:"extend"}},
	{keys:["shift-down"], command:"move", args:{mode:"lines", amount:1, extend:"extend"}},
	{keys:["shift-up"], command:"move", args:{mode:"lines", amount:-1, extend:"extend"}},
	//move to
	{keys:["home"], command:"moveTo", args:{position:"bol"}},
	{keys:["shift-home"], command:"moveTo", args:{position:"bol", extend:"extend"}},
	{keys:["end"], command:"moveTo", args:{position:"eol"}},
	{keys:["shift-end"], command:"moveTo", args:{position:"eol", extend:"extend"}},
];

module.exports = {
	commands: commands,
	keymap: keymap,
	//menu: [],
	//context_menu: [],
}