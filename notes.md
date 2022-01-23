# Motivation

Something like Notion, but local (not cloud) and more flexible (customizable through/in code).


# Ideas

- There are blocks, describing a "unit" of data (corresponding to cells in excel or lines/whatever in notion)
    - every block can be switched between 3 different states:
        - view: display the user data (e.g. a paragraph of text)
        - edit: change user data (e.g. a paragraph of text in a small text editor)
        - code: change the underlying code
    - a block consists of
        - data: the user (editable) data
        - code: determining the cells behaviour and view in the view and edit state
        - (interactive state: volatile state that is not persisted and can be lost because of user actions. Only used for the UI. Does not contain data the user explicitly wants to persist)
    - blocks can be nested in blocks
- At first, there is a "built-in" "Command Block", which selects which Block to use
    - Blocks:
        - Compute Block (JS, former REPL)
        - Sheet Block (List of Blocks, Layouting possibilities like in Notion)
        - Text Block (Parses Content as JSX)


# Steps

- [x] Refactor REPL Code stuff into custom entity-component pattern
    - Components:
        - Compute: { code, run(env) }
        - Cache: Compute -> { invalidated, cachedResult, run(env) }
        - Autorun: Compute, Cache -> { autorun, setCode(code) }
    - Entity: addComponent(entity, component) => { ...entity, ...component(entity) }
- [x] Refactor REPL Code into multiple files
- [ ] Rename to tables to Jotter? Then also rename Blocks to Jots?
- [ ] implement Command Block
    - [ ] Extend and Split REPL
        - [ ] Command Block
            - [ ] Add completion
        - [ ] Compute Block
            - former REPL


# Current

* Dynamic Tables
    - [x] Add dynamic columns (user code)
    * Save Table Data
    * Make Raw Data editable (JSON)
    * Make Raw Columns Editable
        * Maybe needs REPL for Dynamic Function Stuff?
* Styling
    - [x] How to style in React? (styled?)
        - yep
    - [ ] Style Table
    - [x] Style REPL
        * Done to a certain degree. Move on
    - [ ] Style Value Inspector: Theme? (search in docs)
    - [ ] Add CSS class(es) with nice default styles for HTML elements (h1, table, p, button, input, ...)
    * General
        - [ ] indicate active Tabs with bottom-border (like menu:{app,code,state} and state-editor:{json,code})
        - [ ] improve button discoverability (visual indicator for buttons)
        - [ ] improve differentiation of state editor (draw inspiration from inline js/html editors: JSFiddle etc)
* User REPL
    - [x] Make a big single-Code version
    - [x] Save Code
    - [x] Make it switchable in states: Code only, side-by-side, result only
    - [x] find out when a value is a React Component
        * Maybe subclass/instance of some React Class?
            * React.isValidElement(value)
    - [x] Make it multi-line:
        - [x] each line switchable
        - [x] can be saved in a variable
    - [x] Add local Definitions
    - [x] Make it a big single-Code version again
        - [x] Extend modes to be: live code, code, app, state
            - [x] add state to code
            - [x] change from modes to individual visibility toggles
            - [x] show app and code myself
    - [x] Clean up Code
    - [x] Add initial data field to Apps (formerly Statefuls) (default state to Symbol('uninitializedData'))
    - [x] Insert Code Block before instead of after when pressing Shift+Cmd+Enter
    - [x] Properly transpile JS Expressions (instead of Statements) with Babel
    - [x] Always add variable names
    - [ ] Make state of StateEditor (un)linkable => either always sync state, or only when explicitly saving
    - [x] Add Save/Load
    - [x] Make automatic code execution disable-able
    - [ ] Add backup states / undo history
* Cleanup
    - [/] use dangerouslySetInnerHTML in TextInput?
    - [x] Switch to useReducer for Code State
    - [/] Make Code a flat list instead of linking via prev?
    - [x] Merge cached result into Code again?
    - [x] headless-ui (e.g. for context menus)
* Fixes
    - [/] Bug: Repl run in Repl run in Repl ... run in the Repl has weird focusing behavior:
        - Grabs focus when editing elsewhere
        - Caret jumps to beginning when editing Code in the inner Repl
        - CodeJar throws errors
        - maybe updating code and recreating the dom and reconciliation is the problem
            - yep, fixed by not using anonymous functions as elements in createElement
            - but still having the recreation effect when generating the ReplApp in a function
                - timing bug? Is not consistent
                - NaN bug. (revision was not set)
        - is there a react reconciliation debugger? Something in React DevTools?
    - [ ] Try other Code Editor? Maybe CodeJar or react-codejar is the culprit? OTOH, there are still weird bugs that are definitely independent from the editor
* Work on Tables/Spreadsheets again
    * Use REPL to change available columns
        * Step-by-step: Improve columns Definition
            * Simpler columns definition
            * Add focus (edit -> focus + isEditing)
            * Add "global" edit line (like excel)

# Future

* Switch to TypeScript? Maybe TS could be run in the browser - has an API: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
* Style-/Theme-Editor?
    * Customizable CSS, always under a specific new class, divisible into sections and with live example html preview
* Change (Context) Menus to "Commander Prompts"
    * Mixture of Sublime's/Atom's/VSCode's "Command Palette", Notion's Context Menus/Commands and iOS's long press "Context Menu"s/Previews
* PWA
* REPL
    * Add completion: Special input (rather search), searches env and can select properties
    * console-feed?
    * Addable dependencies?
        * Transpile with Babel?
        * Bundle? Every Lib needs to be specially bundled?
            * Can npm/yarn be executed in the browser?
* Collaboration?
    * yJS
    * Messaging via Matrix?

* Other Code Editor?
    - monaco? (~VSCode) https://github.com/Microsoft/monaco-editor
    - CodeMirror? https://github.com/codemirror/CodeMirror
    

# Used Technologies

Babel - https://babeljs.io/docs/en/babel-core
        https://babeljs.io/docs/en/babel-parser
        https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md
Fontawesome - https://fontawesome.com/v5.15/icons?d=gallery
              https://fontawesome.com/v5.15/how-to-use/on-the-web/using-with/react
Tailwindcss - https://tailwindcss.com/docs/utility-first
              https://tailwindcomponents.com/cheatsheet/
headlessui - https://headlessui.dev
react-inspector - https://www.npmjs.com/package/react-inspector
CodeJar
PrismJS
ReactJS


# Interesting Technologies

Kaboom - fast & fun JS game programming library
https://kaboomjs.com
