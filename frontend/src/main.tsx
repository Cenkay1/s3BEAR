import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { ConfigProvider, theme } from 'antd'
import { msalInstance } from './api/msal'
import App from './App'
import 'antd/dist/reset.css'

// Neutral / Emerald palette
const BG       = '#0A0A0B'
const SURFACE  = '#141416'
const ELEVATED = '#1C1C20'
const BORDER   = '#2A2A30'
const PRIMARY  = '#10B981'
const TEXT     = '#ECECEE'
const MUTED    = '#A0A0A8'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <ConfigProvider
        componentSize="large"
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
            colorBorderSecondary: '#1C1C20',
            borderRadius: 10,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 15,
            colorSuccess: '#22C55E',
            colorWarning: '#F59E0B',
            colorError: '#EF4444',
            colorInfo: PRIMARY,
            colorTextPlaceholder: '#6B6B73',
            colorLink: PRIMARY,
            colorLinkHover: '#34D399',
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
              darkItemSelectedBg: 'rgba(16,185,129,0.14)',
              darkItemSelectedColor: '#34D399',
              darkItemHoverBg: 'rgba(16,185,129,0.08)',
              darkItemHoverColor: TEXT,
              itemBorderRadius: 8,
              itemHeight: 44,
              fontSize: 15,
            },
            Card: {
              colorBgContainer: SURFACE,
              colorBorderSecondary: BORDER,
            },
            Table: {
              colorBgContainer: 'transparent',
              headerBg: 'transparent',
              rowHoverBg: 'rgba(16,185,129,0.07)',
              borderColor: '#1C1C20',
              cellPaddingBlock: 14,
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
              contentFontSize: 22,
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </MsalProvider>
  </React.StrictMode>,
)
