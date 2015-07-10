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
* [ ] FIX: Selection unstable under selection spans
* [X] FIX: Selection fails in code
* [X] Multiple selection
* [ ] Minimal selection update check
* [X] Keyboard shortcut system *** 
* [ ] Table editor actions
* [ ] Hookup Qube
* [ ] Render out of date code (i.e. not yet calculated)
* [ ] Copy/Cut (inc table)
* [ ] Paste (inc table)
* [ ] Scroll to cursor
* [ ] Movement commands
* [ ] Delete commands

* [ ] discard nop in livedb caused by _apply exception returning same doc.

* [ ] eraseText(region) on doc
* [ ] Replace should balance missing closes by inserting after your insert.
      and missing opens by inserting before your insert. (or just collapse the
      selection like Google Docs)

# IDEA

QUBE integration. Have an output table format that is a table where the expressions
you type get evaluated and you get an output. If it varies over multiple dimensions then they become pivot slices. This is then an output table that is formatted like an input table. Entered like a table but evaluates like a pivot table output.

You should even be able to put something down the side to varie it over ...

(probably need columns --- before the rows in a table)


## Bugs

* List items should nest inside other items not at the list level..

* Selection transform bug when overtyping with mulitple selections.

* cannot delete a boundary over list items (with double indent) or tables. (Note, should delete whole table.)

* replace should adjust selection first.

* Double character insert under some conditions (seems to be caused by critical regions)

* Fast >(space) doesn't trigger key combination.

//TODO: make shouldComponentUpdate part of the friar class so that it can return false if only the selection has changed.


## Long term todo

* [ ] Add bidirectional support.
      Look at how codemirror supports this in their selections.



