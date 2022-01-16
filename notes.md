# Motivation

Something like Notion, but local (not cloud) and more flexible (customizable through/in code).


# Ideas

- There are cells, describing a "unit" of data (corresponding to cells in excel or lines/whatever in notion)
    - every cell can be switched between 3 different states:
        - view: display the user data (e.g. a paragraph of text)
        - edit: change user data (e.g. a paragraph of text in a small text editor)
        - code: change the underlying code
    - a cell consists of
        - data: the user (editable) data
        - code: determining the cells behaviour and view in the view and edit state
        - (interactive state: volatile state that is not persisted and can be lost because of user actions. Only used for the UI. Does not contain data the user explicitly wants to persist)
    - cells can be nested in cells


# Steps

- [x] Clean up Code
    - [x] simplify tables.fieldTypes: assume always recordFields as field
    - [x] Add module for libraries/imports that should be made available in the REPL env (~globals)
    - [x] Rename Stateful to App, rename props state => data, onUpdate => setData
- [x] App data/state initialization
- [x] Test if you can theme sub-elements with styled-components (~ `styled.div'& h1 { font-size: ... }'`)
    * Yes, but styled-components complains about dynamic creation of a styled component (during every evaluation)
        => leads to rerenders with less performance, but that's expected with the evaluation
- [x] Insert Code Block before
- [x] Properly transpile expressions
- [x] Work on Spreadsheets
    - [x] Easier columns API
    - [x] Bug: Cells not editable (anymore)
- [x] improve performance
    - [x] Precompute expressions and cache results
- [ ] Bug: Moving computation of the expressions into a cache broke multiple things
    1. Errors in the Component Tree won't be handled by the corresponding REPL Line('s ErrorBoundary)
    2. The initial (after the page load) computation takes place in the initialization of a useState Hook for the code state. After that, computations are triggered during an update. That scrambles up the order (and presence) of Hooks.
    * Ideas
        * Always createElement the results (to encapsulate hooks in there). Problem: I need the raw values to put them in the environment and give access to them in other expressions.
- [ ] REPL: Always add variable names
- [ ] Work on Spreadsheets
    - [ ] Simpler columns definition
    - [ ] Add focus (edit -> focus + isEditing)
    - [ ] Add "global" edit line (like excel)


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
    - [ ] Always add variable names
    - [ ] Make state of StateEditor (un)linkable => either always sync state, or only when explicitly saving
    - [ ] Add backup states / undo history
* Work on Tables/Spreadsheets again
    * Use REPL to change available columns
        * Step-by-step: Improve columns Definition
            * Simpler columns definition
            * Add focus (edit -> focus + isEditing)
            * Add "global" edit line (like excel)

# Future

* Style-/Theme-Editor?
    * Customizable CSS, always under a specific new class, divisible into sections and with live example html preview
* Change (Context) Menus to "Commander Prompts"
    * Mixture of Sublime's/Atom's/VSCode's "Command Palette", Notion's Context Menus/Commands and iOS's long press "Context Menu"s/Previews
* REPL
    * Add completion: Special input (rather search), searches env and can select properties
    * console-feed?
    * Addable dependencies?
        * Transpile with Babel?
        * Bundle? Every Lib needs to be specially bundled?
            * Can npm/yarn be executed in the browser?

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
react-inspector - https://www.npmjs.com/package/react-inspector
CodeJar
PrismJS
ReactJS


# Interesting Technologies

Kaboom - fast & fun JS game programming library
https://kaboomjs.com
