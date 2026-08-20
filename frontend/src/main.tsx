import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { ConfigProvider, theme } from 'antd'
import { msalInstance } from './api/msal'
import App from './App'
import 'antd/dist/reset.css'

// Slate / Blue palette
const BG       = '#0B0F17'
const SURFACE  = '#121821'
const ELEVATED = '#1A2230'
const BORDER   = '#232C3A'
const PRIMARY  = '#3B82F6'
const TEXT     = '#E6EDF3'
const MUTED    = '#94A3B8'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: PRIMARY,
            colorBgBase: SURFACE,
            colorBgContainer: SURFACE,
            colorBgElevated: ELEVATED,
            colorBgLayout: BG,
            colorText: TEXT,
            colorTextSecondary: MUTED,
            colorBorder: BORDER,
            colorBorderSecondary: '#1A2230',
            borderRadius: 10,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 14,
            colorSuccess: '#22C55E',
            colorWarning: '#F59E0B',
            colorError: '#EF4444',
            colorInfo: PRIMARY,
            colorTextPlaceholder: '#64748B',
            colorLink: PRIMARY,
            colorLinkHover: '#60A5FA',
          },
          components: {
            Layout: {
              siderBg: SURFACE,
              headerBg: BG,
              bodyBg: BG,
            },
            Menu: {
              darkItemBg: 'transparent',
              darkSubMenuItemBg: 'transparent',
              darkItemSelectedBg: 'rgba(59,130,246,0.12)',
              darkItemSelectedColor: '#60A5FA',
              darkItemHoverBg: 'rgba(59,130,246,0.07)',
              darkItemHoverColor: TEXT,
              itemBorderRadius: 8,
            },
            Card: {
              colorBgContainer: SURFACE,
              colorBorderSecondary: BORDER,
            },
            Table: {
              colorBgContainer: 'transparent',
              headerBg: 'transparent',
              rowHoverBg: 'rgba(59,130,246,0.06)',
              borderColor: '#1A2230',
            },
            Modal: {
              contentBg: SURFACE,
              headerBg: SURFACE,
            },
            Drawer: {
              colorBgElevated: SURFACE,
            },
            Input: {
              colorBgContainer: ELEVATED,
              colorBorder: BORDER,
              colorText: TEXT,
            },
            Select: {
              colorBgContainer: ELEVATED,
              colorBorder: BORDER,
            },
            Button: {
              borderRadius: 8,
            },
            Tag: {
              borderRadius: 6,
            },
            Progress: {
              defaultColor: PRIMARY,
            },
            Statistic: {
              contentFontSize: 20,
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </MsalProvider>
  </React.StrictMode>,
)
