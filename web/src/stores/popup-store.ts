import create from 'zustand';

export const CLAIMED_POPUP = 'claimed';
export const FINISH_POPUP = 'game-ended';
export const PLAY_POPUP = 'play';

export type PopupType =
  | typeof FINISH_POPUP
  | typeof CLAIMED_POPUP
  | typeof PLAY_POPUP;

export type PopupContent = {
  shown?: boolean;
  data?: any;
};
export type PopupStore = {
  popups: Record<PopupType, PopupContent>;
  setPopup: (type: PopupType, value: any) => void;
};
export const usePopupStore = create<PopupStore>((set, get) => ({
  popups: {
    [FINISH_POPUP]: {},
    [PLAY_POPUP]: {},
    [CLAIMED_POPUP]: {}
  },
  setPopup: (type: PopupType, value: any) => {
    set({ popups: { ...get().popups, [type]: value } });
  }
}));
