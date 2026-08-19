import '98.css'
import './style.css'
import { mountSheet } from './sheet.ts'

const app = document.querySelector('#app')
if (!(app instanceof HTMLElement)) throw new Error('Missing #app')
mountSheet(app)
