import { SheetOf } from './sheet'
import { BlockSelector } from './block-selector'
import { JSExpr } from './js'
import { DocumentOf } from './document'
import { Note } from './note'

export { JSExpr as Code, JSExpr, BlockSelector, SheetOf, DocumentOf, Note }

export const Selector = blocks => BlockSelector('Note', Note, blocks)
export const Sheet = blocks => SheetOf(Selector(blocks))

export * from './load-file'
export * as Debug from './debug'
export * as Util from './util'