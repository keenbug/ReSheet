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
import * as core from '@tables/core'
import * as core_multiple from '@tables/core/multiple'
// blocks
import * as blocks from '@tables/blocks'
import * as blocks_component from '@tables/blocks/component'
import * as blocks_blockSelector from '@tables/blocks/block-selector'
import * as blocks_jsexpr from '@tables/blocks/js'
import * as blocks_note from '@tables/blocks/note'
import * as blocks_note_note from '@tables/blocks/note/note'
import * as blocks_sheet from '@tables/blocks/sheet'
import * as blocks_document from '@tables/blocks/document'
import * as blocks_logic_compute from '@tables/code/compute'
// blocks utils
import * as blocks_utils_ui from '@tables/blocks/utils/ui'
import * as blocks_utils_value from '@tables/code/value'
import * as blocks_utils_shortcuts from '@tables/util/shortcuts'
// code-editor
import * as blocks_codeEditor from '@tables/code/editor'
import * as blocks_codeEditor_useEditable from '@tables/code/useEditable'
// utils
import * as util from '@tables/util'
// docs
import docs from '@tables/docs'
import * as docs_external from '@tables/docs/external'
import * as docs_external_mdn from '@tables/docs/external/mdn'
import docs_external_mdn_jsGlobalObjects from '@tables/docs/external/mdn/js-global-objects'
import * as blocks_docs from '@tables/blocks/docs'

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
    useEditable: blocks_codeEditor_useEditable,
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
        block: core,

        core: {
            index: core,
            multiple: core_multiple,
        },
        blocks: {
            component: blocks_component,
            blockSelector: blocks_blockSelector,
            compute: blocks_logic_compute,
            sheet: blocks_sheet,
            document: blocks_document,
            jsexpr: blocks_jsexpr,
            note: {
                index: blocks_note,
                note: blocks_note_note,
            },
            logic: {
                compute: blocks_logic_compute,
            },
            codeEditor: blocks_codeEditor,
            utils: {
                utils: blocks_utils_ui,
                value: blocks_utils_value,
                shortcuts: blocks_utils_shortcuts,
            },
            docs: blocks_docs,
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
        util: util,
    }
}