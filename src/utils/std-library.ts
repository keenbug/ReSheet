import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as ReactDomServer from 'react-dom/server'
import styled from 'styled-components'
import * as headlessui from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as faSolid from '@fortawesome/free-solid-svg-icons'
import * as faRegular from '@fortawesome/free-regular-svg-icons'
import * as reactInspector from 'react-inspector'

import * as immutable from 'immutable'

import * as babelCore from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import * as babelGenerator from '@babel/generator'
import babelTraverse from '@babel/traverse'
import * as babelTypes from '@babel/types'

import * as block from '../block'
import * as multiple from '../block/multiple'
import * as blockComponent from '../block/component'

import * as blocks from '../blocks'
import * as blockSelector from '../blocks/block-selector'
import * as jsexpr from '../blocks/jsexpr'
import * as sheet from '../blocks/sheet'
import * as document from '../blocks/document'

import * as compute from '../logic/compute'

import * as ui from '../ui/utils'
import * as codeEditor from '../ui/code-editor'
import * as value from '../ui/value'
import * as shortcuts from '../ui/shortcuts'

import * as utils from '.'

export const LIBRARY_MAPPINGS = {
    "react":                                React,
    "@headlessui/react":                    headlessui,
    "@fortawesome/react-fontawesome":       { FontAwesomeIcon },
    "@fortawesome/free-solid-svg-icons":    faSolid,
    "@fortawesome/free-regular-svg-icons":  faRegular,
    "react-inspector":                      reactInspector,
    "@babel/core":                          babelCore,
    "@babel/preset-react":                  babelReact,
    "@babel/parser":                        babelParser,
    "@babel/generator":                     babelGenerator,
    "./blocks":                             blocks,
    "./blocks/block-selector":              blockSelector,
    "./blocks/sheet":                       sheet,
    "./blocks/jsexpr":                      jsexpr,
    "./logic/block":                        block,
    "./logic/compute":                      compute,
    "./ui/code-editor":                     codeEditor,
    "./ui/utils":                           ui,
    "./ui/value":                           value,
    "./utils":                              utils,
}


export const $import = lib => LIBRARY_MAPPINGS[lib]


export const library = {
    $LIBRARY_MAPPINGS: LIBRARY_MAPPINGS,
    $import,
    $library() { return library },

    React,
    ReactDom,
    ReactDomServer,
    FontAwesomeIcon,
    faSolid,
    faRegular,
    styled,
    headlessui,

    immutable,

    babel: {
        core: babelCore,
        react: babelReact,
        parser: babelParser,
        generator: babelGenerator,
        traverse: babelTraverse,
        types: babelTypes,
    },

    blocks,

    tables: {
        block,
        multiple,
        blockComponent,
        ui: {
            utils: ui,
            value,
            codeEditor,
            shortcuts,
        },
        blocks: {
            blockSelector,
            compute,
            sheet,
            document,
            jsexpr,
        },
        logic: {
            block,
            compute,
        },
        utils,
    }
}

export default { $stdLibrary: library, $import, React }