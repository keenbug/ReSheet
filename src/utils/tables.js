import React from 'react'

/***************** Table Components *******************/

export const TableHeadRow = ({ columns }) => (
    <tr>
        {columns.map(column => (
            <th key={column.id}>{column.header}</th>
        ))}
    </tr>
)

export const TableBodyRow = ({ columns, row }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>{column.body(row)}</td>
        ))}
    </tr>
)

export const TableBody = ({ columns, data }) => (
    data.map(row => (
        <TableBodyRow key={row.id} columns={columns} row={row}/>
    ))
)

export const Table = ({ columns, data }) => (
    <table>
        <thead>
            <TableHeadRow columns={columns}/>
        </thead>
        <tbody>
            <TableBody columns={columns} data={data}/>
        </tbody>
    </table>
)

export const EditableTableBodyRow = ({ columns, row, onChange }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>
                {column.body(row, true, onChange)}
            </td>
        ))}
    </tr>
)

export const EditableTableBody = ({ columns, data, onChange }) => (
    data.map(row => (
        <EditableTableBodyRow
            key={row.id}
            columns={columns}
            row={row}
            onChange={onChange}
            />
    ))
)
    
export const EditableTable = ({ columns, data, onChange }) => (
    <table>
        <thead>
            <TableHeadRow columns={columns}/>
        </thead>
        <tbody>
            <EditableTableBody columns={columns} data={data} onChange={onChange}/>
        </tbody>
    </table>
)

const subRowUpdate = (id, update) => subUpdate => {
    update(data =>
        data.map(row =>
            row.id === id ? (
                typeof subUpdate === 'function' ?
                    subUpdate(row)
                :
                    subUpdate
            )
            : (
                row
            )
        )
    )
}

export const SingleEditableTableBodyRow = ({ columns, row, editedColumn, onEditColumn, onClose, onChange }) => (
    <tr>
        {columns.map(column => (
            <td
                key={column.id}
                onDoubleClick={event => {
                    event.preventDefault()
                    onEditColumn(column.id)
                }}
                onBlur={() => {
                    column.id === editedColumn && onClose()
                }}
                >
                {column.body(row, column.id === editedColumn, subRowUpdate(row.id, onChange))}
            </td>
        ))}
    </tr>
)

export const SingleEditableTableBody = ({ columns, data, edited, onEdit, onChange }) =>
    data.map(row => (
        <SingleEditableTableBodyRow
            key={row.id}
            columns={columns}
            row={row}
            editedColumn={edited && edited.row === row.id && edited.column}
            onEditColumn={columnId => onEdit({ row: row.id, column: columnId })}
            onClose={() => onEdit(null)}
            onChange={onChange}
        />
    ))

export const SingleEditableTable = ({ columns, data, edited, onEdit, onChange }) => (
    <table>
        <thead>
            <TableHeadRow columns={columns}/>
        </thead>
        <tbody>
            <SingleEditableTableBody
                columns={columns}
                data={data}
                edited={edited}
                onEdit={onEdit}
                onChange={onChange}
                />
        </tbody>
    </table>
)

export const TableSummary = ({ columns, data }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>
                {column.summary(data)}
            </td>
        ))}
    </tr>
)




/**************** Generic Table Stuff ****************/

export const recordField = name => ({
    get: record => record[name],
    update: (newValue, record) => ({ ...record, [name]: newValue }),
})

const useFocusIfEditing = isEditing => {
    const ref = React.useRef(null)

    React.useEffect(() => {
        if (isEditing && ref) {
            ref.current.focus()
        }
    }, [isEditing])

    return ref
}

export const columns = {
    text: fieldName => (row, isEditing, onChange) => {
        const onUpdate = event => {
            onChange(row => ({ ...row, [fieldName]: event.target.value + "" }))
        }

        if (isEditing) {
            return (
                <input
                    autoFocus
                    type="text"
                    value={row[fieldName]}
                    onChange={onUpdate}
                    />
            )
        }
        else {
            return row[fieldName]
        }
    },
    number: fieldName => (row, isEditing, onChange) => {
        const onUpdate = event => {
            onChange(row => ({ ...row, [fieldName]: event.target.value | 0 }))
        }

        if (isEditing) {
            return (
                <input
                    autoFocus
                    type="number"
                    value={row[fieldName]}
                    onChange={onUpdate}
                    />
            )
        }
        else {
            return row[fieldName]
        }
    },
    bool: fieldName => (row, isEditing, onChange) => {
        const onUpdate = event => {
            onChange(row => ({ ...row, [fieldName]: !!event.target.checked }))
        }
        return (
            <input
                type="checkbox"
                checked={row[fieldName]}
                onChange={onUpdate}
            />
        )
    },
}




/******************* Example ******************/

export const exampleData = [
    { id: 0, name: "Ford", size: 10000 },
    { id: 1, name: "VW", size: 20000 },
    { id: 2, name: "Mercedes Benz", size: 30000 },
    { id: 3, name: "Audi", size: 40000 },
]

export const dataColumns = [
    {
        id: 0,
        header: "Name",
        body: columns.text('name'),
    },
    {
        id: 1,
        header: "Size",
        body: columns.number('size'),
    },
]

export const TablesExample = ({ data, setData }) => {
    const [edited, setEdited] = React.useState(null)

    return (
        <table>
            <thead>
                <TableHeadRow columns={dataColumns} />
            </thead>
            <tbody>
                <SingleEditableTableBody
                    columns={dataColumns}
                    data={data}
                    edited={edited}
                    onEdit={setEdited}
                    onChange={setData}
                    />
            </tbody>
        </table>
    )
}
