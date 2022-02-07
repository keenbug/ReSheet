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

import * as blocks from '../blocks/blocks'
import * as codeEditor from '../ui/code-editor'
import * as command from '../blocks/command'
import * as components from '../logic/components'
import * as compute from '../logic/compute'
import * as fcObject from '../logic/fc-object'
import * as importExport from '../logic/import-export'
import * as jsexpr from '../blocks/jsexpr'
import * as sheet from '../blocks/sheet'
import * as tables from './tables'
import * as ui from '../ui/utils'
import * as utils from '../utils'
import * as value from '../ui/value'

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
    "./blocks/blocks":                      blocks,
    "./blocks/command":                     command,
    "./blocks/sheet":                       sheet,
    "./blocks/jsexpr":                      jsexpr,
    "./logic/components":                   components,
    "./logic/compute":                      compute,
    "./logic/fc-object":                    fcObject,
    "./logic/import-export":                importExport,
    "./ui/code-editor":                     codeEditor,
    "./ui/utils":                           ui,
    "./ui/value":                           value,
    "./utils":                              utils,
    "./utils/tables":                       tables,
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
    command,
    sheet,
    jsexpr,
    codeEditor,
    value,
    utils,
}

export default { $stdLibrary: library, $import, React }