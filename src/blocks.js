import { classed, LoadFileButton } from "./ui"
import { createBlock } from "./value"

export const LoadFileButtonStyled = classed(LoadFileButton)`
    cursor-pointer
    p-1
    rounded
    font-gray-700
    bg-gray-100
    hover:bg-gray-200
`

export const LoadFileBlock = createBlock(
    ({ data, setData }) => (
        <LoadFileButtonStyled
            onLoad={file => file.text().then(setData)}
        >
            Load File
        </LoadFileButtonStyled>
    )
)