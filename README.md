slate
=====

Document editor based on operational transforms of attributed strings


gulp -- opens in browser

npm test -- run tests

## TODO

* [X] S-Expression document renderer
* [X] Inline selection renderer
* [X] FIX: Selection off by one error
* [X] FIX: Selection fails outside lines
* [X] FIX: Selection unstable under selection spans
* [X] FIX: Selection fails in code
* [X] Multiple selection
* [ ] Minimal selection update check
* [X] Keyboard shortcut system *** 
* [ ] Table editor actions
* [ ] Hookup Qube
* [ ] Render out of date code (i.e. not yet calculated)
* [ ] Copy/Cut (inc table)
* [ ] Paste (inc table)
* [X] Scroll to cursor
* [X] Movement commands
* [X] Delete commands
* [ ] Attribute on paragraphs (??? how should it deal with tables
	  - attribute if in vs attribute only if fully selected.)

* [ ] discard nop in livedb caused by _apply exception returning same doc.

* [X] eraseText(region) on doc //just a replaceText with ""
* [ ] Replace should balance missing closes by inserting after your insert.
      and missing opens by inserting before your insert. (or just collapse the
      selection like Google Docs)

# IDEA

QUBE integration. Have an output table format that is a table where the expressions
you type get evaluated and you get an output. If it varies over multiple dimensions then they become pivot slices. This is then an output table that is formatted like an input table. Entered like a table but evaluates like a pivot table output.

You should even be able to put something down the side to varie it over ...

(probably need columns --- before the rows in a table)

* IDEA: lens/scratch sidebar. Show calculations pulled out to the side and how they change
  when you change the model.


## Bugs

* List items should nest inside other items not at the list level..

* Selection transform bug when overtyping with mulitple selections.

* line up doesn't work from after a freshly created section break.
   or TO or FROM a new line

* cannot delete a boundary over list items (with double indent) or tables. (Note, should delete whole table.)

* replace should adjust selection first.

* Double character insert under some conditions (seems to be caused by critical regions)

* Fast >(space) doesn't trigger key combination.

//TODO: make shouldComponentUpdate part of the friar class so that it can return false if only the selection has changed.


## Long term todo

* [ ] Add bidirectional support.
      Look at how codemirror supports this in their selections.



