/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrandingProvider } from './components/BrandingProvider'
import { I18nProvider } from './i18n'
import './styles/tokens.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </I18nProvider>
  </React.StrictMode>,
)
