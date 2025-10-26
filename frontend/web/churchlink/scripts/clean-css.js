// To run: node scripts/clean-css

import { PurgeCSS } from 'purgecss'
import fs from 'fs'

const purgeCSSResult = await new PurgeCSS().purge({
  content: ['src/**/*.tsx', 'src/**/*.ts'],
  css: ['src/index.css'],
})

fs.writeFileSync('src/index.cleaned.css', purgeCSSResult[0].css)