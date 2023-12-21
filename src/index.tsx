import * as React from 'react'
import ReactDOM from 'react-dom/client'

import 'prismjs/themes/prism.css'

import { library } from './utils/std-library'
import { DocumentOf, DocumentState } from './blocks/document'
import { BlockSelector, BlockSelectorState } from './blocks/block-selector'
import { Block } from './block/component'
import { getFullKey } from './ui/shortcuts'
import { BlockRef } from './block'


const blocks = library.blocks

type ToplevelBlockState = DocumentState<BlockSelectorState>
const ToplevelBlock = DocumentOf(BlockSelector('', null, blocks))



function App() {
    const [toplevelState, setToplevelState] = React.useState<ToplevelBlockState>(ToplevelBlock.init)
    const toplevelBlockRef = React.useRef<BlockRef>()

    React.useEffect(() => {
        loadInitJson().then(json => {
            if (json !== undefined) {
                setToplevelState(ToplevelBlock.fromJSON(json, setToplevelState, library))
            }
        })
    }, [])

    // Handlers to keep focus on the app
    React.useEffect(() => {
        function fixFocus() {
            if (!rootElement.contains(document.activeElement)) {
                toplevelBlockRef.current?.focus()
            }
        }

        // keep the focus on the toplevel block, so its KeyEventHandlers keep working
        function onFocusout(event: FocusEvent) {
            // this could be problematic, but let's wait until problems arise
            if (event.relatedTarget === null || event.relatedTarget instanceof Element && !rootElement.contains(event.relatedTarget)) {
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

        toplevelBlockRef.current?.focus()
        document.addEventListener('keydown', onKeyDown)
        rootElement.addEventListener('focusout', onFocusout)
        const timeout = setInterval(fixFocus, 100)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            rootElement.removeEventListener('focusout', onFocusout)
            clearInterval(timeout)
        }
    }, [])

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


async function loadInitJson() {
    const loadParam = new URLSearchParams(document.location.search).get('load')
    if (loadParam === null) {
        return undefined
    }

    try {
        const response = await fetch(loadParam)
        const content = await response.json()
        return content
    }
    catch (e) {
        window.alert(`Could not load file from URL: ${e}`)
        return undefined
    }
}


const rootElement = document.getElementById('app')
const root = ReactDOM.createRoot(rootElement)
root.render(<App />)