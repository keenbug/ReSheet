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
import lodash from 'lodash'

import * as babel_core from '@babel/core'
import babel_react from '@babel/preset-react'
import * as babel_parser from '@babel/parser'
import * as babel_generator from '@babel/generator'
import babel_traverse from '@babel/traverse'
import * as babel_types from '@babel/types'

// --- Internal ---
// core
import * as core_block from '@resheet/core/block'
import * as core_multiple from '@resheet/core/multiple'
// code
import * as code_completions from '@resheet/code/completions'
import * as code_compute from '@resheet/code/compute'
import * as code_editor from '@resheet/code/editor'
import * as code_result from '@resheet/code/result'
import * as code_theme from '@resheet/code/theme'
import * as code_ui from '@resheet/code/ui'
import * as code_useEditable from '@resheet/code/useEditable'
import * as code_value from '@resheet/code/value'
// blocks
import * as blocks from '@resheet/blocks'
import * as blocks_component from '@resheet/blocks/component'
import * as blocks_debug from '@resheet/blocks/component'
import * as blocks_blockSelector from '@resheet/blocks/block-selector'
import * as blocks_jsexpr from '@resheet/blocks/js'
import * as blocks_note from '@resheet/blocks/note'
import * as blocks_note_note from '@resheet/blocks/note/note'
import * as blocks_sheet from '@resheet/blocks/sheet'
import * as blocks_document from '@resheet/blocks/document'
import * as blocks_document_pages from '@resheet/blocks/document/pages'
import * as blocks_loadFile from '@resheet/blocks/load-file'
import * as blocks_logic_compute from '@resheet/code/compute'
// blocks utils
import * as blocks_utils_ui from '@resheet/blocks/utils/ui'
import * as blocks_utils_value from '@resheet/code/value'
import * as blocks_utils_shortcuts from '@resheet/util/shortcuts'
// code-editor
import * as blocks_codeEditor from '@resheet/code/editor'
import * as blocks_codeEditor_useEditable from '@resheet/code/useEditable'
// utils
import * as util_index from '@resheet/util'
import * as util_hooks from '@resheet/util/hooks'
import * as util_dispatch from '@resheet/util/dispatch'
import * as util_search from '@resheet/util/search'
import * as util_serialize from '@resheet/util/serialize'
import * as util_shortcuts from '@resheet/util/shortcuts'
import * as util_validate from '@resheet/util/validate'
// docs
import docs from '@resheet/docs'
import * as docs_external from '@resheet/docs/external'
import * as docs_external_mdn from '@resheet/docs/external/mdn'
import docs_external_mdn_jsGlobalObjects from '@resheet/docs/external/mdn/js-global-objects'
import * as blocks_docs from '@resheet/blocks/docs'

const resheet = {
    assets: {
        logoTypeSvg: new URL('../../assets/images/logotype.svg', import.meta.url),
        logoSvg: new URL('../../assets/images/logo.svg', import.meta.url),
        logoPng: new URL('../../assets/images/logo.png', import.meta.url),
        demoGif: new URL('../../assets/video/demo.gif', import.meta.url),
    },
    core: {
        block: core_block,
        multiple: core_multiple,
    },
    code: {
        completions: code_completions,
        compute: code_compute,
        editor: code_editor,
        result: code_result,
        theme: code_theme,
        ui: code_ui,
        useEditable: code_useEditable,
        value: code_value,
    },
    blocks: {
        component: blocks_component,
        debug: blocks_debug,
        blockSelector: blocks_blockSelector,
        compute: blocks_logic_compute,
        sheet: blocks_sheet,
        document: {
            index: blocks_document,
            pages: blocks_document_pages,
        },
        jsexpr: blocks_jsexpr,
        note: {
            index: blocks_note,
            note: blocks_note_note,
        },
        loadFile: blocks_loadFile,
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
    util: {
        index: util_index,
        hooks: util_hooks,
        dispatch: util_dispatch,
        search: util_search,
        serialize: util_serialize,
        shortcuts: util_shortcuts,
        validate: util_validate,
    }
}

export const library = {
    library: {},

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
    lodash,

    babel: {
        core: babel_core,
        react: babel_react,
        parser: babel_parser,
        generator: babel_generator,
        traverse: babel_traverse,
        types: babel_types,
    },

    blocks,
    ...blocks,

    tables: resheet, /* for compatibility */
    resheet,
}

library.library = library