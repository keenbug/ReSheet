import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled, { css } from 'styled-components'

import { interpolate } from './utils'



export const onMetaEnter = func => event => {
    if (event.key === 'Enter' && event.metaKey) {
        event.preventDefault()
        func(event)
    }
}



export const classed = elem => (strings, ...interpolations) =>
    React.forwardRef((props, ref) =>
        React.createElement(
            elem,
            {
                ...props,
                ref,
                className: `${interpolate(strings, interpolations, props)} ${props.className ?? ""}`,
            }
        )
    )




const TextInputHTML = styled.span`
    ${({ placeholder }) =>
        placeholder ?
            css`
                & :empty :after {
                    content: "${placeholder}";
                    color: #aaa;
                }
            `
        :
            ''
    }
`

export const TextInput = ({ value, onUpdate, ...props }) => {
    const ref = React.useRef(null)
    React.useLayoutEffect(() => {
        if (ref.current.innerText !== value) {
            ref.current.innerText = value
        }
    })
    const onInput = event => {
        const { innerText, innerHTML } = event.target
        const text = String(innerText)
        const html = String(innerHTML).replaceAll("&nbsp;", " ")
        if (html !== text) {
            event.target.innerHTML = innerText
        }
        onUpdate(text)
    }
    return <TextInputHTML contentEditable ref={ref} onInput={onInput} {...props} />
}




export const ToggleButton = classed('button')`
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

export const IconToggleButton = ({ className, isActive, icon, iconDisabled, onUpdate, label="" }) => (
    <ToggleButton
        className={(className ?? "") + (isActive ? "" : " text-slate-400")}
        onClick={onUpdate}
    >
        <div className="inline-block w-5 text-center">
            <FontAwesomeIcon size="xs" icon={isActive ? icon : (iconDisabled || icon)} />
        </div>
        {label && <span>{label}</span>}
    </ToggleButton>
)
