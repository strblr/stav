import { defineConfig } from "vocs";

export default defineConfig({
  title: "Stav",
  description: "The state manager you won’t fight with",
  editLink: {
    pattern: "https://github.com/strblr/stav/edit/main/docs/pages/:path",
    text: "Suggest changes to this page"
  },
  logoUrl: {
    light: "/logo-light.svg",
    dark: "/logo-dark.svg"
  },
  font: {
    google: "Inter"
  },
  socials: [
    {
      icon: "github",
      link: "https://github.com/strblr/stav"
    }
  ],
  theme: {
    colorScheme: "dark",
    accentColor: "hsl(49, 99%, 63%)"
  },
  topNav: [
    {
      text: "Docs",
      link: "/docs"
    },
    {
      text: "Guides",
      link: "/guides"
    },
    {
      text: "GitHub",
      link: "https://github.com/strblr/stav"
    },
    {
      text: "More",
      items: [
        {
          text: "LLM Context",
          link: "/llms.txt"
        },
        {
          text: "LLM Context (Full)",
          link: "/llms-full.txt"
        }
      ]
    }
  ],
  sidebar: {
    "/docs": [
      {
        text: "Getting started",
        link: "/docs"
      },
      {
        text: "Middlewares",
        link: "/docs/middlewares"
      },
      {
        text: "Usage with React",
        link: "/docs/react"
      },
      {
        text: "Transactions",
        link: "/docs/transactions"
      },
      {
        text: "Derived stores"
      },
      {
        text: "Utilities",
        link: "/docs/utilities"
      },
      {
        text: "Middlewares",
        collapsed: false,
        items: [
          {
            text: "Object",
            link: "/docs/middlewares/object"
          },
          {
            text: "React",
            link: "/docs/middlewares/react"
          },
          {
            text: "History",
            link: "/docs/middlewares/history"
          },
          {
            text: "Persist",
            link: "/docs/middlewares/persist"
          },
          {
            text: "Immer",
            link: "/docs/middlewares/immer"
          },
          {
            text: "Array",
            link: "/docs/middlewares/array"
          },
          {
            text: "Preprocess",
            link: "/docs/middlewares/preprocess"
          },
          {
            text: "Redux",
            link: "/docs/middlewares/redux"
          },
          {
            text: "Devtools",
            link: "/docs/middlewares/devtools"
          },
          {
            text: "Entangle",
            link: "/docs/middlewares/entangle"
          },
          {
            text: "SSR Safe",
            link: "/docs/middlewares/ssr-safe"
          },
          {
            text: "Verbose",
            link: "/docs/middlewares/verbose"
          }
        ]
      },
      {
        text: "API",
        collapsed: false,
        items: [
          {
            text: "Core"
          },
          {
            text: "Middlewares"
          }
        ]
      }
    ],
    "/guides": [
      {
        text: "Migrating from Zustand"
      },
      {
        text: "Modular store architecture"
      },
      {
        text: "Function as state"
      },
      {
        text: "Async persist: localForage"
      },
      {
        text: "React",
        collapsed: false,
        items: [
          {
            text: "Todo list"
          },
          {
            text: "Custom equality function"
          }
        ]
      }
    ]
  }
});
