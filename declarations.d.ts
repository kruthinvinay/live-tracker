declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';

declare module '../../firebaseConfig' {
    export const auth: any;
    export const db: any;
    export const storage: any;
}

declare module '@/components/ChatModal' {
    export const ChatModal: any;
}

declare module '@/components/ControlDock' {
    export const ControlDock: any;
}

declare module '@/hooks/useTrackerSocket' {
    export const useTrackerSocket: any;
    export type ToastType = 'info' | 'success' | 'error';
}
