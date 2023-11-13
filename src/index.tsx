import * as React from 'react'
import ReactDOM from 'react-dom/client'

import 'prismjs/themes/prism.css'

import { library } from './utils/std-library'
import { DocumentOf, DocumentState } from './blocks/document'
import { BlockSelector, BlockSelectorState } from './blocks/block-selector'
import { Block } from './block/component'
import { getFullKey } from './ui/utils'
import { BlockRef } from './block'


const blocks = library.blocks

type ToplevelBlockState = DocumentState<BlockSelectorState>
const ToplevelBlock = DocumentOf(BlockSelector('', null, blocks.StateEditor(blocks), blocks))

const App = () => {
    const [toplevelState, setToplevelState] = React.useState<ToplevelBlockState>(ToplevelBlock.init)
    const toplevelBlockRef = React.useRef<BlockRef>()

    const safeUpdate = action => {
        setState(state => {
            try {
                return action(state)
        }
            catch (error) {
                setUpdateError(error)
                return state
            }
        })
    }

    const viewToplevelBlock = () => {
        return ToplevelBlock.view({
            state: state,
            update: safeUpdate,
            env: library,
        })
    }

    return (
        <Block
            state={toplevelState}
            update={setToplevelState}
            block={ToplevelBlock}
            env={library}
            blockRef={toplevelBlockRef}
            />
    )
}

const root = ReactDOM.createRoot(document.getElementById('app'))
root.render(<App />)