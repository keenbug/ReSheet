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

function App() {
    const [toplevelState, setToplevelState] = React.useState<ToplevelBlockState>(ToplevelBlock.init)
    const toplevelBlockRef = React.useRef<BlockRef>()

    React.useEffect(() => {
        toplevelBlockRef.current?.focus()
        document.addEventListener('keydown', onKeyDown)
        rootElement.addEventListener('focusout', onFocusout)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            rootElement.removeEventListener('focusout', onFocusout)
        }
    }, [])

    // keep the focus on the toplevel block, so its KeyEventHandlers keep working
    function onFocusout(event: FocusEvent) {
        // this could be problematic, but let's wait until problems arise
        if (!(event.relatedTarget instanceof Element) || !rootElement.contains(event.relatedTarget)) {
            toplevelBlockRef.current?.focus()
        }
    }

    function onKeyDown(event: KeyboardEvent) {
        switch (getFullKey(event)) {
            case 'Enter':
                if (document.activeElement === document.body) {
                    toplevelBlockRef.current?.focus()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case 'Escape':
                // don't exit full-screen in Safari
                //   I hope nobody really wants this. Personally, this annoys me all the time.
                //   So I prevent it until somebody complains.
                event.preventDefault()
                return
        }
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

const rootElement = document.getElementById('app')
const root = ReactDOM.createRoot(rootElement)
root.render(<App />)