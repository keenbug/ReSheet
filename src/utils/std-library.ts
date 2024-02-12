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

import * as babel_core from '@babel/core'
import babel_react from '@babel/preset-react'
import * as babel_parser from '@babel/parser'
import * as babel_generator from '@babel/generator'
import babel_traverse from '@babel/traverse'
import * as babel_types from '@babel/types'

// --- Internal ---
// block
import * as block from '../block'
import * as multiple from '../block/multiple'
import * as block_component from '../block/component'
// blocks
import * as blocks from '../blocks'
import * as blocks_blockSelector from '../blocks/block-selector'
import * as blocks_jsexpr from '../blocks/jsexpr'
import * as blocks_note from '../blocks/note'
import * as blocks_note_note from '../blocks/note/note'
import * as blocks_sheet from '../blocks/sheet'
import * as blocks_document from '../blocks/document'
// logic
import * as logic_compute from '../logic/compute'
// ui
import * as ui_utils from '../ui/utils'
import * as ui_value from '../ui/value'
import * as ui_shortcuts from '../ui/shortcuts'
// code-editor
import * as codeEditor from '../code-editor'
import * as codeEditor_useEditable from '../code-editor/useEditable'
// utils
import * as utils from '.'
// docs
import * as docs from '../docs'
import * as docs_external from '../docs/external'
import * as docs_external_mdn from '../docs/external/mdn'
import docs_external_mdn_jsGlobalObjects from '../docs/external/mdn/js-global-objects'

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
    useEditable: codeEditor_useEditable,
    prismReactRenderer,
    reactInspector,

    immutable,

    babel: {
        core: babel_core,
        react: babel_react,
        parser: babel_parser,
        generator: babel_generator,
        traverse: babel_traverse,
        types: babel_types,
    },

    blocks,

    tables: {
        block,
        multiple,
        blockComponent: block_component,
        ui: {
            utils: ui_utils,
            value: ui_value,
            shortcuts: ui_shortcuts,
        },
        codeEditor,
        blocks: {
            blockSelector: blocks_blockSelector,
            compute: logic_compute,
            sheet: blocks_sheet,
            document: blocks_document,
            jsexpr: blocks_jsexpr,
            note: {
                index: blocks_note,
                note: blocks_note_note,
            },
        },
        logic: {
            block,
            compute: logic_compute,
        },
        docs: {
            index: docs,
            external: {
                index: docs_external,
                mdn: {
                    index: docs_external_mdn,
                    jsGlobalObjects: docs_external_mdn_jsGlobalObjects,
                },
            },
        },
        utils,
    }
}