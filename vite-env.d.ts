/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARC_RPC_URL?: string;
  readonly VITE_SEPOLIA_RPC_URL?: string;
  readonly VITE_ARC_ENTRY_POINT?: string;
  readonly VITE_ARC_BUNDLER_URL?: string;
  readonly VITE_ARC_BRIDGE_TREASURY_API_URL?: string;
  readonly VITE_ARC_BRIDGE_SEPOLIA_USDC?: string;
  readonly VITE_ARC_BRIDGE_ARC_USDC?: string;
  readonly VITE_BLOCK_EXPLORER_URL?: string;
  readonly VITE_MULTISIG_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
    const value: string;
    export default value;
}

declare module '*.jpg' {
    const value: string;
    export default value;
}

declare module '*.jpeg' {
    const value: string;
    export default value;
}

declare module '*.svg' {
    const value: string;
    export default value;
}

declare module '*.webp' {
    const value: string;
    export default value;
}
