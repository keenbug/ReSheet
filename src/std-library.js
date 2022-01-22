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

import * as repl from './repl'
import * as codeEditor from './code-editor'
import * as value from './value'
import * as tables from './tables'
import * as blocks from './blocks'
import * as ui from './ui'
import * as utils from './utils'

export const LIBRARY_MAPPINGS = {
    "react":                                `$stdLibrary.React`,
    "@headlessui/react":                    `$stdLibrary.headlessui`,
    "@fortawesome/react-fontawesome":       `{ FontAwesomeIcon: $stdLibrary.FontAwesomeIcon }`,
    "@fortawesome/free-solid-svg-icons":    `$stdLibrary.faSolid`,
    "@fortawesome/free-regular-svg-icons":  `$stdLibrary.faRegular`,
    "@babel/core":                          `$stdLibrary.babel.core`,
    "@babel/preset-react":                  `$stdLibrary.babel.react`,
    "@babel/parser":                        `$stdLibrary.babel.parser`,
    "@babel/generator":                     `$stdLibrary.babel.generator`,
    "./repl":                               `$stdLibrary.repl`,
    "./code-editor":                        `$stdLibrary.codeEditor`,
    "./value":                              `$stdLibrary.value`,
    "./tables":                             `$stdLibrary.tables`,
    "./blocks":                             `$stdLibrary.blocks`,
    "./ui":                                 `$stdLibrary.ui`,
    "./utils":                              `$stdLibrary.utils`,
}


export const library = {
    $LIBRARY_MAPPINGS: LIBRARY_MAPPINGS,

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

export default { $stdLibrary: library, React }