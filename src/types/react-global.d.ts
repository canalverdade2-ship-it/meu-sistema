import type { ElementType as ReactElementType, ReactNode as ReactNodeType } from 'react';

declare global {
  namespace React {
    type ElementType = ReactElementType;
    type ReactNode = ReactNodeType;
  }
}

export {};
