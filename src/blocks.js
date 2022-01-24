import React from 'react'
import { runExpr } from './repl'
import { BlockRunner, createBlock, initialBlockState, isBlock, ValueInspector } from './value'
import { EditableCode, highlightNothing } from './code-editor'
import { classed, LoadFileButton } from './ui'
import { runUpdate, updateArray } from './utils'
import stdLibrary from './std-library'
import { computeExpr } from './compute'

export const ResetBlock = innerBlock => createBlock(
    ({ data, setData }) => (
        <div>
            <button onClick={() => setData(initialBlockState)}>Reset</button>
            {innerBlock && <BlockRunner state={data} setState={setData} block={innerBlock} />}
        </div>
    ),
    innerBlock ? innerBlock.initialData : initialBlockState,
)

export const InputBlock = createBlock(
    ({ data, setData }) => {
        const onChange = event => { setData(event.target.value) }
        return <input type="text" value={data} onChange={onChange} />
    },
    "",
)

export const LoadFileButtonStyled = classed(LoadFileButton)`
    cursor-pointer
    p-1
    rounded
    font-gray-700
    bg-gray-100
    hover:bg-gray-200
`

export const LoadFileBlock = createBlock(
    ({ setData }) => (
        <LoadFileButtonStyled
            onLoad={file => file.text().then(setData)}
        >
            Load File
        </LoadFileButtonStyled>
    )
)

export const BlockContainerBlock = children => createBlock(
    ({ data, setData }) => <BlockContainer data={data} setData={setData} children={children} />,
)

export const initialBlockContainerState = children =>
    children.map(child => isBlock(child) ? child.initialData : null)

export const BlockContainer = ({ data, setData, children, container = React.Fragment, ...props }) => {
    const childrenArray =
        Array.isArray(children) ?
            children
        : children ?
            [children]
        :
            []
    const initialState = initialBlockContainerState(childrenArray)
    const getState = state => (!state || state === initialBlockState) ? initialState : state
    const updateChild = idx => update => {
        setData(data =>
            updateArray(idx, runUpdate(update, getState(data)[idx]), getState(data))
        )
    }
    const executedChildren = childrenArray
        .map((child, idx) =>
            isBlock(child) ?
                <BlockRunner
                    block={child}
                    state={getState(data)[idx]}
                    setState={updateChild(idx)}
                />
            :
                child
        )
    return React.createElement(container, props, ...executedChildren)
}

export const TextBlock = (container = 'div') => createBlock(
    ({ data: { code, result }, setData }) => {
      const runText = code =>
        computeExpr(
          `<$TextBlockContainer>${code}</$TextBlockContainer>`,
          { ...stdLibrary, $TextBlockContainer: container },
        )
      const setCode = code => {
        setData({ code, result: runText(code) })
      }
      return (
        <React.Fragment>
          <EditableCode
            code={code}
            onUpdate={setCode}
            highlight={highlightNothing}
          />
          <ValueInspector value={result} />
        </React.Fragment>
      )
    },
    { code: "", result: null },
  )
