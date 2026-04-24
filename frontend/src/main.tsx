import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { ConfigProvider, theme } from 'antd'
import { msalInstance } from './api/msal'
import App from './App'
import 'antd/dist/reset.css'

// Gruvbox Void Amber palette
const VOID     = '#1d2021'
const SURFACE  = '#282828'
const ELEVATED = '#32302f'
const BORDER   = '#3c3836'
const AMBER    = '#fabd2f'
const TEXT     = '#ebdbb2'
const MUTED    = '#928374'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: AMBER,
            colorBgBase: SURFACE,
            colorBgContainer: SURFACE,
            colorBgElevated: ELEVATED,
            colorBgLayout: VOID,
            colorText: TEXT,
            colorTextSecondary: MUTED,
            colorBorder: BORDER,
            colorBorderSecondary: '#2a2827',
            borderRadius: 6,
            fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 14,
            colorSuccess: '#b8bb26',
            colorWarning: '#fe8019',
            colorError: '#fb4934',
            colorInfo: '#83a598',
            colorTextPlaceholder: '#504945',
            colorLink: AMBER,
            colorLinkHover: '#ffd561',
          },
          components: {
            Layout: {
              siderBg: VOID,
              headerBg: VOID,
              bodyBg: VOID,
            },
            Menu: {
              darkItemBg: 'transparent',
              darkSubMenuItemBg: 'transparent',
              darkItemSelectedBg: 'rgba(250,189,47,0.1)',
              darkItemSelectedColor: AMBER,
              darkItemHoverBg: 'rgba(250,189,47,0.06)',
              darkItemHoverColor: TEXT,
              itemBorderRadius: 4,
            },
            Card: {
              colorBgContainer: SURFACE,
              colorBorderSecondary: BORDER,
            },
            Table: {
              colorBgContainer: 'transparent',
              headerBg: VOID,
              rowHoverBg: 'rgba(250,189,47,0.05)',
              borderColor: '#2a2827',
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
              borderRadius: 5,
            },
            Tag: {
              borderRadius: 4,
            },
            Progress: {
              defaultColor: AMBER,
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
