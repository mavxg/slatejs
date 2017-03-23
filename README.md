slate
=====

Document editor based on operational transforms of attributed strings

npm run dev

npm test -- run tests

## TODO

What needs to be done to get to a block format (so we can support really large documents).

### Dummy tree object

* [ ] Tree.get(k, callback)
* [ ] Tree.set(k, value)
* [ ] Tree.subscribe(k, callback)
* [ ] Tree.unsubscribe(k, callback)
* [ ] Tree.subscribe(callback) -- subscribe all key changes
* [ ] Tree.unsubscribe(callback)

Note: if a subscription throws an exception it gets unsubscribed.

### Real block backed tree object (key value store of blocks - encrypted?)

* [ ] Dummy block store
* [ ] Real block backed tree object

# Encryption

Encryption should be at the block level. Much simpler to reason about.

# IDEAS

(probably need columns --- before the rows in a table)

* IDEA: lens/scratch sidebar. Show calculations pulled out to the side and how they change
  when you change the model.

### Constraints based system

Example: Sketchpad - constraints like these lines are parallel or this point is coincident with this point. Really cool in Sketchpad is the idea that the line segment is just a start and end point constrained on an infinite line so you can draw an arc to that line even if that line doesn't extend to the radius of the arc.

### Dependent dimensions

  dimensions: [{name:A, items:[...]},{name:B, items:[...]},{name:C, items:[...]}],
  dependencies: [{dimensions:[A,B], tuples:[[a_i,b_i],...]}],
  values: [...], //length = dim(C) * length of tuples in dependencies

This assumes that you are mostly sparse. It would be a good way to store things in Qube also since most of the code would not need to care about the dependencies. Can also have 3 way/n way dependencies.

### Prefix slice

  //map((a) -> a[P], {A,B,C}) -- provided [P] doesn't change dimensions.

  [P]{A,B,C} === {A[P],B[P],C[P]}

## Bugs

* Encryption squash breaks syncronisation (looks like the bug is in EncrypedContext.proto._onOp)

* x(space) breaks in encryption (e.g. *<space> to list item)

* Delete key at start of row causes row join

* Kerning changes when cursor is between kerned pairs. (Google docs solves this by not kerning text.)

* List items should nest inside other items not at the list level..

* Selection transform bug when overtyping with mulitple selections.

* line up doesn't work from after a freshly created section break.
   or TO or FROM a new line *** IMPORTANT

* cannot delete a boundary over list items (with double indent) or tables. (Note, should delete whole table.)

* replace should adjust selection first.

* Double character insert under some conditions (seems to be caused by critical regions)

* Fast >(space) doesn't trigger key combination.

//TODO: make shouldComponentUpdate part of the friar class so that it can return false if only the selection has changed.


## Long term todo

* [ ] Add bidirectional support.
      Look at how codemirror supports this in their selections.



