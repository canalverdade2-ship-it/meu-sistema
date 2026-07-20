import type {
  ElementType as ReactElementType,
  ReactNode as ReactNodeType,
} from 'react';

type GsaReactKey = string | number | bigint;

declare global {
  namespace React {
    type ElementType = ReactElementType;
    type ReactNode = ReactNodeType;
    type Key = GsaReactKey;

    interface Attributes {
      key?: Key | null;
    }
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: GsaReactKey | null;
    }
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: GsaReactKey | null;
    }
  }
}

export {};
