import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as ReactDomServer from 'react-dom/server'
import styled from 'styled-components'
import * as headlessui from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as faSolid from '@fortawesome/free-solid-svg-icons'
import * as faRegular from '@fortawesome/free-regular-svg-icons'
import * as reactInspector from 'react-inspector'
import * as prismReactRenderer from 'prism-react-renderer'

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
import * as note from '../blocks/note'
import * as notenote from '../blocks/note/note'
import * as sheet from '../blocks/sheet'
import * as document from '../blocks/document'

import * as compute from '../logic/compute'

import * as ui from '../ui/utils'
import * as codeEditor from '../code-editor'
import * as value from '../ui/value'
import * as shortcuts from '../ui/shortcuts'
import { useEditable } from '../code-editor/useEditable'

import * as utils from '.'

export const library = {
    $library() { return library },

    React,
    ReactDom,
    ReactDomServer,
    FontAwesomeIcon,
    faSolid,
    faRegular,
    styled,
    headlessui,
    useEditable,
    prismReactRenderer,
    reactInspector,

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
            shortcuts,
        },
        codeEditor,
        blocks: {
            blockSelector,
            compute,
            sheet,
            document,
            jsexpr,
            note: {
                index: note,
                note: notenote,
            },
        },
        logic: {
            block,
            compute,
        },
        utils,
    }
}