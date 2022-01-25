import React from 'react'
import styled from 'styled-components'
import * as headlessui from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as faSolid from '@fortawesome/free-solid-svg-icons'
import * as faRegular from '@fortawesome/free-regular-svg-icons'

import * as babelCore from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import * as babelGenerator from '@babel/generator'

import * as blocks from './blocks'
import * as codeEditor from './code-editor'
import * as command from './command'
import * as components from './components'
import * as compute from './compute'
import * as fcObject from './fc-object'
import * as importExport from './import-export'
import * as repl from './repl'
import * as tables from './tables'
import * as ui from './ui'
import * as utils from './utils'
import * as value from './value'

export const LIBRARY_MAPPINGS = {
    "react":                                React,
    "@headlessui/react":                    headlessui,
    "@fortawesome/react-fontawesome":       { FontAwesomeIcon },
    "@fortawesome/free-solid-svg-icons":    faSolid,
    "@fortawesome/free-regular-svg-icons":  faRegular,
    "@babel/core":                          babelCore,
    "@babel/preset-react":                  babelReact,
    "@babel/parser":                        babelParser,
    "@babel/generator":                     babelGenerator,
    "./blocks":                             blocks,
    "./code-editor":                        codeEditor,
    "./command":                            command,
    "./components":                         components,
    "./compute":                            compute,
    "./fc-object":                          fcObject,
    "./import-export":                      importExport,
    "./repl":                               repl,
    "./tables":                             tables,
    "./ui":                                 ui,
    "./utils":                              utils,
    "./value":                              value,
}


export const $import = lib => LIBRARY_MAPPINGS[lib]


export const library = {
    $LIBRARY_MAPPINGS: LIBRARY_MAPPINGS,
    $import,

    React,
    FontAwesomeIcon,
    faSolid,
    faRegular,
    styled,
    headlessui,

    babel: {
        core: babelCore,
        react: babelReact,
        parser: babelParser,
        generator: babelGenerator,
    },

    blocks,
    tables,
    ui,
    repl,
    codeEditor,
    Block: value.createBlock,
    value,
    utils,
}

export default { $stdLibrary: library, $import, React }