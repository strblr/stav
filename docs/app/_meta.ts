import type { MetaRecord } from "nextra";

const meta: MetaRecord = {
  "*": {
    theme: {
      timestamp: false
    }
  },
  index: {
    display: "hidden",
    theme: {
      layout: "full",
      breadcrumb: false,
      toc: false,
      sidebar: false,
      copyPage: false,
      pagination: false
    }
  },
  documentation: {
    type: "page"
  },
  examples: {
    type: "page"
  }
};

export default meta;
