slate
=====

Document editor based on operational transforms of attributed strings

npm run dev

npm test -- run tests

## TODO

* [ ] Undo manager as a plugin
* [ ] Qube separate from editor
* [ ] Zoom is an overlay (wrapper)
* [ ] Imports don't exist (how do we do what they do now)
      Probably imports back as part of the language
* [ ] Data cache

# Encryption

Add encrypted section. Generates key which it uses to encrypt the section and then encrypts that with your password based key.

Where should we store the keys? Document object. Server sid

  (encrypted (key "salt" "vhash", "encrypted key") ... encrypted data ...)

  (encrypted (keys {pubid:..., key:encrypted key}) (encd nonce ... encrypted ops ...) (encd nonce ) ...)

  server side we store a users public key and encrypted private key (which we only share with them) ... this way we can separate this out...

# IDEAS

(probably need columns --- before the rows in a table)

* IDEA: lens/scratch sidebar. Show calculations pulled out to the side and how they change
  when you change the model.

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



