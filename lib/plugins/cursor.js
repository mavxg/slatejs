//cursor movement commands

function commands(editor) {
	//closure over editor
	//movement commands

	function move(args) {
		var mode = args.mode; //characters, words, 
						// wordends, wordboundaries, 
						// lines, wholelines, pages
		var forward = args.forward;
		var amount = args.amount || 1; //number
		var extend = args.extend; //should extend selection

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
		var amount = args.amount || 1; 
		var direction = args.forward ? "forward" : "backward"
		var mode = (moveDescriptions[args.mode] || "character") +
					(abs_amount > 1 ? "s" : "");
		var amountWord = numberWords[amount] || amount;

		var extend = args.extend ? "Extend" : "Move";

		return extend " selection " +
			direction + " " +
			amountWord + " " +
			mode + ".";
	};

	function moveTo(args) {
		var position = args.position; //eol, bol, hardeol, hardbol, eof, bof
		var extend = args.extend === EXTEND; //should extend selection

		//TODO
		console.log("MoveTo: " + JSON.stringify(args));
	};

	var moveToDescriptions = {
		eol: "end of line",
		bol: "beginning of line",
		eolhard: "hard end of line",
		bolhard: "hard beginning of line",
		bof: "beginning of file",
		eof: "end of file",
	};
	moveTo.description = function(args) {
		var position = moveToDescriptions[args.position] || "unknown position";
		var extend = args.extend ? "Extend" : "Move";
		return extend + " selection to " + position + ".";
	};

	return {
		move: move,
		move_to: moveTo,
	};
}

var keymap = [
	//move
	{keys:["right"], command:"move", args:{mode:"characters", forward:true}},
	{keys:["left"], command:"move", args:{mode:"characters", forward:false}},
	{keys:["down"], command:"move", args:{mode:"lines", forward:true}},
	{keys:["up"], command:"move", args:{mode:"lines", forward:false}},
	{keys:["ctrl+right"], command:"move", args:{mode:"words", forward:true}},
	{keys:["ctrl+left"], command:"move", args:{mode:"words", forward:false}},
	//extend move
	{keys:["shift+right"], command:"move", args:{mode:"characters", forward:true, extend:true}},
	{keys:["shift+left"], command:"move", args:{mode:"characters", forward:false, extend:true}},
	{keys:["shift+down"], command:"move", args:{mode:"lines", forward:true, extend:true}},
	{keys:["shift+up"], command:"move", args:{mode:"lines", forward:false, extend:true}},
	{keys:["ctrl+shift+right"], command:"move", args:{mode:"words", forward:true, extend:true}},
	{keys:["ctrl+shift+left"], command:"move", args:{mode:"words", forward:false, extend:true}},
	//move to
	{keys:["home"], command:"move_to", args:{position:"bol"}},
	{keys:["ctrl+home"], command:"move_to", args:{position:"bof"}},
	{keys:["shift+home"], command:"move_to", args:{position:"bol", extend:true}},
	{keys:["end"], command:"move_to", args:{position:"eol"}},
	{keys:["ctrl+end"], command:"move_to", args:{position:"eof"}},
	{keys:["shift+end"], command:"move_to", args:{position:"eol", extend:true}},
];

module.exports = {
	commands: commands,
	keymap: keymap,
	//menu: [],
	//context_menu: [],
}