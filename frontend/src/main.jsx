import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { UIProvider } from './ui.jsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter><UIProvider><App /></UIProvider></BrowserRouter>
)
