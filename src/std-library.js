import React from 'react'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as faSolid from '@fortawesome/free-solid-svg-icons'
import * as faRegular from '@fortawesome/free-regular-svg-icons'

import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'

import { REPL } from './repl'
import { createApp } from './value'
import * as tables from './tables'
import { classed } from './ui'
import { TextInput } from './utils'

export default {
    React,
    FontAwesomeIcon,
    faSolid,
    faRegular,
    TextInput,
    tables,
    REPL,
    App: createApp,
    classed,
    styled,
    babel,
    babelReact,
    babelParser,
}