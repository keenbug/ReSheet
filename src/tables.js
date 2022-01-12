import React from 'react'

/***************** Table Components *******************/

const TableHeadRow = ({ columns }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>{column.header}</td>
        ))}
    </tr>
)

const TableBodyRow = ({ columns, row }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>{column.body(row)}</td>
        ))}
    </tr>
)

const TableBody = ({ columns, data }) =>
    data.map(row => (
        <TableBodyRow key={row.id} columns={columns} row={row}/>
    ))

const Table = ({ columns, data }) => (
    <table>
        <thead>
            <TableHeadRow columns={columns}/>
        </thead>
        <tbody>
            <TableBody columns={columns} data={data}/>
        </tbody>
    </table>
)

const EditableTableBodyRow = ({ columns, row, onChange }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>
                {column.body(row, true, onChange)}
            </td>
        ))}
    </tr>
)

const EditableTableBody = ({ columns, data, onChange }) =>
    data.map(row => (
        <EditableTableBodyRow
            key={row.id}
            columns={columns}
            row={row}
            onChange={onChange}
            />
    ))
    
const EditableTable = ({ columns, data, onChange }) => (
    <table>
        <thead>
            <TableHeadRow columns={columns}/>
        </thead>
        <tbody>
            <EditableTableBody columns={columns} data={data} onChange={onChange}/>
        </tbody>
    </table>
)

const SingleEditableTableBodyRow = ({ columns, row, editedColumn, onEditColumn, onClose, onChange }) => (
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
                {column.body(row, column.id === editedColumn, onChange)}
            </td>
        ))}
    </tr>
)

const SingleEditableTableBody = ({ columns, data, edited, onEdit, onChange }) =>
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

const SingleEditableTable = ({ columns, data, edited, onEdit, onChange }) => (
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

const TableSummary = ({ columns, data }) => (
    <tr>
        {columns.map(column => (
            <td key={column.id}>
                {column.summary(data)}
            </td>
        ))}
    </tr>
)




/**************** Generic Table Stuff ****************/

const recordField = name => ({
    get: record => record[name],
    update: (newValue, record) => ({ ...record, [name]: newValue }),
})

const summaries = {
    count: field => data => data.filter(field.get).length,
    sum: field => data => data.map(field.get).reduce((a, b) => a + b),
}

const useFocusIfEditing = isEditing => {
    const ref = React.useRef(null)

    React.useEffect(() => {
        if (isEditing && ref) {
            ref.current.focus()
        }
    }, [isEditing])

    return ref
}

const fieldTypes = {
    text: field => (row, isEditing, onChange) => {
        const ref = useFocusIfEditing(isEditing)

        if (isEditing) {
            return (
                <input
                    ref={ref}
                    type="text"
                    value={field.get(row)}
                    onChange={event => {
                        onChange(field.update(event.target.value, row))
                    }}
                    />
            )
        }
        else {
            return field.get(row)
        }
    },
    number: field => (row, isEditing, onChange) => {
        const ref = useFocusIfEditing(isEditing)

        if (isEditing) {
            return (
                <input
                    ref={ref}
                    type="number"
                    value={field.get(row)}
                    onChange={event => {
                        onChange(field.update(event.target.value | 0, row))
                    }}
                    />
            )
        }
        else {
            return field.get(row)
        }
    },
    bool: field => (row, isEditing, onChange) => (
        <input
            type="checkbox"
            checked={field.get(row)}
            onChange={event => {
                onChange && onChange(field.update(!!event.target.checked, row))
            }}
            />
    ),
}

// Only as an example, can be created with newGenericColumn
const newBoolColumn = {
    init: "",
    view: (state, update) => (
        <input
            type="text"
            value={state}
            onChange={event => {
                update(event.target.value)
            }}
        />
    ),
    onAdd: (id, state) => ({
        id,
        header: state,
        body: fieldTypes.bool(recordField(state)),
    }),
}

const newGenericColumn = CodeEditor => ({
    init: { name: "", code: "" },
    view: (state, update) => (
        <React.Fragment>
            <input
                type="text"
                value={state.name}
                onChange={event => {
                    update({ ...state, name: event.target.value})
                }}
            />
            <CodeEditor code={state.code} onUpdate={code => update({ ...state, code })} />
        </React.Fragment>
    ),
    onAdd: (id, state) => ({
        id,
        header: state.name,
        body: runExpr(state.code, { React, fieldTypes, recordField })
    }),
})




/******************* Example ******************/

const exampleData = [
    { id: 0, name: "Ford", size: 10000 },
    { id: 1, name: "VW", size: 20000 },
    { id: 2, name: "Mercedes Benz", size: 30000 },
    { id: 3, name: "Audi", size: 40000 },
]

const dataColumns = [
    {
        id: 0,
        header: "Name",
        body: fieldTypes.text(recordField('name')),
        summary: summaries.count(recordField('name'))
    },
    {
        id: 1,
        header: "Size",
        body: fieldTypes.number(recordField('size')),
        summary: summaries.sum(recordField('size')),
    },
]

export const TablesExample = ({ CodeEditor }) => {
    const [edited, setEdited] = React.useState(null)
    const [data, setData] = React.useState(exampleData)
    const [columns, setColumns] = React.useState(dataColumns)
    const [newColumn, setNewColumn] = React.useState(null)

    const onChange = updatedRow =>
        setData(
            data.map(row =>
                row.id === updatedRow.id ? updatedRow : row
            )
        )

    const addRow = () => {
        setData([ ...data, { id: data.length } ])
    }

    return (
        <React.Fragment>
            <table>
                <thead>
                    <TableHeadRow columns={columns} />
                </thead>
                <tbody>
                    <SingleEditableTableBody
                        columns={columns}
                        data={data}
                        edited={edited}
                        onEdit={setEdited}
                        onChange={onChange}
                        />
                </tbody>
            </table>
            <button onClick={addRow}>+</button>
            <button onClick={() => {
                setNewColumn({
                    state: newGenericColumn.init,
                    column: newGenericColumn,
                })
            }}>
                Add Column
            </button>

            {newColumn !== null && (
                <div>
                    {newColumn.column.view(
                        newColumn.state,
                        newState => setNewColumn({ ...newColumn, state: newState }),
                    )}
                    <button
                        onClick={() => {
                            setColumns([
                                ...columns,
                                newColumn.column.onAdd(columns.length, newColumn.state),
                            ])
                            setNewColumn(null)
                        }}
                        >
                        add
                    </button>
                </div>
            )}
        </React.Fragment>
    )
}
