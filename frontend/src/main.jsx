import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { TEXT } from './text.js'
import './styles.css'

document.title = TEXT.appName

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
